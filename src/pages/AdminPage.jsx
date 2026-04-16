import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import { useLanguage } from "../context/LanguageContext";

const ITEMS_PER_PAGE = 10;

function getTotalPages(count) {
  return Math.max(1, Math.ceil(count / ITEMS_PER_PAGE));
}

function formatDate(value, locale) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default function AdminPage() {
  const { token } = useAuth();
  const { t, dateLocale, roleOptions, translateRole } = useLanguage();
  const navigate = useNavigate();

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
  const [doubleConfirm, setDoubleConfirm] = useState(false);

  // Hive details panel (collaborators + comments)
  const [expandedHiveId, setExpandedHiveId] = useState(null);
  const [hiveDetails, setHiveDetails] = useState(null);
  const [hiveDetailsLoading, setHiveDetailsLoading] = useState(false);

  // Remove collaborator confirm
  const [removeCollabTarget, setRemoveCollabTarget] = useState(null);
  // Delete comment confirm
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);
  const [isRemovingCollaborator, setIsRemovingCollaborator] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

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

  const loadHiveDetails = useCallback(
    async (hiveId) => {
      setHiveDetailsLoading(true);
      setHiveDetails(null);
      try {
        const data = await apiFetch(`/admin/hives/${hiveId}/details`, {
          token,
        });
        setHiveDetails(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setHiveDetailsLoading(false);
      }
    },
    [token],
  );

  const toggleHiveDetails = (hiveId) => {
    if (expandedHiveId === hiveId) {
      setExpandedHiveId(null);
      setHiveDetails(null);
    } else {
      setExpandedHiveId(hiveId);
      loadHiveDetails(hiveId);
    }
  };

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
      } else if (field === "firstName") {
        av = (a.firstName ?? "").toLowerCase();
        bv = (b.firstName ?? "").toLowerCase();
      } else if (field === "lastName") {
        av = (a.lastName ?? "").toLowerCase();
        bv = (b.lastName ?? "").toLowerCase();
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
      } else if (field === "lastActivityAt") {
        av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
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
      if (expandedHiveId === id) {
        setExpandedHiveId(null);
        setHiveDetails(null);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDeleteTarget = async () => {
    if (isDeletingTarget) return;
    if (!deleteTarget.type || !deleteTarget.id) return;
    if (!doubleConfirm) {
      setDoubleConfirm(true);
      return;
    }
    setIsDeletingTarget(true);
    try {
      if (deleteTarget.type === "user") {
        await removeUser(deleteTarget.id);
      } else if (deleteTarget.type === "hive") {
        await removeHive(deleteTarget.id);
      }
      setDeleteTarget({ type: null, id: null });
      setDoubleConfirm(false);
    } finally {
      setIsDeletingTarget(false);
    }
  };

  const saveUser = async () => {
    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: "PATCH",
        token,
        body: {
          username: editingUser.username,
          email: editingUser.email,
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
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

  const removeCollaborator = async () => {
    if (!removeCollabTarget || isRemovingCollaborator) return;
    try {
      setIsRemovingCollaborator(true);
      await apiFetch(
        `/admin/hives/${removeCollabTarget.hiveId}/collaborators/${removeCollabTarget.userId}`,
        { method: "DELETE", token },
      );
      setRemoveCollabTarget(null);
      await loadHiveDetails(expandedHiveId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRemovingCollaborator(false);
    }
  };

  const deleteComment = async () => {
    if (!deleteCommentTarget || isDeletingComment) return;
    try {
      setIsDeletingComment(true);
      await apiFetch(
        `/admin/hives/${deleteCommentTarget.hiveId}/comments/${deleteCommentTarget.commentId}`,
        { method: "DELETE", token },
      );
      setDeleteCommentTarget(null);
      await loadHiveDetails(expandedHiveId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeletingComment(false);
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
      <h2>{t("admin.title")}</h2>
      {error ? <p className="form-error">{error}</p> : null}

      <h3>
        {t("admin.users")} ({filteredUsers.length})
      </h3>
      <div className="admin-toolbar">
        <input
          id="admin-users-search"
          name="userSearch"
          aria-label={t("admin.searchUsers")}
          type="search"
          className="admin-search"
          placeholder={t("admin.searchUsers")}
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
                  {t("admin.user")}
                  {sortIndicator("username", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("firstName", userSort, setUserSort)
                  }
                >
                  {t("profile.firstname")}
                  {sortIndicator("firstName", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("lastName", userSort, setUserSort)
                  }
                >
                  {t("profile.lastname")}
                  {sortIndicator("lastName", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("email", userSort, setUserSort)}
                >
                  {t("profile.email")}
                  {sortIndicator("email", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("roleLabel", userSort, setUserSort)}
                >
                  {t("admin.role")}
                  {sortIndicator("roleLabel", userSortField, userSortDir)}
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
                  {t("admin.hiveCount")}
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
                  {t("admin.collabs")}
                  {sortIndicator("collabsCount", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("createdAt", userSort, setUserSort)}
                >
                  {t("admin.createdAt")}
                  {sortIndicator("createdAt", userSortField, userSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() =>
                    toggleSort("lastActivityAt", userSort, setUserSort)
                  }
                >
                  {t("admin.lastActivityAt")}
                  {sortIndicator("lastActivityAt", userSortField, userSortDir)}
                </button>
              </th>
              <th>{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>
                    <strong>{u.username}</strong>
                  </td>
                  <td>{u.firstName || "—"}</td>
                  <td>{u.lastName || "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    {translateRole(u.roleLabel)}
                    {u.roleLabel === "Autre" && u.roleOtherText
                      ? ` (${u.roleOtherText})`
                      : ""}
                  </td>
                  <td className="admin-num">{u._count.hives}</td>
                  <td className="admin-num">{u._count.collaborations}</td>
                  <td className="admin-date">
                    {formatDate(u.createdAt, dateLocale)}
                  </td>
                  <td className="admin-date">
                    {formatDate(u.lastActivityAt, dateLocale)}
                  </td>
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
                                  email: u.email,
                                  firstName: u.firstName,
                                  lastName: u.lastName,
                                  roleLabel: u.roleLabel,
                                  roleOtherText: u.roleOtherText || "",
                                },
                          )
                        }
                      >
                        {editingUser?.id === u.id
                          ? t("admin.cancelEdit")
                          : t("admin.edit")}
                      </button>
                      <button
                        type="button"
                        className="button-link button-link-delete"
                        onClick={() => {
                          setDeleteTarget({ type: "user", id: u.id });
                          setDoubleConfirm(false);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
                {editingUser?.id === u.id ? (
                  <tr className="admin-edit-row">
                    <td colSpan={10}>
                      <form
                        className="form-grid admin-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (
                            !editingUser.username.trim() ||
                            !editingUser.email?.trim()
                          )
                            return;
                          saveUser();
                        }}
                      >
                        <label>
                          {t("profile.username")}
                          <input
                            id="admin-edit-username"
                            name="username"
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
                          {t("profile.email")}
                          <input
                            id="admin-edit-email"
                            name="email"
                            type="email"
                            value={editingUser.email || ""}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                email: e.target.value,
                              })
                            }
                            maxLength={120}
                          />
                        </label>
                        <label>
                          {t("profile.firstname")}
                          <input
                            id="admin-edit-firstname"
                            name="firstName"
                            type="text"
                            value={editingUser.firstName || ""}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                firstName: e.target.value,
                              })
                            }
                            maxLength={80}
                          />
                        </label>
                        <label>
                          {t("profile.lastname")}
                          <input
                            id="admin-edit-lastname"
                            name="lastName"
                            type="text"
                            value={editingUser.lastName || ""}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                lastName: e.target.value,
                              })
                            }
                            maxLength={80}
                          />
                        </label>
                        <label>
                          {t("admin.role")}
                          <select
                            id="admin-edit-role"
                            name="roleLabel"
                            value={editingUser.roleLabel}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                roleLabel: e.target.value,
                              })
                            }
                          >
                            {roleOptions.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {editingUser.roleLabel === "Autre" ? (
                          <label>
                            {t("admin.specify")}
                            <input
                              id="admin-edit-role-other"
                              name="roleOtherText"
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
                            type="submit"
                            className="button-link"
                            disabled={
                              !editingUser.username.trim() ||
                              !editingUser.email?.trim()
                            }
                          >
                            {t("admin.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </form>
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
            {t("common.previous")}
          </button>
          <span>
            {t("common.page")} {usersPage}/{usersTotalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setUsersPage((p) => Math.min(usersTotalPages, p + 1))
            }
            disabled={usersPage === usersTotalPages}
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}

      <h3>
        {t("admin.hives")} ({filteredHives.length})
      </h3>
      <div className="admin-toolbar">
        <input
          id="admin-hives-search"
          name="hiveSearch"
          aria-label={t("admin.searchHives")}
          type="search"
          className="admin-search"
          placeholder={t("admin.searchHives")}
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
                  {t("admin.titleLabel")}
                  {sortIndicator("title", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("owner", hiveSort, setHiveSort)}
                >
                  {t("admin.owner")}
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
                  {t("admin.collabs")}
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
                  {t("admin.comments")}
                  {sortIndicator("commentsCount", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("createdAt", hiveSort, setHiveSort)}
                >
                  {t("profile.createdAt")}
                  {sortIndicator("createdAt", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="admin-sort-btn"
                  onClick={() => toggleSort("updatedAt", hiveSort, setHiveSort)}
                >
                  {t("profile.updatedAt")}
                  {sortIndicator("updatedAt", hiveSortField, hiveSortDir)}
                </button>
              </th>
              <th>{t("admin.actions")}</th>
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
                  <td className="admin-date">
                    {formatDate(hive.createdAt, dateLocale)}
                  </td>
                  <td className="admin-date">
                    {formatDate(hive.updatedAt, dateLocale)}
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="button-link"
                        onClick={() =>
                          navigate(`/admin/hives/${hive.id}`, {
                            state: { adminReadOnly: true },
                          })
                        }
                      >
                        {t("admin.viewHive")}
                      </button>
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
                        {editingHive?.id === hive.id
                          ? t("admin.cancelEdit")
                          : t("admin.edit")}
                      </button>
                      <button
                        type="button"
                        className="button-link"
                        onClick={() => toggleHiveDetails(hive.id)}
                      >
                        {expandedHiveId === hive.id
                          ? t("admin.cancelEdit")
                          : t("admin.hiveDetails")}
                      </button>
                      <button
                        type="button"
                        className="button-link button-link-delete"
                        onClick={() =>
                          setDeleteTarget({ type: "hive", id: hive.id })
                        }
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
                {editingHive?.id === hive.id ? (
                  <tr className="admin-edit-row">
                    <td colSpan={7}>
                      <form
                        className="form-grid admin-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!editingHive.title.trim()) return;
                          saveHive();
                        }}
                      >
                        <label>
                          {t("admin.titleLabel")}
                          <input
                            id="admin-edit-hive-title"
                            name="title"
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
                            type="submit"
                            className="button-link"
                            disabled={!editingHive.title.trim()}
                          >
                            {t("admin.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingHive(null)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
                {expandedHiveId === hive.id ? (
                  <tr className="admin-edit-row">
                    <td colSpan={7}>
                      {hiveDetailsLoading ? (
                        <p>{t("common.loading")}</p>
                      ) : hiveDetails ? (
                        <div className="admin-hive-details">
                          <h4>{t("admin.hiveCollaborators")}</h4>
                          {hiveDetails.collaborators.length === 0 ? (
                            <p>{t("admin.noCollaborators")}</p>
                          ) : (
                            <table className="admin-table admin-details-table">
                              <tbody>
                                {hiveDetails.collaborators.map((c) => (
                                  <tr key={c.id}>
                                    <td>{c.username}</td>
                                    <td>{c.email}</td>
                                    <td>{c.role}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="button-link button-link-delete"
                                        onClick={() =>
                                          setRemoveCollabTarget({
                                            hiveId: hive.id,
                                            userId: c.userId,
                                            username: c.username,
                                          })
                                        }
                                      >
                                        {t("admin.removeCollaborator")}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <h4>{t("admin.hiveComments")}</h4>
                          {hiveDetails.comments.length === 0 ? (
                            <p>{t("admin.noComments")}</p>
                          ) : (
                            <table className="admin-table admin-details-table">
                              <tbody>
                                {hiveDetails.comments.map((c) => (
                                  <Fragment key={c.id}>
                                    <tr>
                                      <td>
                                        <strong>
                                          {c.author?.username ??
                                            t("common.unknownUser")}
                                        </strong>
                                      </td>
                                      <td>{c.message}</td>
                                      <td className="admin-date">
                                        {formatDate(c.createdAt, dateLocale)}
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="button-link button-link-delete"
                                          onClick={() =>
                                            setDeleteCommentTarget({
                                              hiveId: hive.id,
                                              commentId: c.id,
                                            })
                                          }
                                        >
                                          {t("common.delete")}
                                        </button>
                                      </td>
                                    </tr>
                                    {c.replies?.map((r) => (
                                      <tr
                                        key={r.id}
                                        className="admin-reply-row"
                                      >
                                        <td className="admin-reply-indent">
                                          ↳{" "}
                                          <strong>
                                            {r.author?.username ??
                                              t("common.unknownUser")}
                                          </strong>
                                        </td>
                                        <td>{r.message}</td>
                                        <td className="admin-date">
                                          {formatDate(r.createdAt, dateLocale)}
                                        </td>
                                        <td>
                                          <button
                                            type="button"
                                            className="button-link button-link-delete"
                                            onClick={() =>
                                              setDeleteCommentTarget({
                                                hiveId: hive.id,
                                                commentId: r.id,
                                              })
                                            }
                                          >
                                            {t("common.delete")}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ) : null}
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
            {t("common.previous")}
          </button>
          <span>
            {t("common.page")} {hivesPage}/{hivesTotalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setHivesPage((p) => Math.min(hivesTotalPages, p + 1))
            }
            disabled={hivesPage === hivesTotalPages}
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}

      <UnifiedPromptModal
        isOpen={Boolean(deleteTarget.type && deleteTarget.id)}
        title={
          doubleConfirm
            ? t("admin.confirmDeleteFinal")
            : deleteTarget.type === "user"
              ? t("admin.deleteUser")
              : t("admin.deleteHive")
        }
        message={
          doubleConfirm
            ? t("admin.doubleConfirmMessage")
            : t("admin.irreversible")
        }
        confirmLabel={doubleConfirm ? t("common.confirm") : t("common.delete")}
        busy={isDeletingTarget}
        confirmLoadingLabel={t("admin.deleting")}
        confirmClassName="danger"
        onCancel={() => {
          setDeleteTarget({ type: null, id: null });
          setDoubleConfirm(false);
        }}
        onConfirm={confirmDeleteTarget}
      />

      <UnifiedPromptModal
        isOpen={Boolean(removeCollabTarget)}
        title={t("admin.confirmRemoveCollaborator")}
        message={t("admin.confirmRemoveMessage")}
        confirmLabel={t("admin.removeCollaborator")}
        busy={isRemovingCollaborator}
        confirmLoadingLabel={t("admin.removingCollaborator")}
        confirmClassName="danger"
        onCancel={() => setRemoveCollabTarget(null)}
        onConfirm={removeCollaborator}
      />

      <UnifiedPromptModal
        isOpen={Boolean(deleteCommentTarget)}
        title={t("admin.confirmDeleteComment")}
        message={t("admin.irreversible")}
        confirmLabel={t("common.delete")}
        busy={isDeletingComment}
        confirmLoadingLabel={t("admin.deletingComment")}
        confirmClassName="danger"
        onCancel={() => setDeleteCommentTarget(null)}
        onConfirm={deleteComment}
      />
    </section>
  );
}
