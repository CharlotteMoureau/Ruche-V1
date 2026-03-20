import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import UnifiedPromptModal from "../components/UnifiedPromptModal";

const ITEMS_PER_PAGE = 10;

function getTotalPages(count) {
  return Math.max(1, Math.ceil(count / ITEMS_PER_PAGE));
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

const USER_ROLES = [
  "Délégué PECA",
  "Direction",
  "Enseignant",
  "Educateur",
  "Membre d'un CPMS",
  "Futur enseignant",
  "Intervenant culturel",
  "Etudiant en Ecole Superieure des Arts",
  "Référent culturel",
  "Référent scolaire",
  "Autre",
];

export default function AdminPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [hives, setHives] = useState([]);
  const [error, setError] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [hivesPage, setHivesPage] = useState(1);
  const [editingUser, setEditingUser] = useState(null);
  const [editingHive, setEditingHive] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [hiveSearch, setHiveSearch] = useState("");
  const [userSort, setUserSort] = useState("createdAt_desc");
  const [hiveSort, setHiveSort] = useState("updatedAt_desc");
  const [deleteTarget, setDeleteTarget] = useState({ type: null, id: null });

  const userSortField = userSort.split("_")[0];
  const userSortDir = userSort.split("_")[1];
  const hiveSortField = hiveSort.split("_")[0];
  const hiveSortDir = hiveSort.split("_")[1];

  const toggleSort = (field, currentSort, setSort) => {
    const [currentField, currentDir] = currentSort.split("_");
    if (currentField === field) {
      setSort(`${field}_${currentDir === "asc" ? "desc" : "asc"}`);
      return;
    }
    setSort(`${field}_asc`);
  };

  const sortIndicator = (field, activeField, activeDir) => {
    if (field !== activeField) return "";
    return activeDir === "asc" ? " ↑" : " ↓";
  };

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

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    let list = q
      ? users.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.roleLabel.toLowerCase().includes(q),
        )
      : [...users];
    list.sort((a, b) => {
      const [field, dir] = userSort.split("_");
      let av, bv;
      if (field === "username") {
        av = a.username.toLowerCase();
        bv = b.username.toLowerCase();
      } else if (field === "email") {
        av = a.email.toLowerCase();
        bv = b.email.toLowerCase();
      } else if (field === "roleLabel") {
        av = a.roleLabel.toLowerCase();
        bv = b.roleLabel.toLowerCase();
      } else if (field === "hivesCount") {
        av = a._count.hives;
        bv = b._count.hives;
      } else if (field === "collabsCount") {
        av = a._count.collaborations;
        bv = b._count.collaborations;
      } else {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [users, userSearch, userSort]);

  const filteredHives = useMemo(() => {
    const q = hiveSearch.toLowerCase();
    let list = q
      ? hives.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            (h.owner?.username ?? "").toLowerCase().includes(q),
        )
      : [...hives];
    list.sort((a, b) => {
      const [field, dir] = hiveSort.split("_");
      let av, bv;
      if (field === "title") {
        av = a.title.toLowerCase();
        bv = b.title.toLowerCase();
      } else if (field === "owner") {
        av = (a.owner?.username ?? "").toLowerCase();
        bv = (b.owner?.username ?? "").toLowerCase();
      } else if (field === "collabsCount") {
        av = a._count.collaborators;
        bv = b._count.collaborators;
      } else if (field === "commentsCount") {
        av = a._count.comments;
        bv = b._count.comments;
      } else if (field === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [hives, hiveSearch, hiveSort]);

  useEffect(() => {
    setUsersPage((p) => Math.min(p, getTotalPages(filteredUsers.length)));
  }, [filteredUsers.length]);

  useEffect(() => {
    setHivesPage((p) => Math.min(p, getTotalPages(filteredHives.length)));
  }, [filteredHives.length]);

  const removeUser = async (id) => {
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeHive = async (id) => {
    try {
      await apiFetch(`/admin/hives/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget.type || !deleteTarget.id) return;

    if (deleteTarget.type === "user") {
      await removeUser(deleteTarget.id);
    } else if (deleteTarget.type === "hive") {
      await removeHive(deleteTarget.id);
    }

    setDeleteTarget({ type: null, id: null });
  };

  const saveUser = async () => {
    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: "PATCH",
        token,
        body: {
          username: editingUser.username,
          roleLabel: editingUser.roleLabel,
          roleOtherText: editingUser.roleOtherText || null,
        },
      });
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveHive = async () => {
    try {
      await apiFetch(`/admin/hives/${editingHive.id}`, {
        method: "PATCH",
        token,
        body: { title: editingHive.title },
      });
      setEditingHive(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const usersTotalPages = getTotalPages(filteredUsers.length);
  const hivesTotalPages = getTotalPages(filteredHives.length);

  const pagedUsers = filteredUsers.slice(
    (usersPage - 1) * ITEMS_PER_PAGE,
    usersPage * ITEMS_PER_PAGE,
  );
  const pagedHives = filteredHives.slice(
    (hivesPage - 1) * ITEMS_PER_PAGE,
    hivesPage * ITEMS_PER_PAGE,
  );

  return (
    <section className="page-shell admin-page">
      <h2>Administration</h2>
      {error ? <p className="form-error">{error}</p> : null}

      <h3>Utilisateurs ({filteredUsers.length})</h3>
      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          placeholder="Rechercher (nom, email, rôle)…"
          value={userSearch}
          onChange={(e) => {
            setUserSearch(e.target.value);
            setUsersPage(1);
          }}
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("username", userSort, setUserSort)}
                >
                  Utilisateur
                  {sortIndicator("username", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("email", userSort, setUserSort)}
                >
                  Email{sortIndicator("email", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("roleLabel", userSort, setUserSort)}
                >
                  Rôle{sortIndicator("roleLabel", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("hivesCount", userSort, setUserSort)
                  }
                >
                  Ruches
                  {sortIndicator("hivesCount", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("collabsCount", userSort, setUserSort)
                  }
                >
                  Collabs
                  {sortIndicator("collabsCount", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("createdAt", userSort, setUserSort)}
                >
                  Créé le
                  {sortIndicator("createdAt", userSortField, userSortDir)}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>
                    <strong>{u.username}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.roleLabel}
                    {u.roleLabel === "Autre" && u.roleOtherText
                      ? ` (${u.roleOtherText})`
                      : ""}
                  </td>
                  <td className="admin-num">{u._count.hives}</td>
                  <td className="admin-num">{u._count.collaborations}</td>
                  <td className="admin-date">{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="button-link"
                        onClick={() =>
                          setEditingUser(
                            editingUser?.id === u.id
                              ? null
                              : {
                                  id: u.id,
                                  username: u.username,
                                  roleLabel: u.roleLabel,
                                  roleOtherText: u.roleOtherText || "",
                                },
                          )
                        }
                      >
                        {editingUser?.id === u.id ? "Annuler" : "Modifier"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "user", id: u.id })}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
                {editingUser?.id === u.id ? (
                  <tr className="admin-edit-row">
                    <td colSpan={7}>
                      <div className="form-grid admin-inline-form">
                        <label>
                          {"Nom d'utilisateur"}
                          <input
                            type="text"
                            value={editingUser.username}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                username: e.target.value,
                              })
                            }
                            maxLength={40}
                          />
                        </label>
                        <label>
                          Rôle
                          <select
                            value={editingUser.roleLabel}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                roleLabel: e.target.value,
                              })
                            }
                          >
                            {USER_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </label>
                        {editingUser.roleLabel === "Autre" ? (
                          <label>
                            Précisez
                            <input
                              type="text"
                              value={editingUser.roleOtherText || ""}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  roleOtherText: e.target.value,
                                })
                              }
                              maxLength={120}
                            />
                          </label>
                        ) : null}
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="button-link"
                            disabled={!editingUser.username.trim()}
                            onClick={saveUser}
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length > ITEMS_PER_PAGE ? (
        <div className="inline-actions">
          <button
            type="button"
            onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
            disabled={usersPage === 1}
          >
            Précédent
          </button>
          <span>
            Page {usersPage}/{usersTotalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setUsersPage((p) => Math.min(usersTotalPages, p + 1))
            }
            disabled={usersPage === usersTotalPages}
          >
            Suivant
          </button>
        </div>
      ) : null}

      <h3>Ruches ({filteredHives.length})</h3>
      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          placeholder="Rechercher (titre, propriétaire)…"
          value={hiveSearch}
          onChange={(e) => {
            setHiveSearch(e.target.value);
            setHivesPage(1);
          }}
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("title", hiveSort, setHiveSort)}
                >
                  Titre{sortIndicator("title", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("owner", hiveSort, setHiveSort)}
                >
                  Propriétaire
                  {sortIndicator("owner", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("collabsCount", hiveSort, setHiveSort)
                  }
                >
                  Collabs
                  {sortIndicator("collabsCount", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("commentsCount", hiveSort, setHiveSort)
                  }
                >
                  Commentaires
                  {sortIndicator("commentsCount", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("createdAt", hiveSort, setHiveSort)}
                >
                  Créée le
                  {sortIndicator("createdAt", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("updatedAt", hiveSort, setHiveSort)}
                >
                  Dernière édition
                  {sortIndicator("updatedAt", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedHives.map((hive) => (
              <Fragment key={hive.id}>
                <tr>
                  <td>
                    <strong>{hive.title}</strong>
                  </td>
                  <td>{hive.owner?.username}</td>
                  <td className="admin-num">{hive._count.collaborators}</td>
                  <td className="admin-num">{hive._count.comments}</td>
                  <td className="admin-date">{formatDate(hive.createdAt)}</td>
                  <td className="admin-date">{formatDate(hive.updatedAt)}</td>
                  <td>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="button-link"
                        onClick={() =>
                          setEditingHive(
                            editingHive?.id === hive.id
                              ? null
                              : { id: hive.id, title: hive.title },
                          )
                        }
                      >
                        {editingHive?.id === hive.id ? "Annuler" : "Modifier"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ type: "hive", id: hive.id })
                        }
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
                {editingHive?.id === hive.id ? (
                  <tr className="admin-edit-row">
                    <td colSpan={7}>
                      <div className="form-grid admin-inline-form">
                        <label>
                          Titre
                          <input
                            type="text"
                            value={editingHive.title}
                            onChange={(e) =>
                              setEditingHive({
                                ...editingHive,
                                title: e.target.value,
                              })
                            }
                            maxLength={120}
                          />
                        </label>
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="button-link"
                            disabled={!editingHive.title.trim()}
                            onClick={saveHive}
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingHive(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredHives.length > ITEMS_PER_PAGE ? (
        <div className="inline-actions">
          <button
            type="button"
            onClick={() => setHivesPage((p) => Math.max(1, p - 1))}
            disabled={hivesPage === 1}
          >
            Précédent
          </button>
          <span>
            Page {hivesPage}/{hivesTotalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setHivesPage((p) => Math.min(hivesTotalPages, p + 1))
            }
            disabled={hivesPage === hivesTotalPages}
          >
            Suivant
          </button>
        </div>
      ) : null}

      <UnifiedPromptModal
        isOpen={Boolean(deleteTarget.type && deleteTarget.id)}
        title={
          deleteTarget.type === "user"
            ? "Supprimer l'utilisateur"
            : "Supprimer la ruche"
        }
        message="Cette action est irreversible. Voulez-vous continuer ?"
        confirmLabel="Supprimer"
        confirmClassName="danger"
        onCancel={() => setDeleteTarget({ type: null, id: null })}
        onConfirm={confirmDeleteTarget}
      />
    </section>
  );
}
