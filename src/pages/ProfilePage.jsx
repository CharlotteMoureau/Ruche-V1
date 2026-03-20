import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const HIVES_PER_PAGE = 10;

function getTotalPages(count) {
  return Math.max(1, Math.ceil(count / HIVES_PER_PAGE));
}

function clampPage(page, count) {
  return Math.min(Math.max(1, page), getTotalPages(count));
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ProfilePage() {
  const { token, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownedPage, setOwnedPage] = useState(1);
  const [sharedPage, setSharedPage] = useState(1);
  const [creatingHive, setCreatingHive] = useState(false);
  const [newHiveTitle, setNewHiveTitle] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await refreshMe();
        if (mounted) setProfile(data);
      } catch (err) {
        if (mounted) setError(err.message);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (!profile) return;

    setOwnedPage((current) => clampPage(current, profile.ownedHives.length));
    setSharedPage((current) => clampPage(current, profile.sharedHives.length));
  }, [profile]);

  const deleteHive = async (id) => {
    const confirmed = window.confirm("Supprimer cette ruche ?");
    if (!confirmed) return;

    await apiFetch(`/hives/${id}`, { method: "DELETE", token });
    const data = await refreshMe();
    setProfile(data);
  };

  const deleteProfile = async () => {
    const trimmedPassword = deletePassword.trim();
    const trimmedPasswordConfirm = deletePasswordConfirm.trim();

    if (!trimmedPassword || !trimmedPasswordConfirm) {
      setDeleteError("Veuillez renseigner les deux champs de mot de passe.");
      return;
    }

    if (trimmedPassword !== trimmedPasswordConfirm) {
      setDeleteError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setDeleteError("");
      setIsDeleting(true);
      await apiFetch("/users/me", {
        method: "DELETE",
        token,
        body: {
          confirmation: "DELETE",
          password: trimmedPassword,
        },
      });
      logout();
      navigate("/");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setDeletePassword("");
    setDeletePasswordConfirm("");
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setDeletePassword("");
    setDeletePasswordConfirm("");
    setDeleteError("");
  };

  const ownedTotalPages = profile
    ? getTotalPages(profile.ownedHives.length)
    : 1;
  const sharedTotalPages = profile
    ? getTotalPages(profile.sharedHives.length)
    : 1;
  const ownedCount = profile ? profile.ownedHives.length : 0;
  const sharedCount = profile ? profile.sharedHives.length : 0;

  const pagedOwnedHives = profile
    ? profile.ownedHives.slice(
        (ownedPage - 1) * HIVES_PER_PAGE,
        ownedPage * HIVES_PER_PAGE,
      )
    : [];

  const pagedSharedHives = profile
    ? profile.sharedHives.slice(
        (sharedPage - 1) * HIVES_PER_PAGE,
        sharedPage * HIVES_PER_PAGE,
      )
    : [];

  return (
    <section className="page-shell">
      <h2>Mon profil</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {profile ? (
        <>
          <p>
            <strong>Nom d'utilisateur :</strong> {profile.user.username}
          </p>
          <p>
            <strong>Email :</strong> {profile.user.email}
          </p>
          <p>
            <strong>Rôle :</strong> {profile.user.roleLabel}
            {profile.user.roleLabel === "Autre" && profile.user.roleOtherText
              ? ` - ${profile.user.roleOtherText}`
              : ""}
          </p>

          {creatingHive ? (
            <div className="form-grid">
              <label>
                Nom de la Ruche
                <input
                  type="text"
                  value={newHiveTitle}
                  onChange={(e) => setNewHiveTitle(e.target.value)}
                  maxLength={100}
                  autoFocus
                />
              </label>
              <span className="char-counter">{newHiveTitle.length}/100</span>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-link"
                  disabled={!newHiveTitle.trim()}
                  onClick={() => {
                    navigate("/hives/new", {
                      state: { title: newHiveTitle.trim() },
                    });
                    setCreatingHive(false);
                    setNewHiveTitle("");
                  }}
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingHive(false);
                    setNewHiveTitle("");
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="inline-actions">
              <button
                type="button"
                className="button-link"
                onClick={() => setCreatingHive(true)}
              >
                Créer une nouvelle Ruche
              </button>
            </div>
          )}

          {ownedCount > 0 ? (
            <>
              <h3>Mes Ruches</h3>
              <ul className="list-grid">
                {pagedOwnedHives.map((hive) => (
                  <li key={hive.id}>
                    <span>
                      <strong>{hive.title}</strong>
                      <br />
                      Créée le : {formatDateTime(hive.createdAt)}
                      <br />
                      Dernière édition : {formatDateTime(hive.updatedAt)}
                    </span>
                    <div className="inline-actions">
                      <Link className="button-link" to={`/hives/${hive.id}`}>
                        Ouvrir
                      </Link>
                      <button type="button" onClick={() => deleteHive(hive.id)}>
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {ownedCount > HIVES_PER_PAGE ? (
                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setOwnedPage((current) => Math.max(1, current - 1))
                    }
                    disabled={ownedPage === 1}
                  >
                    Precedent
                  </button>
                  <span>
                    Page {ownedPage}/{ownedTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOwnedPage((current) =>
                        Math.min(ownedTotalPages, current + 1),
                      )
                    }
                    disabled={ownedPage === ownedTotalPages}
                  >
                    Suivant
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {sharedCount > 0 ? (
            <>
              <h3>Ruches partagées</h3>
              <ul className="list-grid">
                {pagedSharedHives.map((hive) => (
                  <li key={hive.id}>
                    <span>
                      <strong>
                        {hive.title} ({hive.collaboratorRole})
                      </strong>
                      <br />
                      Créée le : {formatDateTime(hive.createdAt)}
                      <br />
                      Dernière édition : {formatDateTime(hive.updatedAt)}
                    </span>
                    <Link className="button-link" to={`/hives/${hive.id}`}>
                      Ouvrir
                    </Link>
                  </li>
                ))}
              </ul>
              {sharedCount > HIVES_PER_PAGE ? (
                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSharedPage((current) => Math.max(1, current - 1))
                    }
                    disabled={sharedPage === 1}
                  >
                    Précédent
                  </button>
                  <span>
                    Page {sharedPage}/{sharedTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSharedPage((current) =>
                        Math.min(sharedTotalPages, current + 1),
                      )
                    }
                    disabled={sharedPage === sharedTotalPages}
                  >
                    Suivant
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          <h3>Supprimer mon profil</h3>
          <p>Cette action est irréversible et supprimera vos données.</p>
          <button
            type="button"
            className="danger-btn"
            onClick={openDeleteModal}
          >
            Supprimer mon profil
          </button>

          {isDeleteModalOpen ? (
            <div
              className="modal-overlay"
              onClick={(event) => {
                if (event.target.classList.contains("modal-overlay")) {
                  closeDeleteModal();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  closeDeleteModal();
                }
              }}
              tabIndex={0}
            >
              <div
                className="modal-box"
                onClick={(event) => event.stopPropagation()}
              >
                <h2>Confirmer la suppression</h2>
                <p>
                  Entrez votre mot de passe deux fois pour supprimer le compte.
                </p>

                {deleteError ? (
                  <p className="form-error">{deleteError}</p>
                ) : null}

                <label>
                  Mot de passe
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    autoFocus
                    disabled={isDeleting}
                  />
                </label>

                <label>
                  Confirmer le mot de passe
                  <input
                    type="password"
                    value={deletePasswordConfirm}
                    onChange={(event) =>
                      setDeletePasswordConfirm(event.target.value)
                    }
                    disabled={isDeleting}
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={deleteProfile}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Suppression..." : "Supprimer mon profil"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p>Chargement...</p>
      )}
    </section>
  );
}
