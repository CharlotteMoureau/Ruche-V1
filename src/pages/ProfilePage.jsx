import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faPlus,
  faPen,
  faXmark,
  faArrowUpRightFromSquare,
  faDownload,
  faTrash,
  faChevronLeft,
  faChevronRight,
  faFloppyDisk,
  faGear,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import PageLoader from "../components/PageLoader";
import HexCard from "../components/HexCard";
import FreeHexCard from "../components/FreeSpaceCard";
import HivePreview from "../components/HivePreview";
import PasswordField from "../components/PasswordField";
import { useLanguage } from "../context/LanguageContext";
import cardsFr from "../data/cards.json";
import cardsEn from "../data/cards_en.json";
import cardsNl from "../data/cards_nl.json";
import {
  captureBoardPreviewImage,
  captureHiveExportBundle,
  triggerDownload,
  waitForCaptureFrame,
} from "../lib/snapshot";
import { HIVE_KINDS, resolveDefaultHiveKind } from "../lib/hives";

const HIVES_PER_PAGE = 3;
const HIVE_TITLE_MAX_LENGTH = 100;
const CARD_SIZE = 200;
const BOARD_PADDING = 60;
const PROFILE_TAB_HIVES = "hives";
const PROFILE_TAB_SETTINGS = "settings";

function normalizeRoleText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const OTHER_ROLE_KEY = normalizeRoleText("Autre");

function isOtherRoleValue(value, translatedOtherLabel) {
  const key = normalizeRoleText(value);
  if (!key) return false;

  return (
    key === OTHER_ROLE_KEY ||
    key === normalizeRoleText(translatedOtherLabel || "")
  );
}

function resolveRoleFormValue(roleLabel, roleOptions) {
  const normalizedRole = normalizeRoleText(roleLabel);
  if (!normalizedRole) {
    return roleOptions[0]?.value || "";
  }

  const match = roleOptions.find((option) => {
    const optionValue = normalizeRoleText(option.value);
    const optionLabel = normalizeRoleText(option.label);
    return optionValue === normalizedRole || optionLabel === normalizedRole;
  });

  return match?.value || roleLabel;
}

const CATEGORY_KEY_MAP = {
  fr: {
    visees: "visees",
    "conditions-enseignant": "conditions-enseignant",
    "recommandations-enseignant": "recommandations-enseignant",
    "conditions-equipe": "conditions-equipe",
    "recommandations-equipe": "recommandations-equipe",
    domaine: "domaine",
  },
  en: {
    aims: "visees",
    "teacher-conditions": "conditions-enseignant",
    "teacher-recommendations": "recommandations-enseignant",
    "team-conditions": "conditions-equipe",
    "team-recommendations": "recommandations-equipe",
    domain: "domaine",
  },
  nl: {
    doelen: "visees",
    "voorwaarden-leerkracht": "conditions-enseignant",
    "aanbevelingen-leerkracht": "recommandations-enseignant",
    "voorwaarden-team": "conditions-equipe",
    "aanbevelingen-team": "recommandations-equipe",
    domein: "domaine",
  },
};

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

function toCanonicalCards(cards, language) {
  const map = CATEGORY_KEY_MAP[language] || CATEGORY_KEY_MAP.fr;
  return cards.map((card) => ({
    ...card,
    category: map[card.category] || card.category,
  }));
}

function localizeBoardCards(boardCards, cardsData) {
  const cardsById = new Map(cardsData.map((card) => [String(card.id), card]));

  return boardCards.map((card) => {
    if (card.category === "free") return card;

    const localized = cardsById.get(String(card.id));
    if (!localized) return card;

    return {
      ...card,
      title: localized.title,
      definition: localized.definition,
      category: localized.category,
    };
  });
}

function getBoardCards(boardData) {
  return Array.isArray(boardData?.boardCards) ? boardData.boardCards : [];
}

function isRasterPreviewDataUrl(value) {
  return (
    typeof value === "string" &&
    /^data:image\/(webp|jpeg|jpg|png);base64,/i.test(value.trim())
  );
}

function getHiveDateValue(hive) {
  const updatedAt = hive?.updatedAt ? new Date(hive.updatedAt).getTime() : 0;
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    return updatedAt;
  }

  const createdAt = hive?.createdAt ? new Date(hive.createdAt).getTime() : 0;
  return Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0;
}

function sortHives(hives, sortMode, locale) {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const sorted = [...hives];

  sorted.sort((a, b) => {
    if (sortMode === "name-asc") {
      return collator.compare(a?.title || "", b?.title || "");
    }

    if (sortMode === "name-desc") {
      return collator.compare(b?.title || "", a?.title || "");
    }

    const dateA = getHiveDateValue(a);
    const dateB = getHiveDateValue(b);

    if (sortMode === "date-asc") {
      return dateA - dateB;
    }

    return dateB - dateA;
  });

  return sorted;
}

function getCollaboratorRoleLabel(role, t) {
  const normalizedRole = String(role || "")
    .trim()
    .toUpperCase();

  if (normalizedRole === "ADMIN") return t("toolbar.roleAdmin");
  if (normalizedRole === "EDITOR" || normalizedRole === "EDIT") {
    return t("toolbar.roleEdit");
  }
  if (normalizedRole === "COMMENT") return t("toolbar.roleComment");
  if (normalizedRole === "READ") return t("toolbar.roleRead");

  return role || "";
}

function buildDuplicateTitle(sourceTitle, copySuffix) {
  const suffix = ` (${copySuffix})`;
  const baseTitle = String(sourceTitle || "").trim() || "Ruche";

  if (baseTitle.length + suffix.length <= HIVE_TITLE_MAX_LENGTH) {
    return `${baseTitle}${suffix}`;
  }

  const maxBaseLength = Math.max(1, HIVE_TITLE_MAX_LENGTH - suffix.length);
  return `${baseTitle.slice(0, maxBaseLength).trimEnd()}${suffix}`;
}

function getCaptureBoardSize(boardCards) {
  if (boardCards.length === 0) {
    return { width: 1200, height: 760 };
  }

  let maxX = 0;
  let maxY = 0;

  boardCards.forEach((card) => {
    const x = Number(card?.position?.x) || 0;
    const y = Number(card?.position?.y) || 0;
    maxX = Math.max(maxX, x + CARD_SIZE);
    maxY = Math.max(maxY, y + CARD_SIZE);
  });

  return {
    width: Math.max(1200, Math.round(maxX + BOARD_PADDING)),
    height: Math.max(760, Math.round(maxY + BOARD_PADDING)),
  };
}

function ProfileCaptureBoard({ boardData }) {
  const boardCards = getBoardCards(boardData);
  const boardSize = getCaptureBoardSize(boardCards);

  return (
    <main
      className="hive-board profile-capture-board"
      style={{
        position: "relative",
        width: `${boardSize.width}px`,
        height: `${boardSize.height}px`,
      }}
    >
      {boardCards.map((card) => {
        const position = {
          x: Number(card?.position?.x) || 0,
          y: Number(card?.position?.y) || 0,
        };

        return (
          <div
            key={
              card?.id ||
              `${card?.category || "card"}-${position.x}-${position.y}`
            }
            className="draggable-card"
            style={{
              position: "absolute",
              left: position.x,
              top: position.y,
              zIndex: 1000,
              width: `${CARD_SIZE}px`,
              height: `${CARD_SIZE}px`,
            }}
          >
            {card?.category === "free" ? (
              <FreeHexCard card={card} />
            ) : (
              <HexCard card={card} />
            )}
          </div>
        );
      })}
    </main>
  );
}

export default function ProfilePage() {
  const { token, user, refreshMe, logout } = useAuth();
  const { language, t, dateLocale, translateRole, roleOptions } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [roleSuccessMessage, setRoleSuccessMessage] = useState("");
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownedPage, setOwnedPage] = useState(1);
  const [sharedPage, setSharedPage] = useState(1);
  const [selectingHiveType, setSelectingHiveType] = useState(false);
  const [selectedHiveKind, setSelectedHiveKind] = useState(null);
  const [creatingHive, setCreatingHive] = useState(false);
  const [newHiveTitle, setNewHiveTitle] = useState("");
  const [duplicatingHiveId, setDuplicatingHiveId] = useState(null);
  const [deletingHiveId, setDeletingHiveId] = useState(null);
  const [downloadingHiveId, setDownloadingHiveId] = useState(null);
  const [renamingHiveId, setRenamingHiveId] = useState(null);
  const [confirmDeleteHiveId, setConfirmDeleteHiveId] = useState(null);
  const [renameDraft, setRenameDraft] = useState({
    hiveId: null,
    sourceTitle: "",
    nextTitle: "",
  });
  const [renameOrDuplicateDraft, setRenameOrDuplicateDraft] = useState({
    hiveId: null,
    sourceTitle: "",
    nextTitle: "",
  });
  const [duplicateDraft, setDuplicateDraft] = useState({
    hiveId: null,
    sourceTitle: "",
    nextTitle: "",
  });
  const [roleForm, setRoleForm] = useState({ role: "", roleOtherText: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [ownedSearchQuery, setOwnedSearchQuery] = useState("");
  const [sharedSearchQuery, setSharedSearchQuery] = useState("");
  const [ownedSortMode, setOwnedSortMode] = useState("date-desc");
  const [sharedSortMode, setSharedSortMode] = useState("date-desc");
  const [activeProfileTab, setActiveProfileTab] = useState(PROFILE_TAB_HIVES);
  const [isLoadingProfile, setIsLoadingProfile] = useState(() =>
    Boolean(token),
  );
  const hydratedRoleFormUserIdRef = useRef(null);
  const defaultHiveKind = resolveDefaultHiveKind(profile?.user?.roleLabel);
  const isDcoProfile = defaultHiveKind === HIVE_KINDS.DCO;
  const localizedOtherRoleLabel = translateRole("Autre");

  useEffect(() => {
    if (!user) {
      setProfile(null);
      hydratedRoleFormUserIdRef.current = null;
      return;
    }

    setProfile((current) => {
      if (!current) {
        return current;
      }

      if (current.user?.id === user.id) {
        return {
          ...current,
          user,
        };
      }

      hydratedRoleFormUserIdRef.current = null;
      return null;
    });
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) {
        if (mounted) {
          setProfile(null);
          setIsLoadingProfile(false);
        }
        return;
      }

      if (mounted) {
        setError("");
      }
      setIsLoadingProfile(true);
      try {
        const data = await refreshMe();
        if (mounted) setProfile(data);
      } catch (err) {
        if (mounted) {
          setProfile(null);
          setError(err.message);
        }
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token, refreshMe]);

  useEffect(() => {
    if (!profile) return;

    setOwnedPage((current) => clampPage(current, profile.ownedHives.length));
    setSharedPage((current) => clampPage(current, profile.sharedHives.length));

    const canonicalRole = resolveRoleFormValue(
      profile.user.roleLabel,
      roleOptions,
    );
    const roleOtherText = profile.user.roleOtherText || "";
    const profileUserId = profile.user?.id || "profile-user";

    if (hydratedRoleFormUserIdRef.current === profileUserId) {
      return;
    }

    hydratedRoleFormUserIdRef.current = profileUserId;

    setRoleForm((current) => {
      if (
        current.role === canonicalRole &&
        current.roleOtherText === roleOtherText
      ) {
        return current;
      }

      return {
        role: canonicalRole,
        roleOtherText,
      };
    });
  }, [profile, roleOptions]);

  const updateRole = async (event) => {
    event.preventDefault();

    const selectedRole = roleForm.role;
    const trimmedRoleOtherText = roleForm.roleOtherText.trim();
    const roleRequiresOtherText = isOtherRoleValue(
      selectedRole,
      localizedOtherRoleLabel,
    );

    if (!selectedRole) {
      setError(t("profile.roleRequired"));
      return;
    }

    if (roleRequiresOtherText && !trimmedRoleOtherText) {
      setError(t("profile.roleOtherRequired"));
      return;
    }

    try {
      setError("");
      setRoleSuccessMessage("");
      setIsUpdatingRole(true);

      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        body: {
          role: selectedRole,
          roleOtherText: roleRequiresOtherText ? trimmedRoleOtherText : "",
        },
      });

      const data = await refreshMe();
      setProfile(data);
      setRoleForm({
        role: resolveRoleFormValue(data?.user?.roleLabel, roleOptions),
        roleOtherText: data?.user?.roleOtherText || "",
      });
      setRoleSuccessMessage(t("profile.updateSuccess"));
      setPasswordSuccessMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const newPasswordConfirm = passwordForm.newPasswordConfirm.trim();

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setError(t("profile.passwordUpdateRequiredFields"));
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError(t("profile.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("profile.passwordTooShort"));
      return;
    }

    try {
      setError("");
      setPasswordSuccessMessage("");
      setIsUpdatingPassword(true);

      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        body: {
          currentPassword,
          newPassword,
          newPasswordConfirm,
        },
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        newPasswordConfirm: "",
      });
      setPasswordSuccessMessage(t("profile.passwordUpdateSuccess"));
      setRoleSuccessMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const deleteHive = async () => {
    if (!confirmDeleteHiveId) return;

    const hiveId = confirmDeleteHiveId;

    try {
      setError("");
      setDeletingHiveId(hiveId);
      await apiFetch(`/hives/${hiveId}`, {
        method: "DELETE",
        token,
      });
      const data = await refreshMe();
      setProfile(data);
      setConfirmDeleteHiveId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingHiveId(null);
    }
  };

  const openDuplicateHiveModal = (hiveId) => {
    const sourceHive = profile?.ownedHives.find((hive) => hive.id === hiveId);
    const sourceTitle = sourceHive?.title || "Ruche";
    setDuplicateDraft({
      hiveId,
      sourceTitle,
      nextTitle: buildDuplicateTitle(sourceTitle, t("profile.copySuffix")),
    });
  };

  const openRenameHiveModal = (hive) => {
    if (!hive?.id) return;

    const sourceTitle = hive.title || "";
    setRenameDraft({
      hiveId: hive.id,
      sourceTitle,
      nextTitle: sourceTitle,
    });
  };

  const confirmRenameDraftFromProfile = () => {
    if (!renameDraft.hiveId) return;

    const trimmedTitle = renameDraft.nextTitle.trim();
    if (!trimmedTitle) {
      setError(t("editor.saveTitleError"));
      return;
    }

    if (trimmedTitle === renameDraft.sourceTitle.trim()) {
      setRenameDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
      return;
    }

    setRenameOrDuplicateDraft({
      hiveId: renameDraft.hiveId,
      sourceTitle: renameDraft.sourceTitle,
      nextTitle: trimmedTitle,
    });
    setRenameDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
  };

  const renameExistingHiveFromProfile = async () => {
    if (renamingHiveId || duplicatingHiveId) return;
    if (!renameOrDuplicateDraft.hiveId) return;

    const trimmedTitle = renameOrDuplicateDraft.nextTitle.trim();
    if (!trimmedTitle) return;

    const hiveId = renameOrDuplicateDraft.hiveId;

    try {
      setError("");
      setRenamingHiveId(hiveId);

      const sourceHive = await apiFetch(`/hives/${hiveId}`, { token });

      await apiFetch(`/hives/${hiveId}`, {
        method: "PUT",
        token,
        body: {
          title: trimmedTitle,
          kind: sourceHive?.kind,
          boardData: sourceHive?.boardData,
          boardPreviewImage: sourceHive?.boardPreviewImage,
          expectedUpdatedAt: sourceHive?.updatedAt,
        },
      });

      const data = await refreshMe();
      setProfile(data);
      setRenameOrDuplicateDraft({
        hiveId: null,
        sourceTitle: "",
        nextTitle: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRenamingHiveId(null);
    }
  };

  const createCopyFromRenameDraft = async () => {
    if (renamingHiveId || duplicatingHiveId) return;
    if (!renameOrDuplicateDraft.hiveId) return;

    const trimmedTitle = renameOrDuplicateDraft.nextTitle.trim();
    if (!trimmedTitle) {
      setError(t("profile.duplicateNeedTitle"));
      return;
    }

    if (trimmedTitle.length > HIVE_TITLE_MAX_LENGTH) {
      setError(t("apiErrors.HIVE_TITLE_TOO_LONG"));
      return;
    }

    if (trimmedTitle === renameOrDuplicateDraft.sourceTitle.trim()) {
      setError(t("profile.duplicateRenameRequired"));
      return;
    }

    try {
      setError("");
      setDuplicatingHiveId(renameOrDuplicateDraft.hiveId);
      const sourceHive = await apiFetch(
        `/hives/${renameOrDuplicateDraft.hiveId}`,
        {
          token,
        },
      );

      let boardPreviewImage = sourceHive.boardPreviewImage;

      if (!isRasterPreviewDataUrl(boardPreviewImage)) {
        const stage = document.createElement("div");
        stage.className = "profile-capture-stage";
        document.body.appendChild(stage);

        const root = createRoot(stage);

        try {
          root.render(<ProfileCaptureBoard boardData={sourceHive.boardData} />);
          await waitForCaptureFrame();
          await waitForCaptureFrame();

          const board = stage.querySelector(".hive-board");
          if (board) {
            boardPreviewImage = await captureBoardPreviewImage(board, {
              maxWidth: 800,
              maxHeight: 450,
              sourceScale: 2,
              quality: 0.76,
              maxBytes: 170 * 1024,
            });
          }
        } finally {
          root.unmount();
          stage.remove();
        }
      }

      await apiFetch("/hives", {
        method: "POST",
        token,
        body: {
          title: trimmedTitle,
          kind: sourceHive.kind,
          boardData: sourceHive.boardData,
          boardPreviewImage,
        },
      });
      const data = await refreshMe();
      setProfile(data);
      setRenameOrDuplicateDraft({
        hiveId: null,
        sourceTitle: "",
        nextTitle: "",
      });
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    } finally {
      setDuplicatingHiveId(null);
    }
  };

  const duplicateHiveFromProfile = async () => {
    if (!duplicateDraft.hiveId) return;

    const trimmedTitle = duplicateDraft.nextTitle.trim();
    if (!trimmedTitle) {
      setError(t("profile.duplicateNeedTitle"));
      return;
    }

    if (trimmedTitle.length > HIVE_TITLE_MAX_LENGTH) {
      setError(t("apiErrors.HIVE_TITLE_TOO_LONG"));
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

      let boardPreviewImage = sourceHive.boardPreviewImage;

      if (!isRasterPreviewDataUrl(boardPreviewImage)) {
        const stage = document.createElement("div");
        stage.className = "profile-capture-stage";
        document.body.appendChild(stage);

        const root = createRoot(stage);

        try {
          root.render(<ProfileCaptureBoard boardData={sourceHive.boardData} />);
          await waitForCaptureFrame();
          await waitForCaptureFrame();

          const board = stage.querySelector(".hive-board");
          if (board) {
            boardPreviewImage = await captureBoardPreviewImage(board, {
              maxWidth: 800,
              maxHeight: 450,
              sourceScale: 2,
              quality: 0.76,
              maxBytes: 170 * 1024,
            });
          }
        } finally {
          root.unmount();
          stage.remove();
        }
      }

      await apiFetch("/hives", {
        method: "POST",
        token,
        body: {
          title: trimmedTitle,
          kind: sourceHive.kind,
          boardData: sourceHive.boardData,
          boardPreviewImage,
        },
      });
      const data = await refreshMe();
      setProfile(data);
      setDuplicateDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
    } catch (err) {
      setError(getApiErrorMessage(err, t));
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

  const closeCreateHiveModal = () => {
    setCreatingHive(false);
    setNewHiveTitle("");
    setSelectedHiveKind(null);
  };

  const handleCreateHiveClick = () => {
    if (isDcoProfile) {
      setSelectingHiveType(true);
    } else {
      setCreatingHive(true);
    }
  };

  const confirmHiveType = (kind) => {
    setSelectedHiveKind(kind);
    setSelectingHiveType(false);
    setCreatingHive(true);
  };

  const downloadHiveSnapshot = async (hiveId, fallbackTitle) => {
    if (!hiveId || downloadingHiveId) return;

    setError("");
    setDownloadingHiveId(hiveId);

    const stage = document.createElement("div");
    stage.className = "profile-capture-stage";
    document.body.appendChild(stage);

    const root = createRoot(stage);

    try {
      const hiveData = await apiFetch(`/hives/${hiveId}`, { token });
      const localizedCardsData =
        language === "en" ? cardsEn : language === "nl" ? cardsNl : cardsFr;
      const cardsData = toCanonicalCards(localizedCardsData, language);
      const localizedBoardCards = localizeBoardCards(
        getBoardCards(hiveData.boardData),
        cardsData,
      );
      const localizedBoardData = {
        ...(hiveData.boardData || {}),
        boardCards: localizedBoardCards,
      };

      root.render(<ProfileCaptureBoard boardData={localizedBoardData} />);
      await waitForCaptureFrame();
      await waitForCaptureFrame();

      const board = stage.querySelector(".hive-board");
      const { blob, fileName } = await captureHiveExportBundle({
        board,
        title: hiveData.title || fallbackTitle,
        comments: hiveData.comments || [],
        boardCards: localizedBoardCards,
        frontBoardFileName: t("toolbar.frontBoardExportName"),
        backBoardFileName: t("toolbar.backBoardExportName"),
        chatFileName: t("toolbar.chatExportName"),
        cardNotesFileName: t("toolbar.cardNotesExportName"),
        chatTitle: t("editor.commentsTitle"),
        noCommentsMessage: t("editor.noComments"),
        cardNotesTitle: t("toolbar.cardNotesExportTitle"),
        noCardNotesMessage: t("toolbar.noCardNotesExport"),
        cardLabel: t("workspace.cardLabel"),
        unknownUserLabel: t("common.unknownUser"),
        formatDateTime: (value) => formatDateTime(value, dateLocale),
        formatCreatedByText: ({ createdAt, createdBy }) =>
          t("workspace.createdBy", {
            date: formatDateTime(createdAt, dateLocale),
            user: createdBy,
          }),
        formatUpdatedByText: ({ updatedAt, updatedBy }) =>
          t("workspace.updatedBy", {
            date: formatDateTime(updatedAt, dateLocale),
            user: updatedBy,
          }),
      });

      triggerDownload(blob, fileName);
    } catch (err) {
      setError(
        t("profile.downloadFailed", {
          message: err?.message || "unknown",
        }),
      );
    } finally {
      root.unmount();
      stage.remove();
      setDownloadingHiveId(null);
    }
  };

  const confirmCreateHive = () => {
    const trimmedTitle = newHiveTitle.trim();
    if (!trimmedTitle) return;

    const hiveKind = isDcoProfile
      ? selectedHiveKind || HIVE_KINDS.STANDARD
      : defaultHiveKind;

    navigate("/hives/new", {
      state: { title: trimmedTitle, hiveKind },
    });
    closeCreateHiveModal();
  };

  const ownedBaseHives = useMemo(
    () => (profile ? profile.ownedHives : []),
    [profile],
  );
  const sharedBaseHives = useMemo(
    () => (profile ? profile.sharedHives : []),
    [profile],
  );

  const { sortedOwnedHives, sortedSharedHives } = useMemo(() => {
    const ownedNormalizedSearch = ownedSearchQuery.trim().toLowerCase();
    const sharedNormalizedSearch = sharedSearchQuery.trim().toLowerCase();

    const filtered = {
      owned: ownedBaseHives.filter((hive) =>
        (hive?.title || "").toLowerCase().includes(ownedNormalizedSearch),
      ),
      shared: sharedBaseHives.filter((hive) =>
        (hive?.title || "").toLowerCase().includes(sharedNormalizedSearch),
      ),
    };

    return {
      sortedOwnedHives: sortHives(filtered.owned, ownedSortMode, dateLocale),
      sortedSharedHives: sortHives(filtered.shared, sharedSortMode, dateLocale),
    };
  }, [
    ownedBaseHives,
    sharedBaseHives,
    ownedSearchQuery,
    sharedSearchQuery,
    ownedSortMode,
    sharedSortMode,
    dateLocale,
  ]);

  useEffect(() => {
    setOwnedPage((current) => clampPage(current, sortedOwnedHives.length));
  }, [sortedOwnedHives.length]);

  useEffect(() => {
    setSharedPage((current) => clampPage(current, sortedSharedHives.length));
  }, [sortedSharedHives.length]);

  const ownedTotalPages = profile ? getTotalPages(sortedOwnedHives.length) : 1;
  const sharedTotalPages = profile
    ? getTotalPages(sortedSharedHives.length)
    : 1;
  const ownedCount = ownedBaseHives.length;
  const sharedCount = sharedBaseHives.length;
  const ownedVisibleCount = sortedOwnedHives.length;
  const sharedVisibleCount = sortedSharedHives.length;

  const { pagedOwnedHives, pagedSharedHives } = useMemo(() => {
    return {
      pagedOwnedHives: sortedOwnedHives.slice(
        (ownedPage - 1) * HIVES_PER_PAGE,
        ownedPage * HIVES_PER_PAGE,
      ),
      pagedSharedHives: sortedSharedHives.slice(
        (sharedPage - 1) * HIVES_PER_PAGE,
        sharedPage * HIVES_PER_PAGE,
      ),
    };
  }, [sortedOwnedHives, sortedSharedHives, ownedPage, sharedPage]);

  return (
    <section className="page-shell profile-page">
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
            {isOtherRoleValue(
              profile.user.roleLabel,
              localizedOtherRoleLabel,
            ) && profile.user.roleOtherText
              ? ` - ${profile.user.roleOtherText}`
              : ""}
          </p>

          <div
            className="profile-tabs"
            role="tablist"
            aria-label={t("profile.title")}
          >
            <button
              id="profile-tab-hives"
              type="button"
              role="tab"
              className={`profile-tab ${activeProfileTab === PROFILE_TAB_HIVES ? "is-active" : ""
                }`}
              aria-selected={activeProfileTab === PROFILE_TAB_HIVES}
              aria-controls="profile-panel-hives"
              onClick={() => setActiveProfileTab(PROFILE_TAB_HIVES)}
            >
              <FontAwesomeIcon icon={faHouse} />
              {t("profile.hivesTab")}
            </button>
            <button
              id="profile-tab-settings"
              type="button"
              role="tab"
              className={`profile-tab ${activeProfileTab === PROFILE_TAB_SETTINGS ? "is-active" : ""
                }`}
              aria-selected={activeProfileTab === PROFILE_TAB_SETTINGS}
              aria-controls="profile-panel-settings"
              onClick={() => setActiveProfileTab(PROFILE_TAB_SETTINGS)}
            >
              <FontAwesomeIcon icon={faGear} />
              {t("profile.settingsTab")}
            </button>
          </div>

          {activeProfileTab === PROFILE_TAB_HIVES ? (
            <section
              id="profile-panel-hives"
              role="tabpanel"
              aria-labelledby="profile-tab-hives"
              className="profile-tab-panel"
            >
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-link"
                  onClick={handleCreateHiveClick}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  {t("profile.createNewHive")}
                </button>
              </div>

              {ownedCount > 0 ? (
                <>
                  <h3>{t("profile.myHives")}</h3>
                  <div className="hive-list-controls">
                    <div className="hive-list-controls__group hive-list-controls__search">
                      <label
                        className="hive-list-controls__label"
                        htmlFor="owned-hive-search"
                      >
                        {t("profile.searchLabel")}
                      </label>
                      <div className="hive-list-controls__search-row">
                        <input
                          id="owned-hive-search"
                          className="hive-list-controls__input"
                          type="search"
                          value={ownedSearchQuery}
                          onChange={(event) => {
                            setOwnedSearchQuery(event.target.value);
                            setOwnedPage(1);
                          }}
                          placeholder={t("profile.searchPlaceholder")}
                        />
                        {ownedSearchQuery.trim() ? (
                          <button
                            type="button"
                            className="button-link hive-search-clear"
                            onClick={() => {
                              setOwnedSearchQuery("");
                              setOwnedPage(1);
                            }}
                          >
                            <FontAwesomeIcon icon={faXmark} />
                            {t("profile.clearSearch")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="hive-list-controls__group hive-list-controls__sort">
                      <label
                        className="hive-list-controls__label"
                        htmlFor="owned-hive-sort"
                      >
                        {t("profile.sortLabel")}
                      </label>
                      <select
                        id="owned-hive-sort"
                        className="hive-list-controls__select"
                        value={ownedSortMode}
                        onChange={(event) => {
                          setOwnedSortMode(event.target.value);
                          setOwnedPage(1);
                        }}
                      >
                        <option value="date-desc">
                          {t("profile.sortDateDesc")}
                        </option>
                        <option value="date-asc">
                          {t("profile.sortDateAsc")}
                        </option>
                        <option value="name-asc">
                          {t("profile.sortNameAsc")}
                        </option>
                        <option value="name-desc">
                          {t("profile.sortNameDesc")}
                        </option>
                      </select>
                    </div>
                  </div>
                  {ownedVisibleCount > 0 ? (
                    <ul className="list-grid">
                      {pagedOwnedHives.map((hive) => (
                        <li key={hive.id}>
                          <div className="hive-details">
                            <div className="hive-title-row">
                              <strong>{hive.title}</strong>
                              <button
                                type="button"
                                className="hive-rename-trigger"
                                onClick={() => openRenameHiveModal(hive)}
                                aria-label={t("profile.renameHive")}
                                title={t("profile.renameHive")}
                                disabled={
                                  Boolean(renamingHiveId) ||
                                  Boolean(duplicatingHiveId)
                                }
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                            </div>
                            <br />
                            {t("profile.createdAt")} :{" "}
                            {formatDateTime(hive.createdAt, dateLocale)}
                            <br />
                            {t("profile.updatedAt")} :{" "}
                            {formatDateTime(hive.updatedAt, dateLocale)}
                            <div className="hive-preview" aria-hidden="true">
                              <HivePreview
                                previewImage={hive.boardPreviewImage}
                                snapshot={hive.boardSnapshot}
                                emptyLabel={t("profile.emptyHive")}
                              />
                            </div>
                          </div>
                          <div className="inline-actions">
                            <Link
                              className="button-link button-link-open"
                              to={`/hives/${hive.id}`}
                            >
                              <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                              />
                              {t("profile.open")}
                            </Link>
                            <button
                              type="button"
                              className="button-link button-link-duplicate"
                              onClick={() => openDuplicateHiveModal(hive.id)}
                              disabled={duplicatingHiveId === hive.id}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                              {duplicatingHiveId === hive.id
                                ? t("profile.duplicating")
                                : t("profile.duplicate")}
                            </button>
                            <button
                              type="button"
                              className="button-link button-link-download"
                              onClick={() =>
                                downloadHiveSnapshot(hive.id, hive.title)
                              }
                              disabled={downloadingHiveId === hive.id}
                            >
                              <FontAwesomeIcon icon={faDownload} />
                              {downloadingHiveId === hive.id
                                ? t("profile.downloading")
                                : t("profile.download")}
                            </button>
                            <button
                              type="button"
                              className="button-link button-link-delete"
                              onClick={() => setConfirmDeleteHiveId(hive.id)}
                              disabled={Boolean(deletingHiveId)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                              {deletingHiveId === hive.id
                                ? t("profile.deleting")
                                : t("common.delete")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("profile.noSearchResults")}</p>
                  )}
                  {ownedVisibleCount > HIVES_PER_PAGE ? (
                    <div className="inline-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setOwnedPage((current) => Math.max(1, current - 1))
                        }
                        disabled={ownedPage === 1}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
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
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {sharedCount > 0 ? (
                <>
                  <h3>{t("profile.sharedHives")}</h3>
                  <div className="hive-list-controls">
                    <div className="hive-list-controls__group hive-list-controls__search">
                      <label
                        className="hive-list-controls__label"
                        htmlFor="shared-hive-search"
                      >
                        {t("profile.searchLabel")}
                      </label>
                      <div className="hive-list-controls__search-row">
                        <input
                          id="shared-hive-search"
                          className="hive-list-controls__input"
                          type="search"
                          value={sharedSearchQuery}
                          onChange={(event) => {
                            setSharedSearchQuery(event.target.value);
                            setSharedPage(1);
                          }}
                          placeholder={t("profile.searchPlaceholder")}
                        />
                        {sharedSearchQuery.trim() ? (
                          <button
                            type="button"
                            className="button-link hive-search-clear"
                            onClick={() => {
                              setSharedSearchQuery("");
                              setSharedPage(1);
                            }}
                          >
                            <FontAwesomeIcon icon={faXmark} />
                            {t("profile.clearSearch")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="hive-list-controls__group hive-list-controls__sort">
                      <label
                        className="hive-list-controls__label"
                        htmlFor="shared-hive-sort"
                      >
                        {t("profile.sortLabel")}
                      </label>
                      <select
                        id="shared-hive-sort"
                        className="hive-list-controls__select"
                        value={sharedSortMode}
                        onChange={(event) => {
                          setSharedSortMode(event.target.value);
                          setSharedPage(1);
                        }}
                      >
                        <option value="date-desc">
                          {t("profile.sortDateDesc")}
                        </option>
                        <option value="date-asc">
                          {t("profile.sortDateAsc")}
                        </option>
                        <option value="name-asc">
                          {t("profile.sortNameAsc")}
                        </option>
                        <option value="name-desc">
                          {t("profile.sortNameDesc")}
                        </option>
                      </select>
                    </div>
                  </div>
                  {sharedVisibleCount > 0 ? (
                    <ul className="list-grid">
                      {pagedSharedHives.map((hive) => (
                        <li key={hive.id}>
                          <div className="hive-details">
                            <div className="hive-title-row">
                              <strong>
                                {hive.title} (
                                {getCollaboratorRoleLabel(
                                  hive.collaboratorRole,
                                  t,
                                )}
                                )
                              </strong>
                              {hive.collaboratorRole === "ADMIN" ? (
                                <button
                                  type="button"
                                  className="hive-rename-trigger"
                                  onClick={() => openRenameHiveModal(hive)}
                                  aria-label={t("profile.renameHive")}
                                  title={t("profile.renameHive")}
                                  disabled={
                                    Boolean(renamingHiveId) ||
                                    Boolean(duplicatingHiveId)
                                  }
                                >
                                  <FontAwesomeIcon icon={faPen} />
                                </button>
                              ) : null}
                            </div>
                            <br />
                            {t("profile.createdAt")} :{" "}
                            {formatDateTime(hive.createdAt, dateLocale)}
                            <br />
                            {t("profile.updatedAt")} :{" "}
                            {formatDateTime(hive.updatedAt, dateLocale)}
                            <div className="hive-preview" aria-hidden="true">
                              <HivePreview
                                previewImage={hive.boardPreviewImage}
                                snapshot={hive.boardSnapshot}
                                emptyLabel={t("profile.emptyHive")}
                              />
                            </div>
                          </div>
                          <div className="inline-actions">
                            <Link
                              className="button-link button-link-open"
                              to={`/hives/${hive.id}`}
                            >
                              <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                              />
                              {t("profile.open")}
                            </Link>
                            <button
                              type="button"
                              className="button-link button-link-download"
                              onClick={() =>
                                downloadHiveSnapshot(hive.id, hive.title)
                              }
                              disabled={downloadingHiveId === hive.id}
                            >
                              <FontAwesomeIcon icon={faDownload} />
                              {downloadingHiveId === hive.id
                                ? t("profile.downloading")
                                : t("profile.download")}
                            </button>
                            {hive.collaboratorRole === "ADMIN" ? (
                              <button
                                type="button"
                                className="button-link button-link-delete"
                                onClick={() => setConfirmDeleteHiveId(hive.id)}
                                disabled={Boolean(deletingHiveId)}
                              >
                                <FontAwesomeIcon icon={faTrash} />
                                {deletingHiveId === hive.id
                                  ? t("profile.deleting")
                                  : t("common.delete")}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("profile.noSearchResults")}</p>
                  )}
                  {sharedVisibleCount > HIVES_PER_PAGE ? (
                    <div className="inline-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setSharedPage((current) => Math.max(1, current - 1))
                        }
                        disabled={sharedPage === 1}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
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
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          {activeProfileTab === PROFILE_TAB_SETTINGS ? (
            <section
              id="profile-panel-settings"
              role="tabpanel"
              aria-labelledby="profile-tab-settings"
              className="profile-tab-panel"
            >
              <section className="profile-modify-section">
                <h3>{t("profile.modifyProfileTitle")}</h3>
                <p>{t("profile.modifyProfileDesc")}</p>

                <h4>{t("profile.changeRole")}</h4>
                <form
                  onSubmit={updateRole}
                  className="form-grid profile-role-form"
                >
                  <div className="profile-role-controls">
                    <div className="profile-role-controls__group">
                      <label
                        className="profile-role-controls__label"
                        htmlFor="profile-role-select"
                      >
                        {t("register.role")}
                      </label>
                      <select
                        id="profile-role-select"
                        className="profile-role-controls__select"
                        value={roleForm.role}
                        onChange={(event) =>
                          setRoleForm((prev) => ({
                            ...prev,
                            role: event.target.value,
                          }))
                        }
                        disabled={isUpdatingRole}
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isOtherRoleValue(
                      roleForm.role,
                      localizedOtherRoleLabel,
                    ) ? (
                      <div className="profile-role-controls__group">
                        <label
                          className="profile-role-controls__label"
                          htmlFor="profile-role-other"
                        >
                          {t("register.roleOther")}
                        </label>
                        <input
                          id="profile-role-other"
                          className="profile-role-controls__input"
                          value={roleForm.roleOtherText}
                          onChange={(event) =>
                            setRoleForm((prev) => ({
                              ...prev,
                              roleOtherText: event.target.value,
                            }))
                          }
                          disabled={isUpdatingRole}
                          required
                        />
                      </div>
                    ) : null}
                  </div>

                  {roleSuccessMessage ? (
                    <p
                      className="form-success profile-inline-feedback"
                      role="status"
                      aria-live="polite"
                    >
                      {roleSuccessMessage}
                    </p>
                  ) : null}

                  <div className="inline-actions">
                    <button type="submit" disabled={isUpdatingRole}>
                      <FontAwesomeIcon icon={faFloppyDisk} />
                      {isUpdatingRole
                        ? t("profile.updatingRole")
                        : t("profile.updateRole")}
                    </button>
                  </div>
                </form>

                <h4>{t("profile.changePassword")}</h4>
                <form onSubmit={updatePassword} className="form-grid">
                  <PasswordField
                    label={t("profile.currentPassword")}
                    id="profile-current-password"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        currentPassword: event.target.value,
                      }))
                    }
                    required
                    minLength={1}
                    autoComplete="current-password"
                  />

                  <PasswordField
                    label={t("profile.newPassword")}
                    id="profile-new-password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />

                  <PasswordField
                    label={t("profile.newPasswordConfirm")}
                    id="profile-new-password-confirm"
                    name="newPasswordConfirm"
                    value={passwordForm.newPasswordConfirm}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPasswordConfirm: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />

                  {passwordSuccessMessage ? (
                    <p
                      className="form-success profile-inline-feedback"
                      role="status"
                      aria-live="polite"
                    >
                      {passwordSuccessMessage}
                    </p>
                  ) : null}

                  <div className="inline-actions">
                    <button type="submit" disabled={isUpdatingPassword}>
                      <FontAwesomeIcon icon={faFloppyDisk} />
                      {isUpdatingPassword
                        ? t("profile.updatingPassword")
                        : t("profile.updatePassword")}
                    </button>
                  </div>
                </form>
              </section>

              <section className="profile-danger-zone">
                <h3>{t("profile.deleteProfileTitle")}</h3>
                <p>{t("profile.deleteProfileDesc")}</p>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={openDeleteModal}
                >
                  <FontAwesomeIcon icon={faTrash} />
                  {t("profile.deleteProfileTitle")}
                </button>
              </section>
            </section>
          ) : null}

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
                  <PasswordField
                    label={t("register.password")}
                    id="profile-delete-password"
                    name="deletePassword"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    required
                    minLength={1}
                    autoComplete="current-password"
                    disabled={isDeleting}
                    autoFocus
                  />

                  <PasswordField
                    label={t("profile.confirmPassword")}
                    id="profile-delete-password-confirm"
                    name="deletePasswordConfirm"
                    value={deletePasswordConfirm}
                    onChange={(event) =>
                      setDeletePasswordConfirm(event.target.value)
                    }
                    required
                    minLength={1}
                    autoComplete="current-password"
                    disabled={isDeleting}
                  />

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={closeDeleteModal}
                      disabled={isDeleting}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="danger-btn"
                      disabled={isDeleting}
                    >
                      <FontAwesomeIcon icon={faTrash} />
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
      ) : isLoadingProfile ? (
        <PageLoader
          title={t("profile.loadingTitle")}
          subtitle={t("profile.loadingSubtitle")}
          variant="profile"
        />
      ) : null}

      <UnifiedPromptModal
        isOpen={Boolean(renameDraft.hiveId)}
        mode="prompt"
        title={t("editor.hiveTitleLabel")}
        inputLabel={t("editor.hiveTitleLabel")}
        value={renameDraft.nextTitle}
        inputMaxLength={HIVE_TITLE_MAX_LENGTH}
        onValueChange={(value) =>
          setRenameDraft((prev) => ({ ...prev, nextTitle: value }))
        }
        confirmLabel={t("common.save")}
        confirmDisabled={
          !renameDraft.nextTitle.trim() ||
          renameDraft.nextTitle.trim() === renameDraft.sourceTitle.trim() ||
          Boolean(renamingHiveId) ||
          Boolean(duplicatingHiveId)
        }
        onCancel={() => {
          if (renamingHiveId || duplicatingHiveId) return;
          setRenameDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
        }}
        onConfirm={confirmRenameDraftFromProfile}
      />

      <UnifiedPromptModal
        isOpen={Boolean(renameOrDuplicateDraft.hiveId)}
        mode="renameOrDuplicate"
        title={t("editor.renameOrDuplicateTitle")}
        message={t("editor.renameOrDuplicateMessage", {
          oldTitle: renameOrDuplicateDraft.sourceTitle,
          newTitle: renameOrDuplicateDraft.nextTitle,
        })}
        confirmLabel={t("editor.renameOnly")}
        extraActionLabel={t("editor.createCopy")}
        busy={Boolean(renamingHiveId) || Boolean(duplicatingHiveId)}
        confirmLoadingLabel={t("profile.renaming")}
        extraActionLoadingLabel={t("profile.duplicating")}
        confirmDisabled={Boolean(renamingHiveId) || Boolean(duplicatingHiveId)}
        onCancel={() => {
          if (renamingHiveId || duplicatingHiveId) return;
          setRenameOrDuplicateDraft({
            hiveId: null,
            sourceTitle: "",
            nextTitle: "",
          });
        }}
        onConfirm={renameExistingHiveFromProfile}
        onExtraAction={createCopyFromRenameDraft}
      />

      <UnifiedPromptModal
        isOpen={Boolean(confirmDeleteHiveId)}
        title={t("profile.modalDeleteHiveTitle")}
        message={t("profile.modalDeleteHiveMessage")}
        confirmLabel={
          deletingHiveId ? t("profile.deleting") : t("common.delete")
        }
        busy={Boolean(deletingHiveId)}
        confirmLoadingLabel={t("profile.deleting")}
        confirmClassName="danger"
        confirmDisabled={Boolean(deletingHiveId)}
        onCancel={() => {
          if (deletingHiveId) return;
          setConfirmDeleteHiveId(null);
        }}
        onConfirm={deleteHive}
      />

      <UnifiedPromptModal
        isOpen={Boolean(duplicateDraft.hiveId)}
        mode="prompt"
        title={t("profile.modalDuplicateTitle")}
        message={t("profile.modalDuplicateMessage")}
        inputLabel={t("profile.modalDuplicateInput")}
        value={duplicateDraft.nextTitle}
        inputMaxLength={HIVE_TITLE_MAX_LENGTH}
        onValueChange={(value) =>
          setDuplicateDraft((prev) => ({ ...prev, nextTitle: value }))
        }
        busy={Boolean(duplicatingHiveId)}
        confirmLoadingLabel={t("profile.duplicating")}
        confirmDisabled={
          !duplicateDraft.nextTitle.trim() || Boolean(duplicatingHiveId)
        }
        onCancel={() => {
          if (duplicatingHiveId) return;
          setDuplicateDraft({ hiveId: null, sourceTitle: "", nextTitle: "" });
        }}
        confirmLabel={
          duplicatingHiveId
            ? t("profile.duplicating")
            : t("profile.modalDuplicateConfirm")
        }
        onConfirm={duplicateHiveFromProfile}
      />

      <UnifiedPromptModal
        isOpen={selectingHiveType}
        mode="confirm"
        title={t("profile.modalselectHiveTypeTitle")}
        message={t("profile.selectHiveTypeMessage")}
        confirmLabel={t("profile.selectStandardHive")}
        extraActionLabel={t("profile.selectDcoHive")}
        onConfirm={() => confirmHiveType(HIVE_KINDS.STANDARD)}
        onExtraAction={() => confirmHiveType(HIVE_KINDS.DCO)}
        onCancel={() => setSelectingHiveType(false)}
      />

      <UnifiedPromptModal
        isOpen={creatingHive}
        mode="prompt"
        title={t("profile.modalCreateTitle")}
        message={t("profile.modalCreateMessage")}
        inputLabel={t("profile.modalCreateInput")}
        inputPlaceholder={t("profile.modalCreatePlaceholder")}
        value={newHiveTitle}
        inputMaxLength={HIVE_TITLE_MAX_LENGTH}
        onValueChange={setNewHiveTitle}
        confirmLabel={t("common.confirm")}
        confirmDisabled={!newHiveTitle.trim()}
        onCancel={closeCreateHiveModal}
        onConfirm={confirmCreateHive}
      />
    </section>
  );
}
