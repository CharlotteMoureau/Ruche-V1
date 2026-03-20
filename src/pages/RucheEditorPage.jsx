import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RucheWorkspace from "../components/RucheWorkspace";

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

  const [hive, setHive] = useState(null);
  const [title, setTitle] = useState(() =>
    isNew && location.state?.title ? location.state.title : "Nouvelle Ruche",
  );
  const [boardData, setBoardData] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COMMENT");

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const commentsEndRef = useRef(null);

  const isOwner = Boolean(
    hive?.owner?.id && user?.id && hive.owner.id === user.id,
  );
  const collaboratorRole =
    hive?.collaborators?.find((collaborator) => collaborator.id === user?.id)
      ?.role || null;
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

  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, boardData }),
    [title, boardData],
  );
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isNew || savedSnapshot || boardData === null) return;
    setSavedSnapshot(JSON.stringify({ title: "Nouvelle Ruche", boardData }));
  }, [isNew, savedSnapshot, boardData]);

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
  }, [id, isNew, token]);

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
    try {
      if (isNew) {
        const created = await apiFetch("/hives", {
          method: "POST",
          token,
          body: { title, boardData },
        });
        navigate(`/hives/${created.id}`, { replace: true });
        return;
      }

      await apiFetch(`/hives/${id}`, {
        method: "PUT",
        token,
        body: { title, boardData },
      });
      const snapshot = JSON.stringify({ title, boardData });
      setSavedSnapshot(snapshot);

      setHive((prev) =>
        prev
          ? {
              ...prev,
              title,
              boardData,
            }
          : prev,
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const inviteCollaborator = async () => {
    try {
      const collaborator = await apiFetch(`/hives/${id}/collaborators`, {
        method: "POST",
        token,
        body: { email: inviteEmail, role: inviteRole },
      });
      setHive((prev) => ({
        ...prev,
        collaborators: [
          ...(prev?.collaborators || []).filter(
            (c) => c.id !== collaborator.id,
          ),
          collaborator,
        ],
      }));
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    }
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

  const editComment = async (comment, parentId = null) => {
    const value = window.prompt("Modifier le commentaire", comment.message);
    if (!value?.trim()) return;

    const updated = await apiFetch(`/hives/${id}/comments/${comment.id}`, {
      method: "PATCH",
      token,
      body: { message: value },
    });

    setHive((prev) => {
      if (!parentId) {
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
          c.id === parentId
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
  };

  const deleteComment = async (comment, parentId = null) => {
    const confirmed = window.confirm("Supprimer ce commentaire ?");
    if (!confirmed) return;

    await apiFetch(`/hives/${id}/comments/${comment.id}`, {
      method: "DELETE",
      token,
    });

    setHive((prev) => {
      if (!parentId) {
        return {
          ...prev,
          comments: (prev?.comments || []).filter((c) => c.id !== comment.id),
        };
      }
      return {
        ...prev,
        comments: (prev?.comments || []).map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: (c.replies || []).filter((r) => r.id !== comment.id),
              }
            : c,
        ),
      };
    });
  };

  const startReply = (comment) => {
    const targetId = comment.parentId ?? comment.id;
    setReplyingTo(targetId);
    setReplyText("");
  };

  const comments = hive?.comments || [];
  const commentCount = totalCommentCount(comments);

  return (
    <section className="editor-page">
      <div className="editor-topbar">
        <Link
          to="/profile"
          className="button-link"
          onClick={(event) => {
            if (!isDirty) return;
            const ok = window.confirm(
              "Votre ruche contient des modifications non enregistrees. Quitter sans sauvegarder ?",
            );
            if (!ok) {
              event.preventDefault();
            }
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

      {!isNew && hive ? (
        <p className="form-info">
          Creee le: {formatDateTime(hive.createdAt)} | Derniere edition:{" "}
          {formatDateTime(hive.updatedAt)}
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      <RucheWorkspace
        initialBoardData={boardData}
        loadKey={workspaceLoadKey}
        canEdit={canEdit}
        onStateChange={setBoardData}
        onOpenComments={!isNew ? () => setShowCommentsModal(true) : undefined}
        commentCount={commentCount}
      />

      {!isNew && hive ? (
        <div className="meta-grid">
          <section className="page-shell">
            <h3>Collaborateurs</h3>
            {(hive.owner?.id === user?.id || isAdmin) && (
              <div className="form-grid">
                <label>
                  Email
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="COMMENT">Comment only</option>
                    <option value="READ">Read only</option>
                  </select>
                </label>
                <button type="button" onClick={inviteCollaborator}>
                  Inviter
                </button>
              </div>
            )}
            <ul className="list-grid">
              {(hive.collaborators || []).map((collaborator) => (
                <li key={collaborator.id}>
                  <span>
                    {collaborator.username} - {collaborator.role}
                  </span>
                  {(hive.owner?.id === user?.id || isAdmin) && (
                    <div className="inline-actions">
                      <select
                        value={collaborator.role}
                        onChange={(e) =>
                          changeCollaboratorRole(
                            collaborator.id,
                            e.target.value,
                          )
                        }
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="COMMENT">Comment only</option>
                        <option value="READ">Read only</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCollaborator(collaborator.id)}
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

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
                            onClick={() => editComment(comment)}
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            className="comment-action-btn comment-action-btn--danger"
                            onClick={() => deleteComment(comment)}
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
                              onClick={() => editComment(reply, comment.id)}
                            >
                              Éditer
                            </button>
                            <button
                              type="button"
                              className="comment-action-btn comment-action-btn--danger"
                              onClick={() => deleteComment(reply, comment.id)}
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
    </section>
  );
}
