import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AdminPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [hives, setHives] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [allUsers, allHives] = await Promise.all([
        apiFetch("/admin/users", { token }),
        apiFetch("/admin/hives", { token }),
      ]);
      setUsers(allUsers);
      setHives(allHives);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const removeUser = async (id) => {
    await apiFetch(`/admin/users/${id}`, { method: "DELETE", token });
    await load();
  };

  const removeHive = async (id) => {
    await apiFetch(`/admin/hives/${id}`, { method: "DELETE", token });
    await load();
  };

  return (
    <section className="page-shell">
      <h2>Administration</h2>
      {error ? <p className="form-error">{error}</p> : null}

      <h3>Utilisateurs</h3>
      <ul className="list-grid">
        {users.map((u) => (
          <li key={u.id}>
            <span>
              {u.username} ({u.email}) - {u.roleLabel}
            </span>
            <button type="button" onClick={() => removeUser(u.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>Ruches</h3>
      <ul className="list-grid">
        {hives.map((hive) => (
          <li key={hive.id}>
            <span>
              {hive.title} - owner: {hive.owner?.username}
            </span>
            <button type="button" onClick={() => removeHive(hive.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
