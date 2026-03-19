import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

export default function RucheEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user, isAdmin } = useAuth();

  const [hive, setHive] = useState(null);
  const [title, setTitle] = useState("Nouvelle Ruche");
  const [boardData, setBoardData] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COMMENT");
  const [commentText, setCommentText] = useState("");

  const isNew = !id;
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
    try {
      const comment = await apiFetch(`/hives/${id}/comments`, {
        method: "POST",
        token,
        body: { message: commentText },
      });

      setHive((prev) => ({
        ...prev,
        comments: [...(prev?.comments || []), comment],
      }));
      setCommentText("");
    } catch (err) {
      setError(err.message);
    }
  };

  const editComment = async (comment) => {
    const value = window.prompt("Modifier le commentaire", comment.message);
    if (!value?.trim()) return;

    const updated = await apiFetch(`/hives/${id}/comments/${comment.id}`, {
      method: "PATCH",
      token,
      body: { message: value },
    });

    setHive((prev) => ({
      ...prev,
      comments: (prev?.comments || []).map((c) =>
        c.id === updated.id ? updated : c,
      ),
    }));
  };

  const deleteComment = async (comment) => {
    const confirmed = window.confirm("Supprimer ce commentaire ?");
    if (!confirmed) return;

    await apiFetch(`/hives/${id}/comments/${comment.id}`, {
      method: "DELETE",
      token,
    });

    setHive((prev) => ({
      ...prev,
      comments: (prev?.comments || []).filter((c) => c.id !== comment.id),
    }));
  };

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

          <section className="page-shell">
            <h3>Chat de la Ruche</h3>
            {canComment ? (
              <div className="inline-actions">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajouter un commentaire"
                />
                <button type="button" onClick={submitComment}>
                  Envoyer
                </button>
              </div>
            ) : null}
            <ul className="list-grid">
              {(hive.comments || []).map((comment) => (
                <li key={comment.id}>
                  <span>
                    <strong>{comment.author?.username}</strong>:{" "}
                    {comment.message}
                    <br />
                    Cree le: {formatDateTime(comment.createdAt)}
                    <br />
                    Derniere edition: {formatDateTime(comment.updatedAt)}
                  </span>
                  {(comment.author?.id === user?.id || isAdmin) && (
                    <div className="inline-actions">
                      <button
                        type="button"
                        onClick={() => editComment(comment)}
                      >
                        Editer
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteComment(comment)}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  );
}
