import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import domtoimage from "dom-to-image-more";
import { ApiError, apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RucheWorkspace from "../components/RucheWorkspace";
import Toolbar from "../components/Toolbar";
import UnifiedPromptModal from "../components/UnifiedPromptModal";
import PageLoader from "../components/PageLoader";
import { useLanguage } from "../context/LanguageContext";
import {
  HIVE_KINDS,
  normalizeHiveKind,
  resolveDefaultHiveKind,
} from "../lib/hives";
import { useTabletViewport } from "../hooks/useTabletViewport";

function waitForCaptureFrame() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
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

function totalCommentCount(comments = []) {
  return comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
}

export default function RucheEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, isAdmin, logout } = useAuth();
  const { t, dateLocale } = useLanguage();
  const { isTabletLandscape, isTabletPortrait, isPhone } = useTabletViewport();

  const isNew = !id;
  const adminReadOnly = Boolean(location.state?.adminReadOnly);
  const duplicateSource = location.state?.duplicateSource || null;
  const requestedHiveKind = normalizeHiveKind(
    location.state?.hiveKind ||
      duplicateSource?.kind ||
      resolveDefaultHiveKind(user?.roleLabel),
  );
  const initialHiveKind = isNew ? requestedHiveKind : HIVE_KINDS.STANDARD;
  const initialNewTitle =
    isNew && location.state?.title
      ? location.state.title
      : isNew && duplicateSource?.title
        ? duplicateSource.title
        : initialHiveKind === HIVE_KINDS.DCO
          ? t("editor.newDcoHiveTitle")
          : t("editor.newHiveTitle");

  const [hive, setHive] = useState(null);
  const [title, setTitle] = useState(() => initialNewTitle);
  const [hiveKind, setHiveKind] = useState(initialHiveKind);
  const [boardData, setBoardData] = useState(() =>
    isNew && duplicateSource?.boardData ? duplicateSource.boardData : null,
  );
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [activeEditors, setActiveEditors] = useState([]);

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const commentsEndRef = useRef(null);
  const saveFeedbackTimeoutRef = useRef(null);
  const [showLeaveDirtyModal, setShowLeaveDirtyModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [saveRequiredAction, setSaveRequiredAction] = useState(null);
  const [openCollaboratorsSignal, setOpenCollaboratorsSignal] = useState(0);
  const [requestedNoteCardId, setRequestedNoteCardId] = useState(null);
  const [renameOrDuplicateAction, setRenameOrDuplicateAction] = useState(null);
  const [pendingNewTitle, setPendingNewTitle] = useState("");
  const [sentInvitations, setSentInvitations] = useState([]);
  const [pendingLeaveAction, setPendingLeaveAction] = useState(null);
  const [showHeaderTitleModal, setShowHeaderTitleModal] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");
  const [exportSignal, setExportSignal] = useState(0);
  const [tabletSaveFeedbackStatus, setTabletSaveFeedbackStatus] = useState("");

  const isOwner = Boolean(
    hive?.owner?.id && user?.id && hive.owner.id === user.id,
  );
  const collaboratorRole =
    hive?.collaborators?.find((collaborator) => collaborator.id === user?.id)
      ?.role || null;
  const hasEditorRole =
    collaboratorRole === "EDITOR" || collaboratorRole === "EDIT";
  const canManageHive = Boolean(
    isOwner || isAdmin || collaboratorRole === "ADMIN",
  );
  const isCollaborator = Boolean(collaboratorRole);
  const canEdit = adminReadOnly
    ? false
    : isNew
      ? true
      : Boolean(
          hive?.canEdit ||
          isOwner ||
          isAdmin ||
          collaboratorRole === "ADMIN" ||
          hasEditorRole,
        );
  const canComment = adminReadOnly
    ? false
    : isNew
      ? false
      : Boolean(
          hive?.canComment ||
          isOwner ||
          isAdmin ||
          collaboratorRole === "ADMIN" ||
          hasEditorRole ||
          collaboratorRole === "COMMENT",
        );
  const workspaceLoadKey = isNew
    ? "new-hive"
    : `${id}:${hive ? "loaded" : "init"}`;
  const isTabletEditorMode = isTabletLandscape && !isAdmin;
  const isDuplicateFlow = isNew && Boolean(duplicateSource?.title);
  const hasRenamedDuplicate =
    !isDuplicateFlow || title.trim() !== duplicateSource.title.trim();
  const requiresSavedHivePrompt = isNew;

  const showTabletSaveFeedback = useCallback(
    (status, autoHideMs = 0) => {
      if (!isTabletEditorMode) return;

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
        saveFeedbackTimeoutRef.current = null;
      }

      setTabletSaveFeedbackStatus(status);

      if (autoHideMs > 0) {
        saveFeedbackTimeoutRef.current = setTimeout(() => {
          setTabletSaveFeedbackStatus("");
          saveFeedbackTimeoutRef.current = null;
        }, autoHideMs);
      }
    },
    [isTabletEditorMode],
  );

  useEffect(() => {
    return () => {
      if (!saveFeedbackTimeoutRef.current) return;
      clearTimeout(saveFeedbackTimeoutRef.current);
      saveFeedbackTimeoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isTabletEditorMode) return;
    setTabletSaveFeedbackStatus("");
  }, [isTabletEditorMode]);

  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, hiveKind, boardData }),
    [title, hiveKind, boardData],
  );
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;
  const otherActiveEditors = useMemo(
    () =>
      activeEditors.filter(
        (editor) => String(editor.userId) !== String(user?.id),
      ),
    [activeEditors, user?.id],
  );
  const activeEditorNames = useMemo(
    () => otherActiveEditors.map((editor) => editor.username).join(", "),
    [otherActiveEditors],
  );
  const activeEditorsLabel = useMemo(
    () =>
      otherActiveEditors.length > 0
        ? t("editor.activeEditorsOthers", { names: activeEditorNames })
        : t("editor.activeEditorsOnlyYou"),
    [activeEditorNames, otherActiveEditors.length, t],
  );

  useEffect(() => {
    if (!isNew || savedSnapshot || boardData === null) return;
    setSavedSnapshot(
      JSON.stringify({
        title: initialNewTitle,
        hiveKind: initialHiveKind,
        boardData,
      }),
    );
  }, [isNew, savedSnapshot, boardData, initialHiveKind, initialNewTitle]);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;

    async function load() {
      try {
        const data = await apiFetch(`/hives/${id}`, { token });
        if (!mounted) return;
        setHive(data);
        setTitle(data.title);
        setHiveKind(normalizeHiveKind(data.kind));
        setBoardData(data.boardData);
        setBaseUpdatedAt(data.updatedAt || null);
        setSavedSnapshot(
          JSON.stringify({
            title: data.title,
            hiveKind: normalizeHiveKind(data.kind),
            boardData: data.boardData,
          }),
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
          hiveKind: normalizeHiveKind(data.kind),
          boardData: data.boardData,
        });

        if (!isDirty) {
          setTitle(data.title);
          setHiveKind(normalizeHiveKind(data.kind));
          setBoardData(data.boardData);
          setBaseUpdatedAt(data.updatedAt || null);
          setSavedSnapshot(nextSnapshot);
        }
      } catch {
        // Ignore transient refresh errors and keep local editing state.
      }
    }, 4500);

    return () => clearInterval(intervalId);
  }, [canEdit, id, isDirty, isNew, token]);

  useEffect(() => {
    if (isNew || !id || !token || !user?.id) {
      setActiveEditors([]);
      return;
    }

    let isMounted = true;

    const syncPresence = async () => {
      try {
        const data = await apiFetch(`/hives/${id}/presence`, {
          method: "POST",
          token,
        });
        if (!isMounted) return;
        setActiveEditors(
          Array.isArray(data?.activeEditors) ? data.activeEditors : [],
        );
      } catch {
        // Ignore transient presence errors so editing can continue uninterrupted.
      }
    };

    syncPresence();
    const intervalId = setInterval(syncPresence, 10_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      apiFetch(`/hives/${id}/presence`, {
        method: "DELETE",
        token,
      }).catch(() => {
        // Ignore cleanup failures; stale presence expires automatically.
      });
    };
  }, [id, isNew, token, user?.id]);

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

  useEffect(() => {
    document.body.classList.add("editor-route");
    return () => {
      document.body.classList.remove("editor-route");
    };
  }, []);

  useEffect(() => {
    window.__RUCHE_EDITOR_IS_DIRTY = isDirty;

    return () => {
      window.__RUCHE_EDITOR_IS_DIRTY = false;
    };
  }, [isDirty]);

  const executeLeaveAction = useCallback(
    (action) => {
      if (!action) return;

      if (action.type === "logout") {
        logout();
        navigate("/");
        return;
      }

      if (action.type === "route" && action.to) {
        navigate(action.to);
      }
    },
    [logout, navigate],
  );

  useEffect(() => {
    const handleRequestedLeave = (event) => {
      const requestedAction = event.detail;
      if (!requestedAction) return;

      if (isDirty) {
        setPendingLeaveAction(requestedAction);
        setShowLeaveDirtyModal(true);
        return;
      }

      executeLeaveAction(requestedAction);
    };

    window.addEventListener("ruche:request-editor-leave", handleRequestedLeave);

    return () => {
      window.removeEventListener(
        "ruche:request-editor-leave",
        handleRequestedLeave,
      );
    };
  }, [executeLeaveAction, isDirty]);

  const reloadHiveFromServer = useCallback(async () => {
    if (isNew || !id) return;

    const data = await apiFetch(`/hives/${id}`, { token });
    setHive(data);
    setTitle(data.title);
    setHiveKind(normalizeHiveKind(data.kind));
    setBoardData(data.boardData);
    setBaseUpdatedAt(data.updatedAt || null);
    setSavedSnapshot(
      JSON.stringify({
        title: data.title,
        hiveKind: normalizeHiveKind(data.kind),
        boardData: data.boardData,
      }),
    );
  }, [id, isNew, token]);

  const performSaveHive = useCallback(
    async (titleToSave, { skipNavigateAfterCreate = false } = {}) => {
      setIsSaving(true);
      showTabletSaveFeedback("saving");
      try {
        if (isNew) {
          const created = await apiFetch("/hives", {
            method: "POST",
            token,
            body: {
              title: titleToSave,
              kind: hiveKind,
              boardData,
            },
          });
          const normalizedCreatedKind = normalizeHiveKind(
            created.kind || hiveKind,
          );
          const snapshot = JSON.stringify({
            title: titleToSave,
            hiveKind: normalizedCreatedKind,
            boardData,
          });
          setSavedSnapshot(snapshot);
          setBaseUpdatedAt(created.updatedAt || null);
          setTitle(titleToSave);
          setHiveKind(normalizedCreatedKind);
          setHive({
            ...created,
            owner: {
              id: user?.id || null,
              username: user?.username || null,
              email: user?.email || null,
            },
            collaborators: [],
            comments: [],
            canEdit: true,
            canComment: true,
          });
          if (!skipNavigateAfterCreate) {
            navigate(`/hives/${created.id}`, { replace: true });
          }
          showTabletSaveFeedback("success", 2200);
          return true;
        }

        let expectedUpdatedAt = baseUpdatedAt;
        if (!expectedUpdatedAt) {
          const latest = await apiFetch(`/hives/${id}`, { token });
          expectedUpdatedAt = latest?.updatedAt || null;
          setBaseUpdatedAt(expectedUpdatedAt);
        }

        const updated = await apiFetch(`/hives/${id}`, {
          method: "PUT",
          token,
          body: {
            title: titleToSave,
            kind: hiveKind,
            boardData,
            expectedUpdatedAt,
          },
        });
        const snapshot = JSON.stringify({
          title: titleToSave,
          hiveKind,
          boardData,
        });
        setSavedSnapshot(snapshot);
        setTitle(titleToSave);
        setBaseUpdatedAt(updated?.updatedAt || null);

        setHive((prev) =>
          prev
            ? {
                ...prev,
                title: titleToSave,
                kind: hiveKind,
                boardData,
                updatedAt: updated?.updatedAt || prev.updatedAt,
              }
            : prev,
        );
        showTabletSaveFeedback("success", 2200);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setShowConflictModal(true);
        }
        setError(err.message);
        showTabletSaveFeedback("error", 3200);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      baseUpdatedAt,
      boardData,
      hiveKind,
      id,
      isNew,
      navigate,
      showTabletSaveFeedback,
      token,
      user?.email,
      user?.id,
      user?.username,
    ],
  );

  const saveHive = useCallback(
    async ({ skipNavigateAfterCreate = false } = {}) => {
      if (isSaving) return false;

      setError("");
      const trimmedTitle = title.trim();

      if (!trimmedTitle) {
        setError(t("editor.saveTitleError"));
        showTabletSaveFeedback("error", 3000);
        return;
      }

      if (isDuplicateFlow && !hasRenamedDuplicate) {
        setError(t("editor.duplicateRenameError"));
        showTabletSaveFeedback("error", 3000);
        return;
      }

      // If existing hive and title changed, ask user whether to rename or duplicate
      if (
        !isNew &&
        canManageHive &&
        hive &&
        trimmedTitle !== hive.title.trim()
      ) {
        setPendingNewTitle(trimmedTitle);
        setRenameOrDuplicateAction("pending");
        return;
      }

      return performSaveHive(trimmedTitle, { skipNavigateAfterCreate });
    },
    [
      canManageHive,
      hasRenamedDuplicate,
      hive,
      isDuplicateFlow,
      isNew,
      isSaving,
      performSaveHive,
      showTabletSaveFeedback,
      t,
      title,
    ],
  );

  const handleRenameExistingHive = async () => {
    setRenameOrDuplicateAction(null);
    setPendingNewTitle("");
    if (pendingNewTitle.trim()) {
      await performSaveHive(pendingNewTitle.trim());
    }
  };

  const handleDuplicateWithNewTitle = async () => {
    if (!pendingNewTitle.trim() || !hive) return;

    setRenameOrDuplicateAction(null);
    setIsSaving(true);
    showTabletSaveFeedback("saving");

    try {
      // Create duplicate with new title
      const newHive = await apiFetch("/hives", {
        method: "POST",
        token,
        body: {
          title: pendingNewTitle.trim(),
          kind: hiveKind,
          boardData,
        },
      });

      setPendingNewTitle("");

      // Navigate to the newly created hive
      navigate(`/hives/${newHive.id}`, { replace: true });
      showTabletSaveFeedback("success", 2200);
    } catch (err) {
      setError(err.message);
      setPendingNewTitle("");
      showTabletSaveFeedback("error", 3200);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCopyAfterConflict = async () => {
    if (isSaving) return;

    setIsSaving(true);
    showTabletSaveFeedback("saving");
    try {
      const baseTitle =
        title.trim() || hive?.title?.trim() || t("editor.newHiveTitle");
      const copyTitle = `${baseTitle} (${t("profile.copySuffix")})`;

      const created = await apiFetch("/hives", {
        method: "POST",
        token,
        body: {
          title: copyTitle,
          kind: hiveKind,
          boardData,
        },
      });

      setShowConflictModal(false);
      setError("");
      navigate(`/hives/${created.id}`, { replace: true });
      showTabletSaveFeedback("success", 2200);
    } catch (err) {
      setError(err.message);
      showTabletSaveFeedback("error", 3200);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndLeave = async () => {
    const requestedAction = pendingLeaveAction;
    setShowLeaveDirtyModal(false);
    setPendingLeaveAction(null);
    const success = await saveHive({ skipNavigateAfterCreate: true });
    if (!success) return;

    if (requestedAction) {
      executeLeaveAction(requestedAction);
      return;
    }

    navigate("/profile");
  };

  const leaveWithoutSaving = () => {
    const requestedAction = pendingLeaveAction;
    setShowLeaveDirtyModal(false);
    setPendingLeaveAction(null);

    if (requestedAction) {
      executeLeaveAction(requestedAction);
      return;
    }

    navigate("/profile");
  };

  const cancelLeave = () => {
    setShowLeaveDirtyModal(false);
    setPendingLeaveAction(null);
  };

  const handleReloadAfterConflict = async () => {
    setShowConflictModal(false);
    try {
      await reloadHiveFromServer();
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const runSavedHiveAction = (action) => {
    if (!action) return;

    if (action.type === "comments") {
      setShowCommentsModal(true);
      return;
    }

    if (action.type === "collaborators") {
      setOpenCollaboratorsSignal((prev) => prev + 1);
      return;
    }

    if (action.type === "card-note" && action.cardId) {
      setRequestedNoteCardId(action.cardId);
    }
  };

  const promptSaveForAction = useCallback((action) => {
    setSaveRequiredAction(action);
  }, []);

  const handleSaveRequiredConfirm = async () => {
    const action = saveRequiredAction;
    setSaveRequiredAction(null);
    const success = await saveHive();
    if (success) {
      runSavedHiveAction(action);
    }
  };

  const handleOpenComments = useCallback(() => {
    if (requiresSavedHivePrompt) {
      promptSaveForAction({ type: "comments" });
      return;
    }

    setShowCommentsModal(true);
  }, [promptSaveForAction, requiresSavedHivePrompt]);

  const handleResetRequest = useCallback(() => {
    setShowResetConfirmModal(true);
  }, []);

  const handleConfirmReset = () => {
    setShowResetConfirmModal(false);
    setResetSignal((prev) => prev + 1);
  };

  const handleOpenCollaborators = () => {
    if (requiresSavedHivePrompt) {
      promptSaveForAction({ type: "collaborators" });
    }
  };

  const handleRequireSaveBeforeCardNote = (cardId) => {
    promptSaveForAction({ type: "card-note", cardId });
  };

  const loadHiveInvitations = useCallback(async () => {
    if (!id || isNew) {
      setSentInvitations([]);
      return;
    }

    const data = await apiFetch(`/hives/${id}/invitations`, { token });
    setSentInvitations(Array.isArray(data) ? data : []);
  }, [id, isNew, token]);

  const inviteCollaborator = async (email, role) => {
    await apiFetch(`/hives/${id}/collaborators`, {
      method: "POST",
      token,
      body: { email, role },
    });

    await loadHiveInvitations();
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

  const leaveHive = async () => {
    if (!user?.id) return;

    await removeCollaborator(user.id);
    navigate("/profile");
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

  const editComment = async () => {
    if (!editingTarget?.comment) return;

    const value = editingTarget.value.trim();
    if (!value) return;

    const updated = await apiFetch(
      `/hives/${id}/comments/${editingTarget.comment.id}`,
      {
        method: "PATCH",
        token,
        body: { message: value },
      },
    );

    setHive((prev) => {
      if (!editingTarget.parentId) {
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
          c.id === editingTarget.parentId
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
    setEditingTarget(null);
  };

  const deleteComment = async () => {
    if (!deleteTarget?.comment) return;

    await apiFetch(`/hives/${id}/comments/${deleteTarget.comment.id}`, {
      method: "DELETE",
      token,
    });

    setHive((prev) => {
      if (!deleteTarget.parentId) {
        return {
          ...prev,
          comments: (prev?.comments || []).filter(
            (c) => c.id !== deleteTarget.comment.id,
          ),
        };
      }
      return {
        ...prev,
        comments: (prev?.comments || []).map((c) =>
          c.id === deleteTarget.parentId
            ? {
                ...c,
                replies: (c.replies || []).filter(
                  (r) => r.id !== deleteTarget.comment.id,
                ),
              }
            : c,
        ),
      };
    });
    setDeleteTarget(null);
  };

  const openEditCommentModal = (comment, parentId = null) => {
    setEditingTarget({
      comment,
      parentId,
      value: comment.message || "",
    });
  };

  const openDeleteCommentModal = (comment, parentId = null) => {
    setDeleteTarget({ comment, parentId });
  };

  const startReply = (comment) => {
    const targetId = comment.parentId ?? comment.id;
    setReplyingTo(targetId);
    setReplyText("");
  };

  const handleEnterSubmit = (event, submitAction) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    submitAction();
  };

  const comments = hive?.comments || [];
  const commentCount = totalCommentCount(comments);
  const isHiveLoading = !isNew && !hive && !error;
  const exportOptions = {
    title,
    comments,
    boardCards: boardData?.boardCards || [],
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
  };
  const topbarMetaLabel =
    !isTabletEditorMode && !isNew && hive
      ? `${t("editor.createdAt")}: ${formatDateTime(hive.createdAt, dateLocale)} | ${t("editor.updatedAt")}: ${formatDateTime(hive.updatedAt, dateLocale)}`
      : "";

  useEffect(() => {
    if (!isTabletEditorMode) {
      window.dispatchEvent(
        new CustomEvent("ruche:editor-header-state", { detail: null }),
      );
      return;
    }

    window.dispatchEvent(
      new CustomEvent("ruche:editor-header-state", {
        detail: {
          isSaving,
          commentCount,
          canReset: canEdit,
        },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("ruche:editor-header-state", { detail: null }),
      );
    };
  }, [canEdit, commentCount, isSaving, isTabletEditorMode]);

  useEffect(() => {
    const handleHeaderAction = (event) => {
      if (!isTabletEditorMode) return;

      const actionType = event?.detail?.type;
      if (!actionType) return;

      if (actionType === "back-profile") {
        if (isDirty) {
          setPendingLeaveAction({ type: "route", to: "/profile" });
          setShowLeaveDirtyModal(true);
          return;
        }

        navigate("/profile");
        return;
      }

      if (actionType === "edit-title") {
        setHeaderTitleDraft(title);
        setShowHeaderTitleModal(true);
        return;
      }

      if (actionType === "save") {
        saveHive();
        return;
      }

      if (actionType === "reset") {
        if (!canEdit) return;
        handleResetRequest();
        return;
      }

      if (actionType === "export") {
        setExportSignal((prev) => prev + 1);
        return;
      }

      if (actionType === "collaborators") {
        if (requiresSavedHivePrompt) {
          promptSaveForAction({ type: "collaborators" });
          return;
        }

        setOpenCollaboratorsSignal((prev) => prev + 1);
        return;
      }

      if (actionType === "comments") {
        handleOpenComments();
      }
    };

    window.addEventListener("ruche:editor-header-action", handleHeaderAction);

    return () => {
      window.removeEventListener(
        "ruche:editor-header-action",
        handleHeaderAction,
      );
    };
  }, [
    canEdit,
    handleResetRequest,
    handleOpenComments,
    isDirty,
    isTabletEditorMode,
    navigate,
    promptSaveForAction,
    requiresSavedHivePrompt,
    saveHive,
    title,
  ]);

  return (
    <section className="editor-page">
      {!isTabletEditorMode ? (
        <div className="editor-topbar">
          <div className="editor-topbar-main">
            <Link
              to="/profile"
              className="button-link"
              onClick={(event) => {
                if (!isDirty) return;
                event.preventDefault();
                setPendingLeaveAction({ type: "route", to: "/profile" });
                setShowLeaveDirtyModal(true);
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              {t("editor.backToProfile")}
            </Link>

            <label>
              {t("editor.hiveTitleLabel")}
              <input
                id="hive-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    !canManageHive ||
                    isSaving ||
                    event.nativeEvent.isComposing
                  )
                    return;
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  saveHive();
                }}
                maxLength={100}
                disabled={!canManageHive}
              />
            </label>
            {canEdit ? (
              <button type="button" onClick={saveHive} disabled={isSaving}>
                <FontAwesomeIcon icon={faFloppyDisk} />
                {isSaving ? t("editor.saving") : t("editor.saveHive")}
              </button>
            ) : null}

            {topbarMetaLabel ? (
              <p className="editor-topbar-meta" aria-live="polite">
                {topbarMetaLabel}
              </p>
            ) : null}
          </div>

          <div className="editor-topbar-actions">
            <Toolbar
              onReset={handleResetRequest}
              showResetButton={canEdit}
              showCollaboratorsButton={isNew}
              isCollaboratorsLocked={requiresSavedHivePrompt}
              canInvite={
                !isNew &&
                Boolean(hive) &&
                (hive.owner?.id === user?.id ||
                  isAdmin ||
                  collaboratorRole === "ADMIN")
              }
              canLeaveHive={!isNew && Boolean(hive) && isCollaborator}
              collaborators={hive?.collaborators || []}
              onOpenCollaborators={isNew ? handleOpenCollaborators : undefined}
              onInviteCollaborator={
                !isNew && hive ? inviteCollaborator : undefined
              }
              onChangeCollaboratorRole={
                !isNew && hive ? changeCollaboratorRole : undefined
              }
              onRemoveCollaborator={
                !isNew && hive ? removeCollaborator : undefined
              }
              onLeaveHive={
                !isNew && hive && isCollaborator ? leaveHive : undefined
              }
              sentInvitations={sentInvitations}
              onLoadSentInvitations={
                !isNew && hive ? loadHiveInvitations : undefined
              }
              isCommentsLocked={requiresSavedHivePrompt}
              onOpenComments={handleOpenComments}
              commentCount={commentCount}
              openCollaboratorsSignal={openCollaboratorsSignal}
              exportSignal={exportSignal}
              exportOptions={exportOptions}
            />
          </div>
        </div>
      ) : (
        <div className="editor-topbar editor-topbar--tablet-spacer" />
      )}

      {isDuplicateFlow ? (
        <p className="form-info">{t("editor.duplicateInfo")}</p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {isHiveLoading ? (
        <PageLoader
          title={t("editor.loadingTitle")}
          subtitle={t("editor.loadingSubtitle")}
          variant="hive"
        />
      ) : (
        <RucheWorkspace
          initialBoardData={boardData}
          loadKey={workspaceLoadKey}
          hiveKind={hiveKind}
          resetSignal={resetSignal}
          canEdit={canEdit}
          canNote={canComment}
          requireSaveBeforeNote={requiresSavedHivePrompt}
          onRequireSaveBeforeNote={handleRequireSaveBeforeCardNote}
          requestedNoteCardId={requestedNoteCardId}
          onRequestedNoteHandled={() => setRequestedNoteCardId(null)}
          isTabletEditorMode={isTabletEditorMode}
          tabletUsageBlocked={isTabletPortrait || isPhone}
          activeEditorsLabel={activeEditorsLabel}
          onStateChange={setBoardData}
        />
      )}

      {isTabletEditorMode ? (
        <Toolbar
          onReset={handleResetRequest}
          showResetButton={canEdit}
          showCollaboratorsButton={isNew}
          isCollaboratorsLocked={requiresSavedHivePrompt}
          canInvite={
            !isNew &&
            Boolean(hive) &&
            (hive.owner?.id === user?.id ||
              isAdmin ||
              collaboratorRole === "ADMIN")
          }
          canLeaveHive={!isNew && Boolean(hive) && isCollaborator}
          collaborators={hive?.collaborators || []}
          onOpenCollaborators={isNew ? handleOpenCollaborators : undefined}
          onInviteCollaborator={!isNew && hive ? inviteCollaborator : undefined}
          onChangeCollaboratorRole={
            !isNew && hive ? changeCollaboratorRole : undefined
          }
          onRemoveCollaborator={!isNew && hive ? removeCollaborator : undefined}
          onLeaveHive={!isNew && hive && isCollaborator ? leaveHive : undefined}
          sentInvitations={sentInvitations}
          onLoadSentInvitations={
            !isNew && hive ? loadHiveInvitations : undefined
          }
          isCommentsLocked={requiresSavedHivePrompt}
          onOpenComments={handleOpenComments}
          commentCount={commentCount}
          openCollaboratorsSignal={openCollaboratorsSignal}
          exportSignal={exportSignal}
          exportOptions={exportOptions}
          hidden
        />
      ) : null}

      {isTabletEditorMode && tabletSaveFeedbackStatus ? (
        <p
          className={`editor-tablet-save-feedback is-${tabletSaveFeedbackStatus}`}
          role="status"
          aria-live={
            tabletSaveFeedbackStatus === "error" ? "assertive" : "polite"
          }
        >
          {tabletSaveFeedbackStatus === "saving"
            ? t("editor.saveStatusSaving")
            : tabletSaveFeedbackStatus === "success"
              ? t("editor.saveStatusSaved")
              : t("editor.saveStatusError")}
        </p>
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
            <h2>{t("editor.commentsTitle")}</h2>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowCommentsModal(false);
                setReplyingTo(null);
                setReplyText("");
              }}
              aria-label={t("common.close")}
            >
              x
            </button>

            <div className="comments-scroll">
              {comments.length === 0 && (
                <p className="comments-empty">{t("editor.noComments")}</p>
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
                          {t("editor.reply")}
                        </button>
                      )}
                      {(comment.author?.id === user?.id || isAdmin) && (
                        <>
                          <button
                            type="button"
                            className="comment-action-btn"
                            onClick={() => openEditCommentModal(comment)}
                          >
                            {t("editor.edit")}
                          </button>
                          <button
                            type="button"
                            className="comment-action-btn comment-action-btn--danger"
                            onClick={() => openDeleteCommentModal(comment)}
                          >
                            {t("editor.delete")}
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
                            {t("editor.reply")}
                          </button>
                        )}
                        {(reply.author?.id === user?.id || isAdmin) && (
                          <>
                            <button
                              type="button"
                              className="comment-action-btn"
                              onClick={() =>
                                openEditCommentModal(reply, comment.id)
                              }
                            >
                              {t("editor.edit")}
                            </button>
                            <button
                              type="button"
                              className="comment-action-btn comment-action-btn--danger"
                              onClick={() =>
                                openDeleteCommentModal(reply, comment.id)
                              }
                            >
                              {t("editor.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {replyingTo === comment.id && (
                    <div className="comment-reply-form">
                      <textarea
                        id={`reply-text-${comment.id}`}
                        name="replyText"
                        aria-label={t("editor.replyPlaceholder")}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(event) =>
                          handleEnterSubmit(event, () =>
                            submitReply(comment.id),
                          )
                        }
                        placeholder={t("editor.replyPlaceholder")}
                        rows={2}
                        autoFocus
                      />
                      <div className="comment-reply-actions">
                        <button
                          type="button"
                          onClick={() => submitReply(comment.id)}
                        >
                          {t("editor.send")}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                        >
                          {t("common.cancel")}
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
                  id="new-comment-text"
                  name="commentText"
                  aria-label={t("editor.addCommentPlaceholder")}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(event) => handleEnterSubmit(event, submitComment)}
                  placeholder={t("editor.addCommentPlaceholder")}
                  rows={2}
                />
                <button type="button" onClick={submitComment}>
                  {t("editor.send")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <UnifiedPromptModal
        isOpen={showResetConfirmModal}
        title={t("toolbar.confirmResetTitle")}
        message={t("toolbar.confirmResetMessage")}
        confirmLabel={t("toolbar.confirmReset")}
        confirmClassName="danger"
        onCancel={() => setShowResetConfirmModal(false)}
        onConfirm={handleConfirmReset}
      />

      <UnifiedPromptModal
        isOpen={showConflictModal}
        title={t("editor.conflictTitle")}
        message={t("editor.conflictMessage")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("editor.conflictReload")}
        extraActionLabel={t("editor.createCopy")}
        confirmDisabled={isSaving}
        onExtraAction={handleCreateCopyAfterConflict}
        onCancel={() => setShowConflictModal(false)}
        onConfirm={handleReloadAfterConflict}
      />

      <UnifiedPromptModal
        isOpen={showLeaveDirtyModal}
        title={t("editor.unsavedTitle")}
        message={t("editor.unsavedMessage")}
        cancelLabel={t("editor.stay")}
        extraActionLabel={t("editor.leaveWithoutSaving")}
        extraActionClassName="danger"
        onExtraAction={leaveWithoutSaving}
        confirmLabel={t("editor.saveAndLeave")}
        confirmDisabled={isSaving}
        onCancel={cancelLeave}
        onConfirm={saveAndLeave}
      />

      <UnifiedPromptModal
        isOpen={Boolean(saveRequiredAction)}
        title={t("editor.saveFirstTitle")}
        message={t("editor.saveFirstMessage", {
          feature:
            saveRequiredAction?.type === "collaborators"
              ? t("toolbar.collaborators")
              : saveRequiredAction?.type === "card-note"
                ? t("workspace.cardNoteTitle")
                : t("toolbar.comments"),
        })}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("editor.saveHive")}
        confirmDisabled={isSaving}
        onCancel={() => setSaveRequiredAction(null)}
        onConfirm={handleSaveRequiredConfirm}
      />

      <UnifiedPromptModal
        isOpen={Boolean(editingTarget)}
        mode="prompt"
        title={t("editor.editCommentTitle")}
        inputLabel={t("editor.newMessage")}
        value={editingTarget?.value || ""}
        onValueChange={(value) =>
          setEditingTarget((prev) => (prev ? { ...prev, value } : prev))
        }
        confirmLabel={t("common.save")}
        confirmDisabled={!editingTarget?.value?.trim()}
        onCancel={() => setEditingTarget(null)}
        onConfirm={editComment}
      />

      <UnifiedPromptModal
        isOpen={Boolean(deleteTarget)}
        title={t("editor.deleteCommentTitle")}
        message={t("workspace.irreversible")}
        confirmLabel={t("common.delete")}
        confirmClassName="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteComment}
      />

      <UnifiedPromptModal
        isOpen={renameOrDuplicateAction === "pending"}
        mode="renameOrDuplicate"
        title={t("editor.renameOrDuplicateTitle")}
        message={t("editor.renameOrDuplicateMessage", {
          oldTitle: hive?.title || "",
          newTitle: pendingNewTitle,
        })}
        confirmLabel={t("editor.renameOnly")}
        extraActionLabel={t("editor.createCopy")}
        confirmDisabled={isSaving}
        onCancel={() => {
          setRenameOrDuplicateAction(null);
          setPendingNewTitle("");
        }}
        onConfirm={handleRenameExistingHive}
        onExtraAction={handleDuplicateWithNewTitle}
      />

      <UnifiedPromptModal
        isOpen={showHeaderTitleModal}
        mode="prompt"
        title={t("editor.hiveTitleLabel")}
        inputLabel={t("editor.hiveTitleLabel")}
        value={headerTitleDraft}
        onValueChange={setHeaderTitleDraft}
        confirmLabel={t("common.save")}
        confirmDisabled={!headerTitleDraft.trim()}
        onCancel={() => setShowHeaderTitleModal(false)}
        onConfirm={() => {
          const nextTitle = headerTitleDraft.trim();
          if (!nextTitle) return;
          setTitle(nextTitle);
          setShowHeaderTitleModal(false);
        }}
      />
    </section>
  );
}
