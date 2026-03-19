import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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

          <div className="inline-actions">
            <Link className="button-link" to="/hives/new">
              Creer une nouvelle Ruche
            </Link>
          </div>

          <h3>Mes Ruches</h3>
          <ul className="list-grid">
            {profile.ownedHives.map((hive) => (
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

          <h3>Ruches partagees</h3>
          <ul className="list-grid">
            {profile.sharedHives.map((hive) => (
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
