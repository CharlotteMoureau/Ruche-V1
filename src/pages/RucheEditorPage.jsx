import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import domtoimage from "dom-to-image-more";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RucheWorkspace from "../components/RucheWorkspace";
import Toolbar from "../components/Toolbar";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import PageLoader from "../components/PageLoader";
import { useLanguage } from "../context/LanguageContext";

function waitForCaptureFrame() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
}

function formatDateTime(value, locale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function totalCommentCount(comments = []) {
  return comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
}

export default function RucheEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, isAdmin } = useAuth();
  const { t, dateLocale } = useLanguage();

  const isNew = !id;
  const duplicateSource = location.state?.duplicateSource || null;
  const initialNewTitle =
    isNew && location.state?.title
      ? location.state.title
      : isNew && duplicateSource?.title
        ? duplicateSource.title
        : t("editor.newHiveTitle");

  const [hive, setHive] = useState(null);
  const [title, setTitle] = useState(() => initialNewTitle);
  const [boardData, setBoardData] = useState(() =>
    isNew && duplicateSource?.boardData ? duplicateSource.boardData : null,
  );
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const commentsEndRef = useRef(null);
  const [showLeaveDirtyModal, setShowLeaveDirtyModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);

  const isOwner = Boolean(
    hive?.owner?.id && user?.id && hive.owner.id === user.id,
  );
  const collaboratorRole =
    hive?.collaborators?.find((collaborator) => collaborator.id === user?.id)
      ?.role || null;
  const isCollaborator = Boolean(collaboratorRole);
  const canEdit = isNew
    ? true
    : Boolean(
        hive?.canEdit || isOwner || isAdmin || collaboratorRole === "ADMIN",
      );
  const canComment = isNew
    ? false
    : Boolean(
        hive?.canComment ||
        isOwner ||
        isAdmin ||
        collaboratorRole === "ADMIN" ||
        collaboratorRole === "COMMENT",
      );
  const workspaceLoadKey = isNew
    ? "new-hive"
    : `${id}:${hive ? "loaded" : "init"}`;
  const isDuplicateFlow = isNew && Boolean(duplicateSource?.title);
  const hasRenamedDuplicate =
    !isDuplicateFlow || title.trim() !== duplicateSource.title.trim();

  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, boardData }),
    [title, boardData],
  );
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isNew || savedSnapshot || boardData === null) return;
    setSavedSnapshot(JSON.stringify({ title: initialNewTitle, boardData }));
  }, [isNew, savedSnapshot, boardData, initialNewTitle]);

  useEffect(() => {
    if (isNew || canEdit) return;
    let mounted = true;

    async function load() {
      try {
        const data = await apiFetch(`/hives/${id}`, { token });
        if (!mounted) return;
        setHive(data);
        setTitle(data.title);
        setBoardData(data.boardData);
        setSavedSnapshot(
          JSON.stringify({ title: data.title, boardData: data.boardData }),
        );
      } catch (err) {
        if (mounted) setError(err.message);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [canEdit, id, isNew, token]);

  useEffect(() => {
    if (isNew) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await apiFetch(`/hives/${id}`, { token });

        setHive(data);
        const nextSnapshot = JSON.stringify({
          title: data.title,
          boardData: data.boardData,
        });

        if (!isDirty) {
          setTitle(data.title);
          setBoardData(data.boardData);
          setSavedSnapshot(nextSnapshot);
        }
      } catch {
        // Ignore transient refresh errors and keep local editing state.
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [canEdit, id, isDirty, isNew, token]);

  useEffect(() => {
    const handler = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    document.body.style.overflow = showCommentsModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCommentsModal]);

  const saveHive = async () => {
    if (isSaving) return false;

    setError("");
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError(t("editor.saveTitleError"));
      return;
    }

    if (isDuplicateFlow && !hasRenamedDuplicate) {
      setError(t("editor.duplicateRenameError"));
      return;
    }

    setIsSaving(true);
    try {
      const hasBoardCards = Array.isArray(boardData?.boardCards)
        ? boardData.boardCards.length > 0
        : false;
      let boardPreviewImage = null;

      if (hasBoardCards) {
        const board = document.querySelector(".hive-board");
        if (board) {
          document.body.classList.add("capture-mode");
          try {
            await waitForCaptureFrame();
            boardPreviewImage = await domtoimage.toPng(board, {
              cacheBust: true,
            });
          } catch {
            boardPreviewImage = null;
          } finally {
            document.body.classList.remove("capture-mode");
          }
        }
      }

      if (isNew) {
        const created = await apiFetch("/hives", {
          method: "POST",
          token,
          body: { title: trimmedTitle, boardData, boardPreviewImage },
        });
        navigate(`/hives/${created.id}`, { replace: true });
        return true;
      }

      await apiFetch(`/hives/${id}`, {
        method: "PUT",
        token,
        body: { title: trimmedTitle, boardData, boardPreviewImage },
      });
      const snapshot = JSON.stringify({ title: trimmedTitle, boardData });
      setSavedSnapshot(snapshot);
      setTitle(trimmedTitle);

      setHive((prev) =>
        prev
          ? {
              ...prev,
              title: trimmedTitle,
              boardData,
            }
          : prev,
      );
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndLeave = async () => {
    setShowLeaveDirtyModal(false);
    const success = await saveHive();
    if (success && !isNew) {
      navigate("/profile");
    }
  };

  const inviteCollaborator = async (email, role) => {
    const collaborator = await apiFetch(`/hives/${id}/collaborators`, {
      method: "POST",
      token,
      body: { email, role },
    });
    setHive((prev) => ({
      ...prev,
      collaborators: [
        ...(prev?.collaborators || []).filter((c) => c.id !== collaborator.id),
        collaborator,
      ],
    }));
  };

  const removeCollaborator = async (collaboratorId) => {
    await apiFetch(`/hives/${id}/collaborators/${collaboratorId}`, {
      method: "DELETE",
      token,
    });
    setHive((prev) => ({
      ...prev,
      collaborators: (prev?.collaborators || []).filter(
        (c) => c.id !== collaboratorId,
      ),
    }));
  };

  const leaveHive = async () => {
    if (!user?.id) return;

    await removeCollaborator(user.id);
    navigate("/profile");
  };

  const changeCollaboratorRole = async (collaboratorId, role) => {
    const updated = await apiFetch(
      `/hives/${id}/collaborators/${collaboratorId}`,
      {
        method: "PATCH",
        token,
        body: { role },
      },
    );

    setHive((prev) => ({
      ...prev,
      collaborators: (prev?.collaborators || []).map((c) =>
        c.id === collaboratorId ? updated : c,
      ),
    }));
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      const comment = await apiFetch(`/hives/${id}/comments`, {
        method: "POST",
        token,
        body: { message: text },
      });

      setHive((prev) => ({
        ...prev,
        comments: [{ ...comment, replies: [] }, ...(prev?.comments || [])],
      }));
      setCommentText("");
    } catch (err) {
      setError(err.message);
    }
  };

  const submitReply = async (parentId) => {
    const text = replyText.trim();
    if (!text) return;
    try {
      const reply = await apiFetch(`/hives/${id}/comments`, {
        method: "POST",
        token,
        body: { message: text, parentId },
      });

      const resolvedParentId = reply.parentId;
      setHive((prev) => ({
        ...prev,
        comments: (prev?.comments || []).map((c) =>
          c.id === resolvedParentId
            ? { ...c, replies: [...(c.replies || []), reply] }
            : c,
        ),
      }));
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const editComment = async () => {
    if (!editingTarget?.comment) return;

    const value = editingTarget.value.trim();
    if (!value) return;

    const updated = await apiFetch(
      `/hives/${id}/comments/${editingTarget.comment.id}`,
      {
        method: "PATCH",
        token,
        body: { message: value },
      },
    );

    setHive((prev) => {
      if (!editingTarget.parentId) {
        return {
          ...prev,
          comments: (prev?.comments || []).map((c) =>
            c.id === updated.id ? { ...updated, replies: c.replies || [] } : c,
          ),
        };
      }
      return {
        ...prev,
        comments: (prev?.comments || []).map((c) =>
          c.id === editingTarget.parentId
            ? {
                ...c,
                replies: (c.replies || []).map((r) =>
                  r.id === updated.id ? updated : r,
                ),
              }
            : c,
        ),
      };
    });
    setEditingTarget(null);
  };

  const deleteComment = async () => {
    if (!deleteTarget?.comment) return;

    await apiFetch(`/hives/${id}/comments/${deleteTarget.comment.id}`, {
      method: "DELETE",
      token,
    });

    setHive((prev) => {
      if (!deleteTarget.parentId) {
        return {
          ...prev,
          comments: (prev?.comments || []).filter(
            (c) => c.id !== deleteTarget.comment.id,
          ),
        };
      }
      return {
        ...prev,
        comments: (prev?.comments || []).map((c) =>
          c.id === deleteTarget.parentId
            ? {
                ...c,
                replies: (c.replies || []).filter(
                  (r) => r.id !== deleteTarget.comment.id,
                ),
              }
            : c,
        ),
      };
    });
    setDeleteTarget(null);
  };

  const openEditCommentModal = (comment, parentId = null) => {
    setEditingTarget({
      comment,
      parentId,
      value: comment.message || "",
    });
  };

  const openDeleteCommentModal = (comment, parentId = null) => {
    setDeleteTarget({ comment, parentId });
  };

  const startReply = (comment) => {
    const targetId = comment.parentId ?? comment.id;
    setReplyingTo(targetId);
    setReplyText("");
  };

  const handleEnterSubmit = (event, submitAction) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    submitAction();
  };

  const comments = hive?.comments || [];
  const commentCount = totalCommentCount(comments);
  const isHiveLoading = !isNew && !hive && !error;

  return (
    <section className="editor-page">
      <div className="editor-topbar">
        <div className="editor-topbar-main">
          <Link
            to="/profile"
            className="button-link"
            onClick={(event) => {
              if (!isDirty) return;
              event.preventDefault();
              setShowLeaveDirtyModal(true);
            }}
          >
            {t("editor.backToProfile")}
          </Link>

          <label>
            {t("editor.hiveTitleLabel")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(event) => {
                if (!canEdit || isSaving || event.nativeEvent.isComposing)
                  return;
                if (event.key !== "Enter") return;
                event.preventDefault();
                saveHive();
              }}
              maxLength={100}
              disabled={!canEdit}
            />
          </label>
          {canEdit ? (
            <button type="button" onClick={saveHive} disabled={isSaving}>
              {isSaving ? t("editor.saving") : t("editor.saveHive")}
            </button>
          ) : null}
        </div>

        <div className="editor-topbar-actions">
          <Toolbar
            onReset={() => setResetSignal((prev) => prev + 1)}
            canInvite={
              !isNew &&
              Boolean(hive) &&
              (hive.owner?.id === user?.id || isAdmin)
            }
            canLeaveHive={!isNew && Boolean(hive) && isCollaborator}
            collaborators={hive?.collaborators || []}
            onInviteCollaborator={
              !isNew && hive ? inviteCollaborator : undefined
            }
            onChangeCollaboratorRole={
              !isNew && hive ? changeCollaboratorRole : undefined
            }
            onRemoveCollaborator={
              !isNew && hive ? removeCollaborator : undefined
            }
            onLeaveHive={
              !isNew && hive && isCollaborator ? leaveHive : undefined
            }
            onOpenComments={
              !isNew ? () => setShowCommentsModal(true) : undefined
            }
            commentCount={commentCount}
          />
        </div>
      </div>

      {isDuplicateFlow ? (
        <p className="form-info">{t("editor.duplicateInfo")}</p>
      ) : null}

      {!isNew && hive ? (
        <p className="form-info">
          {t("editor.createdAt")}: {formatDateTime(hive.createdAt, dateLocale)}{" "}
          | {t("editor.updatedAt")}:{" "}
          {formatDateTime(hive.updatedAt, dateLocale)}
        </p>
      ) : null}

      {isSaving ? (
        <p className="form-info" aria-live="polite">
          {t("editor.updating")}
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {isHiveLoading ? (
        <PageLoader
          title={t("editor.loadingTitle")}
          subtitle={t("editor.loadingSubtitle")}
          variant="hive"
        />
      ) : (
        <RucheWorkspace
          initialBoardData={boardData}
          loadKey={workspaceLoadKey}
          resetSignal={resetSignal}
          canEdit={canEdit}
          canComment={canComment}
          onStateChange={setBoardData}
        />
      )}

      {showCommentsModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCommentsModal(false);
              setReplyingTo(null);
              setReplyText("");
            }
          }}
        >
          <div className="modal-box comments-modal">
            <h2>{t("editor.commentsTitle")}</h2>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowCommentsModal(false);
                setReplyingTo(null);
                setReplyText("");
              }}
              aria-label={t("common.close")}
            >
              ×
            </button>

            <div className="comments-scroll">
              {comments.length === 0 && (
                <p className="comments-empty">{t("editor.noComments")}</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="comment-thread">
                  <div className="comment-item">
                    <div className="comment-header">
                      <strong>{comment.author?.username}</strong>
                      <span className="comment-date">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="comment-message">{comment.message}</p>
                    <div className="comment-actions">
                      {canComment && (
                        <button
                          type="button"
                          className="comment-action-btn"
                          onClick={() => startReply(comment)}
                        >
                          {t("editor.reply")}
                        </button>
                      )}
                      {(comment.author?.id === user?.id || isAdmin) && (
                        <>
                          <button
                            type="button"
                            className="comment-action-btn"
                            onClick={() => openEditCommentModal(comment)}
                          >
                            {t("editor.edit")}
                          </button>
                          <button
                            type="button"
                            className="comment-action-btn comment-action-btn--danger"
                            onClick={() => openDeleteCommentModal(comment)}
                          >
                            {t("editor.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {(comment.replies || []).map((reply) => (
                    <div
                      key={reply.id}
                      className="comment-item comment-item--reply"
                    >
                      <div className="comment-header">
                        <strong>{reply.author?.username}</strong>
                        <span className="comment-date">
                          {formatDateTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="comment-message">{reply.message}</p>
                      <div className="comment-actions">
                        {canComment && (
                          <button
                            type="button"
                            className="comment-action-btn"
                            onClick={() => startReply(reply)}
                          >
                            {t("editor.reply")}
                          </button>
                        )}
                        {(reply.author?.id === user?.id || isAdmin) && (
                          <>
                            <button
                              type="button"
                              className="comment-action-btn"
                              onClick={() =>
                                openEditCommentModal(reply, comment.id)
                              }
                            >
                              {t("editor.edit")}
                            </button>
                            <button
                              type="button"
                              className="comment-action-btn comment-action-btn--danger"
                              onClick={() =>
                                openDeleteCommentModal(reply, comment.id)
                              }
                            >
                              {t("editor.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {replyingTo === comment.id && (
                    <div className="comment-reply-form">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(event) =>
                          handleEnterSubmit(event, () =>
                            submitReply(comment.id),
                          )
                        }
                        placeholder={t("editor.replyPlaceholder")}
                        rows={2}
                        autoFocus
                      />
                      <div className="comment-reply-actions">
                        <button
                          type="button"
                          onClick={() => submitReply(comment.id)}
                        >
                          {t("editor.send")}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {canComment && (
              <div className="comments-new">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(event) => handleEnterSubmit(event, submitComment)}
                  placeholder={t("editor.addCommentPlaceholder")}
                  rows={2}
                />
                <button type="button" onClick={submitComment}>
                  {t("editor.send")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <UnifiedPromptModal
        isOpen={showLeaveDirtyModal}
        title={t("editor.unsavedTitle")}
        message={t("editor.unsavedMessage")}
        cancelLabel={t("editor.stay")}
        extraActionLabel={t("editor.saveAndLeave")}
        onExtraAction={saveAndLeave}
        confirmLabel={t("editor.leaveWithoutSaving")}
        confirmClassName="danger"
        onCancel={() => setShowLeaveDirtyModal(false)}
        onConfirm={() => {
          setShowLeaveDirtyModal(false);
          navigate("/profile");
        }}
      />

      <UnifiedPromptModal
        isOpen={Boolean(editingTarget)}
        mode="prompt"
        title={t("editor.editCommentTitle")}
        inputLabel={t("editor.newMessage")}
        value={editingTarget?.value || ""}
        onValueChange={(value) =>
          setEditingTarget((prev) => (prev ? { ...prev, value } : prev))
        }
        confirmLabel={t("common.save")}
        confirmDisabled={!editingTarget?.value?.trim()}
        onCancel={() => setEditingTarget(null)}
        onConfirm={editComment}
      />

      <UnifiedPromptModal
        isOpen={Boolean(deleteTarget)}
        title={t("editor.deleteCommentTitle")}
        message={t("workspace.irreversible")}
        confirmLabel={t("common.delete")}
        confirmClassName="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteComment}
      />
    </section>
  );
}
