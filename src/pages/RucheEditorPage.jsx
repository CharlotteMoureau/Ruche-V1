import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RucheWorkspace from "../components/RucheWorkspace";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import PageLoader from "../components/PageLoader";

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-BE", {
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

  const isNew = !id;
  const duplicateSource = location.state?.duplicateSource || null;
  const initialNewTitle =
    isNew && location.state?.title
      ? location.state.title
      : isNew && duplicateSource?.title
        ? duplicateSource.title
        : "Nouvelle Ruche";

  const [hive, setHive] = useState(null);
  const [title, setTitle] = useState(() => initialNewTitle);
  const [boardData, setBoardData] = useState(() =>
    isNew && duplicateSource?.boardData ? duplicateSource.boardData : null,
  );
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const commentsEndRef = useRef(null);
  const [showLeaveDirtyModal, setShowLeaveDirtyModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);

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
    setError("");
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Veuillez renseigner un titre avant d'enregistrer.");
      return;
    }

    if (isDuplicateFlow && !hasRenamedDuplicate) {
      setError("Renommez la copie avant de l'enregistrer.");
      return;
    }

    try {
      if (isNew) {
        const created = await apiFetch("/hives", {
          method: "POST",
          token,
          body: { title: trimmedTitle, boardData },
        });
        navigate(`/hives/${created.id}`, { replace: true });
        return;
      }

      await apiFetch(`/hives/${id}`, {
        method: "PUT",
        token,
        body: { title: trimmedTitle, boardData },
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
    } catch (err) {
      setError(err.message);
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

    const updated = await apiFetch(`/hives/${id}/comments/${editingTarget.comment.id}`, {
      method: "PATCH",
      token,
      body: { message: value },
    });

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

  const comments = hive?.comments || [];
  const commentCount = totalCommentCount(comments);
  const isHiveLoading = !isNew && !hive && !error;

  return (
    <section className="editor-page">
      <div className="editor-topbar">
        <Link
          to="/profile"
          className="button-link"
          onClick={(event) => {
            if (!isDirty) return;
            event.preventDefault();
            setShowLeaveDirtyModal(true);
          }}
        >
          Retour au profil
        </Link>

        <label>
          Titre de la Ruche
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={!canEdit}
          />
        </label>
        {canEdit ? (
          <button type="button" onClick={saveHive}>
            Enregistrer la ruche
          </button>
        ) : null}
      </div>

      {isDuplicateFlow ? (
        <p className="form-info">
          Cette ruche est une copie. Renommez-la avant de l&apos;enregistrer.
        </p>
      ) : null}

      {!isNew && hive ? (
        <p className="form-info">
          Créée le: {formatDateTime(hive.createdAt)} | Dernière édition:{" "}
          {formatDateTime(hive.updatedAt)}
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {isHiveLoading ? (
        <PageLoader
          title="Chargement de la ruche"
          subtitle="Les cartes et les commentaires arrivent."
          variant="hive"
        />
      ) : (
        <RucheWorkspace
          initialBoardData={boardData}
          loadKey={workspaceLoadKey}
          canEdit={canEdit}
          canComment={canComment}
          canInvite={
            !isNew && Boolean(hive) && (hive.owner?.id === user?.id || isAdmin)
          }
          canLeaveHive={!isNew && Boolean(hive) && isCollaborator}
          collaborators={hive?.collaborators || []}
          onInviteCollaborator={!isNew && hive ? inviteCollaborator : undefined}
          onChangeCollaboratorRole={
            !isNew && hive ? changeCollaboratorRole : undefined
          }
          onRemoveCollaborator={!isNew && hive ? removeCollaborator : undefined}
          onLeaveHive={!isNew && hive && isCollaborator ? leaveHive : undefined}
          onStateChange={setBoardData}
          onOpenComments={!isNew ? () => setShowCommentsModal(true) : undefined}
          commentCount={commentCount}
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
            <h2>Chat de la Ruche</h2>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowCommentsModal(false);
                setReplyingTo(null);
                setReplyText("");
              }}
              aria-label="Fermer"
            >
              ×
            </button>

            <div className="comments-scroll">
              {comments.length === 0 && (
                <p className="comments-empty">
                  Aucun commentaire pour l&apos;instant.
                </p>
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
                          Répondre
                        </button>
                      )}
                      {(comment.author?.id === user?.id || isAdmin) && (
                        <>
                          <button
                            type="button"
                            className="comment-action-btn"
                            onClick={() => openEditCommentModal(comment)}
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            className="comment-action-btn comment-action-btn--danger"
                            onClick={() => openDeleteCommentModal(comment)}
                          >
                            Supprimer
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
                            Répondre
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
                              Éditer
                            </button>
                            <button
                              type="button"
                              className="comment-action-btn comment-action-btn--danger"
                              onClick={() =>
                                openDeleteCommentModal(reply, comment.id)
                              }
                            >
                              Supprimer
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
                        placeholder="Écrire une réponse…"
                        rows={2}
                        autoFocus
                      />
                      <div className="comment-reply-actions">
                        <button
                          type="button"
                          onClick={() => submitReply(comment.id)}
                        >
                          Envoyer
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                        >
                          Annuler
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
                  placeholder="Ajouter un commentaire…"
                  rows={2}
                />
                <button type="button" onClick={submitComment}>
                  Envoyer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <UnifiedPromptModal
        isOpen={showLeaveDirtyModal}
        title="Modifications non enregistrées"
        message="Votre ruche contient des modifications non enregistrées. Quitter sans sauvegarder ?"
        confirmLabel="Quitter"
        onCancel={() => setShowLeaveDirtyModal(false)}
        onConfirm={() => {
          setShowLeaveDirtyModal(false);
          navigate("/profile");
        }}
      />

      <UnifiedPromptModal
        isOpen={Boolean(editingTarget)}
        mode="prompt"
        title="Modifier le commentaire"
        inputLabel="Nouveau message"
        value={editingTarget?.value || ""}
        onValueChange={(value) =>
          setEditingTarget((prev) => (prev ? { ...prev, value } : prev))
        }
        confirmLabel="Enregistrer"
        confirmDisabled={!editingTarget?.value?.trim()}
        onCancel={() => setEditingTarget(null)}
        onConfirm={editComment}
      />

      <UnifiedPromptModal
        isOpen={Boolean(deleteTarget)}
        title="Supprimer le commentaire"
        message="Cette action est irreversible. Voulez-vous continuer ?"
        confirmLabel="Supprimer"
        confirmClassName="danger-btn"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteComment}
      />
    </section>
  );
}
