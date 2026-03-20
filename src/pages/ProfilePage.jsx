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
  const [deletePassword, setDeletePassword] = useState("");
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
    const confirmed = window.confirm(
      "Confirmez-vous la suppression de votre profil ?",
    );
    if (!confirmed) return;

    try {
      await apiFetch("/users/me", {
        method: "DELETE",
        token,
        body: {
          confirmation: "DELETE",
          password: deletePassword,
        },
      });
      logout();
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
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
            <strong>Username:</strong> {profile.user.username}
          </p>
          <p>
            <strong>Email:</strong> {profile.user.email}
          </p>
          <p>
            <strong>Role:</strong> {profile.user.roleLabel}
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
                Creer une nouvelle Ruche
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
                      Creee le: {formatDateTime(hive.createdAt)}
                      <br />
                      Derniere edition: {formatDateTime(hive.updatedAt)}
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
              <h3>Ruches partagees</h3>
              <ul className="list-grid">
                {pagedSharedHives.map((hive) => (
                  <li key={hive.id}>
                    <span>
                      <strong>
                        {hive.title} ({hive.collaboratorRole})
                      </strong>
                      <br />
                      Creee le: {formatDateTime(hive.createdAt)}
                      <br />
                      Derniere edition: {formatDateTime(hive.updatedAt)}
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
                    Precedent
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
          <p>Double confirmation requise.</p>
          <label>
            Mot de passe
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </label>
          <button type="button" className="danger-btn" onClick={deleteProfile}>
            Supprimer mon profil
          </button>
        </>
      ) : (
        <p>Chargement...</p>
      )}
    </section>
  );
}
