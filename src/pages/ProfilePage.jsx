import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import PageLoader from "../components/PageLoader";
import { useLanguage } from "../context/LanguageContext";

const HIVES_PER_PAGE = 10;

function getTotalPages(count) {
  return Math.max(1, Math.ceil(count / HIVES_PER_PAGE));
}

function clampPage(page, count) {
  return Math.min(Math.max(1, page), getTotalPages(count));
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

export default function ProfilePage() {
  const { token, refreshMe, logout } = useAuth();
  const { t, dateLocale, translateRole } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState("");
  const [showDeletePasswords, setShowDeletePasswords] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownedPage, setOwnedPage] = useState(1);
  const [sharedPage, setSharedPage] = useState(1);
  const [creatingHive, setCreatingHive] = useState(false);
  const [newHiveTitle, setNewHiveTitle] = useState("");
  const [duplicatingHiveId, setDuplicatingHiveId] = useState(null);
  const [confirmDeleteHiveId, setConfirmDeleteHiveId] = useState(null);
  const [duplicateDraft, setDuplicateDraft] = useState({
    hiveId: null,
    sourceTitle: "",
    nextTitle: "",
  });

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

  const deleteHive = async () => {
    if (!confirmDeleteHiveId) return;

    await apiFetch(`/hives/${confirmDeleteHiveId}`, {
      method: "DELETE",
      token,
    });
    const data = await refreshMe();
    setProfile(data);
    setConfirmDeleteHiveId(null);
  };

  const openDuplicateHiveModal = (hiveId) => {
    const sourceHive = profile?.ownedHives.find((hive) => hive.id === hiveId);
    const sourceTitle = sourceHive?.title || "Ruche";
    setDuplicateDraft({
      hiveId,
      sourceTitle,
      nextTitle: `${sourceTitle} (${t("profile.copySuffix")})`,
    });
  };

  const duplicateHiveFromProfile = async () => {
    if (!duplicateDraft.hiveId) return;

    const trimmedTitle = duplicateDraft.nextTitle.trim();
    if (!trimmedTitle) {
      setError(t("profile.duplicateNeedTitle"));
      return;
    }

    if (trimmedTitle === duplicateDraft.sourceTitle.trim()) {
      setError(t("profile.duplicateRenameRequired"));
      return;
    }

    try {
      setError("");
      setDuplicatingHiveId(duplicateDraft.hiveId);
      const sourceHive = await apiFetch(`/hives/${duplicateDraft.hiveId}`, {
        token,
      });
      await apiFetch("/hives", {
        method: "POST",
        token,
        body: {
          title: trimmedTitle,
          boardData: sourceHive.boardData,
        },
      });
      const data = await refreshMe();
      setProfile(data);
      setDuplicateDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setDuplicatingHiveId(null);
    }
  };

  const deleteProfile = async (event) => {
    if (event) {
      event.preventDefault();
    }

    const trimmedPassword = deletePassword.trim();
    const trimmedPasswordConfirm = deletePasswordConfirm.trim();

    if (!trimmedPassword || !trimmedPasswordConfirm) {
      setDeleteError(t("profile.missingPasswordFields"));
      return;
    }

    if (trimmedPassword !== trimmedPasswordConfirm) {
      setDeleteError(t("profile.passwordMismatch"));
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
    setShowDeletePasswords(false);
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setDeletePassword("");
    setDeletePasswordConfirm("");
    setShowDeletePasswords(false);
    setDeleteError("");
  };

  const closeCreateHiveModal = () => {
    setCreatingHive(false);
    setNewHiveTitle("");
  };

  const confirmCreateHive = () => {
    const trimmedTitle = newHiveTitle.trim();
    if (!trimmedTitle) return;

    navigate("/hives/new", {
      state: { title: trimmedTitle },
    });
    closeCreateHiveModal();
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
      <h2>{t("profile.title")}</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {profile ? (
        <>
          <p>
            <strong>{t("profile.username")} :</strong> {profile.user.username}
          </p>
          <p>
            <strong>{t("profile.email")} :</strong> {profile.user.email}
          </p>
          <p>
            <strong>{t("profile.role")} :</strong>{" "}
            {translateRole(profile.user.roleLabel)}
            {profile.user.roleLabel === "Autre" && profile.user.roleOtherText
              ? ` - ${profile.user.roleOtherText}`
              : ""}
          </p>

          <div className="inline-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => setCreatingHive(true)}
            >
              {t("profile.createNewHive")}
            </button>
          </div>

          {ownedCount > 0 ? (
            <>
              <h3>{t("profile.myHives")}</h3>
              <ul className="list-grid">
                {pagedOwnedHives.map((hive) => (
                  <li key={hive.id}>
                    <span>
                      <strong>{hive.title}</strong>
                      <br />
                      {t("profile.createdAt")} :{" "}
                      {formatDateTime(hive.createdAt, dateLocale)}
                      <br />
                      {t("profile.updatedAt")} :{" "}
                      {formatDateTime(hive.updatedAt, dateLocale)}
                    </span>
                    <div className="inline-actions">
                      <Link className="button-link" to={`/hives/${hive.id}`}>
                        {t("profile.open")}
                      </Link>
                      <button
                        type="button"
                        className="button-link"
                        onClick={() => openDuplicateHiveModal(hive.id)}
                        disabled={duplicatingHiveId === hive.id}
                      >
                        {duplicatingHiveId === hive.id
                          ? t("profile.duplicating")
                          : t("profile.duplicate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteHiveId(hive.id)}
                      >
                        {t("common.delete")}
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
                    {t("common.previous")}
                  </button>
                  <span>
                    {t("common.page")} {ownedPage}/{ownedTotalPages}
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
                    {t("common.next")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {sharedCount > 0 ? (
            <>
              <h3>{t("profile.sharedHives")}</h3>
              <ul className="list-grid">
                {pagedSharedHives.map((hive) => (
                  <li key={hive.id}>
                    <span>
                      <strong>
                        {hive.title} ({hive.collaboratorRole})
                      </strong>
                      <br />
                      {t("profile.createdAt")} :{" "}
                      {formatDateTime(hive.createdAt, dateLocale)}
                      <br />
                      {t("profile.updatedAt")} :{" "}
                      {formatDateTime(hive.updatedAt, dateLocale)}
                    </span>
                    <Link className="button-link" to={`/hives/${hive.id}`}>
                      {t("profile.open")}
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
                    {t("common.previous")}
                  </button>
                  <span>
                    {t("common.page")} {sharedPage}/{sharedTotalPages}
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
                    {t("common.next")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          <h3>{t("profile.deleteProfileTitle")}</h3>
          <p>{t("profile.deleteProfileDesc")}</p>
          <button
            type="button"
            className="danger-btn"
            onClick={openDeleteModal}
          >
            {t("profile.deleteProfileTitle")}
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
                <h2>{t("profile.confirmDeletion")}</h2>
                <p>{t("profile.enterPasswords")}</p>

                {deleteError ? (
                  <p className="form-error">{deleteError}</p>
                ) : null}

                <form onSubmit={deleteProfile} className="form-grid">
                  <label>
                    {t("register.password")}
                    <input
                      type={showDeletePasswords ? "text" : "password"}
                      value={deletePassword}
                      onChange={(event) =>
                        setDeletePassword(event.target.value)
                      }
                      autoFocus
                      disabled={isDeleting}
                    />
                  </label>

                  <label>
                    {t("profile.confirmPassword")}
                    <input
                      type={showDeletePasswords ? "text" : "password"}
                      value={deletePasswordConfirm}
                      onChange={(event) =>
                        setDeletePasswordConfirm(event.target.value)
                      }
                      disabled={isDeleting}
                    />
                  </label>

                  <button
                    type="button"
                    className="button-link"
                    onClick={() =>
                      setShowDeletePasswords((current) => !current)
                    }
                    disabled={isDeleting}
                  >
                    {showDeletePasswords
                      ? t("profile.hide")
                      : t("profile.show")}
                  </button>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={closeDeleteModal}
                      disabled={isDeleting}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="danger-btn"
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? t("profile.deleting")
                        : t("profile.deleteProfileTitle")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <PageLoader
          title={t("profile.loadingTitle")}
          subtitle={t("profile.loadingSubtitle")}
          variant="profile"
        />
      )}

      <UnifiedPromptModal
        isOpen={Boolean(confirmDeleteHiveId)}
        title={t("profile.modalDeleteHiveTitle")}
        message={t("profile.modalDeleteHiveMessage")}
        confirmLabel={t("common.delete")}
        confirmClassName="danger"
        onCancel={() => setConfirmDeleteHiveId(null)}
        onConfirm={deleteHive}
      />

      <UnifiedPromptModal
        isOpen={Boolean(duplicateDraft.hiveId)}
        mode="prompt"
        title={t("profile.modalDuplicateTitle")}
        message={t("profile.modalDuplicateMessage")}
        inputLabel={t("profile.modalDuplicateInput")}
        value={duplicateDraft.nextTitle}
        onValueChange={(value) =>
          setDuplicateDraft((prev) => ({ ...prev, nextTitle: value }))
        }
        confirmLabel={t("profile.modalDuplicateConfirm")}
        confirmDisabled={!duplicateDraft.nextTitle.trim()}
        onCancel={() =>
          setDuplicateDraft({ hiveId: null, sourceTitle: "", nextTitle: "" })
        }
        onConfirm={duplicateHiveFromProfile}
      />

      <UnifiedPromptModal
        isOpen={creatingHive}
        mode="prompt"
        title={t("profile.modalCreateTitle")}
        message={t("profile.modalCreateMessage")}
        inputLabel={t("profile.modalCreateInput")}
        inputPlaceholder={t("profile.modalCreatePlaceholder")}
        value={newHiveTitle}
        onValueChange={setNewHiveTitle}
        confirmLabel={t("common.confirm")}
        confirmDisabled={!newHiveTitle.trim()}
        onCancel={closeCreateHiveModal}
        onConfirm={confirmCreateHive}
      />
    </section>
  );
}
