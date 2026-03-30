import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faCamera,
  faComments,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import UnifiedPromptModal from "./UnifiedPromptModal";
import { useLanguage } from "../context/LanguageContext";
import {
  captureBoardFrontAndBack,
  captureHiveExportBundle,
  triggerDownload,
} from "../lib/snapshot";

export default function Toolbar({
  onReset,
  showCollaboratorsButton = false,
  isCollaboratorsLocked = false,
  canInvite = false,
  canLeaveHive = false,
  collaborators = [],
  onOpenCollaborators,
  onInviteCollaborator,
  onChangeCollaboratorRole,
  onRemoveCollaborator,
  onLeaveHive,
  sentInvitations = [],
  onLoadSentInvitations,
  isCommentsLocked = false,
  onOpenComments,
  commentCount = 0,
  openCollaboratorsSignal = 0,
  exportOptions = null,
}) {
  const { t } = useLanguage();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COMMENT");
  const [inviteWarning, setInviteWarning] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manageLoadingId, setManageLoadingId] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const getRoleLabel = (role) => {
    switch (role) {
      case "ADMIN":
        return t("toolbar.roleAdmin");
      case "EDITOR":
      case "EDIT":
        return t("toolbar.roleEdit");
      case "COMMENT":
        return t("toolbar.roleComment");
      case "READ":
        return t("toolbar.roleRead");
      default:
        return role;
    }
  };

  useEffect(() => {
    if (!showInviteModal) {
      setInviteWarning("");
      setInviteSuccess("");
    }
  }, [showInviteModal]);

  useEffect(() => {
    if (!inviteWarning) return undefined;
    const timeoutId = window.setTimeout(() => {
      setInviteWarning("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [inviteWarning]);

  useEffect(() => {
    if (!inviteSuccess) return undefined;
    const timeoutId = window.setTimeout(() => {
      setInviteSuccess("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [inviteSuccess]);

  useEffect(() => {
    if (!openCollaboratorsSignal) return;
    setShowInviteModal(true);
  }, [openCollaboratorsSignal]);

  useEffect(() => {
    if (!showInviteModal || !onLoadSentInvitations) return;

    onLoadSentInvitations().catch(() => {
      setInviteWarning(t("toolbar.invitesLoadFailed"));
    });
  }, [onLoadSentInvitations, showInviteModal, t]);

  const getInvitationStatusLabel = (status) => {
    switch (status) {
      case "PENDING":
        return t("toolbar.inviteStatusPending");
      case "ACCEPTED":
        return t("toolbar.inviteStatusAccepted");
      case "DECLINED":
        return t("toolbar.inviteStatusDeclined");
      default:
        return status;
    }
  };

  const handleExport = async () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    try {
      if (exportOptions) {
        const { blob, fileName } = await captureHiveExportBundle({
          board,
          ...exportOptions,
        });
        triggerDownload(blob, fileName);
        return;
      }

      const dataUrl = await captureBoardFrontAndBack(
        board,
        t("toolbar.screenshotMergeError"),
      );
      triggerDownload(dataUrl, "ruche.png");
    } catch (err) {
      console.error("Erreur lors de la capture :", err);
      setExportErrorMessage(
        t("toolbar.screenshotFailed", {
          message: err?.message || "unknown",
        }),
      );
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteWarning(t("toolbar.inviteRequiredEmail"));
      return;
    }

    if (!isValidEmail(email)) {
      setInviteWarning(t("toolbar.inviteInvalidEmail"));
      return;
    }

    if (!onInviteCollaborator) {
      setInviteWarning(t("toolbar.inviteUnavailable"));
      return;
    }

    setInviteLoading(true);
    try {
      await onInviteCollaborator(email, inviteRole);
      setInviteEmail("");
      setInviteRole("COMMENT");
      setInviteWarning("");
      setInviteSuccess(t("toolbar.inviteSent"));
      await onLoadSentInvitations?.();
    } catch (err) {
      const message = err?.message || "";
      const normalized = message.toLowerCase();

      if (
        normalized.includes("aucun compte") ||
        normalized.includes("introuvable")
      ) {
        setInviteWarning(t("toolbar.inviteNoUser"));
      } else if (normalized.includes("invitation invalide")) {
        setInviteWarning(t("toolbar.inviteInvalid"));
      } else {
        setInviteWarning(message || t("toolbar.inviteFailed"));
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (collaboratorId, role) => {
    if (!onChangeCollaboratorRole) return;

    setManageLoadingId(collaboratorId);
    try {
      await onChangeCollaboratorRole(collaboratorId, role);
      setInviteWarning("");
    } catch (err) {
      setInviteWarning(err?.message || t("toolbar.invalidRole"));
    } finally {
      setManageLoadingId(null);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    if (!onRemoveCollaborator) return;

    setManageLoadingId(collaboratorId);
    try {
      await onRemoveCollaborator(collaboratorId);
      setInviteWarning("");
    } catch (err) {
      setInviteWarning(err?.message || t("toolbar.removeFailed"));
    } finally {
      setManageLoadingId(null);
    }
  };

  const handleLeaveHive = async () => {
    if (!onLeaveHive) return;

    setLeaveLoading(true);
    try {
      await onLeaveHive();
    } catch (err) {
      setInviteWarning(err?.message || t("toolbar.leaveFailed"));
    } finally {
      setLeaveLoading(false);
    }
  };

  const shouldShowCollaboratorsButton =
    showCollaboratorsButton ||
    (canInvite && onInviteCollaborator) ||
    canLeaveHive;

  const handleOpenCollaborators = () => {
    if (onOpenCollaborators) {
      onOpenCollaborators();
      return;
    }

    setShowInviteModal(true);
  };

  return (
    <>
      <div className="toolbar">
        <button onClick={onReset}>
          <FontAwesomeIcon icon={faArrowsRotate} /> {t("toolbar.reset")}
        </button>
        <button onClick={handleExport}>
          <FontAwesomeIcon icon={faCamera} /> {t("toolbar.screenshot")}
        </button>
        {shouldShowCollaboratorsButton ? (
          <button
            type="button"
            className={
              isCollaboratorsLocked
                ? "toolbar-action-btn is-locked"
                : "toolbar-action-btn"
            }
            aria-disabled={isCollaboratorsLocked}
            onClick={handleOpenCollaborators}
          >
            <FontAwesomeIcon icon={faUserPlus} /> {t("toolbar.collaborators")}
          </button>
        ) : null}
        {onOpenComments && (
          <button
            type="button"
            onClick={onOpenComments}
            className={`toolbar-comments-btn ${isCommentsLocked ? "is-locked" : ""}`.trim()}
            aria-disabled={isCommentsLocked}
          >
            <FontAwesomeIcon icon={faComments} /> {t("toolbar.comments")}
            {commentCount > 0 && (
              <span className="toolbar-comments-badge">{commentCount}</span>
            )}
          </button>
        )}
      </div>

      {showInviteModal ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowInviteModal(false);
            }
          }}
        >
          <div className="modal-box toolbar-invite-modal">
            <h2>{t("toolbar.manageCollaborators")}</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setShowInviteModal(false)}
              aria-label={t("common.close")}
            >
              ×
            </button>

            {canInvite ? (
              <div className="form-grid toolbar-invite-grid">
                <label>
                  Email
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" ||
                        event.nativeEvent.isComposing
                      )
                        return;
                      event.preventDefault();
                      handleInvite();
                    }}
                    placeholder="email@example.com"
                    autoFocus
                  />
                </label>
                <label>
                  {t("admin.role")}
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                  >
                    <option value="ADMIN">{getRoleLabel("ADMIN")}</option>
                    <option value="EDITOR">{getRoleLabel("EDITOR")}</option>
                    <option value="COMMENT">{getRoleLabel("COMMENT")}</option>
                    <option value="READ">{getRoleLabel("READ")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? t("toolbar.inviting") : t("toolbar.invite")}
                </button>
              </div>
            ) : null}

            {inviteWarning ? (
              <p className="form-error toolbar-modal-warning">
                {inviteWarning}
              </p>
            ) : null}

            {inviteSuccess ? (
              <p className="form-info toolbar-modal-warning">{inviteSuccess}</p>
            ) : null}

            <div className="toolbar-collaborators-section">
              <h3>{t("toolbar.currentCollaborators")}</h3>
              {collaborators.length === 0 ? (
                <p className="comments-empty">{t("toolbar.noCollaborators")}</p>
              ) : (
                <ul className="list-grid toolbar-collaborators-list">
                  {collaborators.map((collaborator) => (
                    <li key={collaborator.id}>
                      <span>
                        {collaborator.username} -{" "}
                        {getRoleLabel(collaborator.role)}
                      </span>
                      {canInvite ? (
                        <div className="inline-actions">
                          <select
                            value={
                              collaborator.role === "EDIT"
                                ? "EDITOR"
                                : collaborator.role
                            }
                            disabled={manageLoadingId === collaborator.id}
                            onChange={(event) =>
                              handleChangeRole(
                                collaborator.id,
                                event.target.value,
                              )
                            }
                          >
                            <option value="ADMIN">
                              {getRoleLabel("ADMIN")}
                            </option>
                            <option value="EDITOR">
                              {getRoleLabel("EDITOR")}
                            </option>
                            <option value="COMMENT">
                              {getRoleLabel("COMMENT")}
                            </option>
                            <option value="READ">{getRoleLabel("READ")}</option>
                          </select>
                          <button
                            type="button"
                            className="toolbar-collaborator-remove"
                            disabled={manageLoadingId === collaborator.id}
                            onClick={() =>
                              handleRemoveCollaborator(collaborator.id)
                            }
                          >
                            {t("toolbar.remove")}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canInvite ? (
              <div className="toolbar-collaborators-section">
                <h3>{t("toolbar.sentInvitations")}</h3>
                {sentInvitations.length === 0 ? (
                  <p className="comments-empty">
                    {t("toolbar.noSentInvitations")}
                  </p>
                ) : (
                  <ul className="list-grid toolbar-collaborators-list">
                    {sentInvitations.map((invitation) => (
                      <li key={invitation.id}>
                        <span>
                          {invitation.invitee?.username ||
                            invitation.invitee?.email ||
                            "-"}{" "}
                          - {getRoleLabel(invitation.role)} -{" "}
                          {getInvitationStatusLabel(invitation.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {canLeaveHive && onLeaveHive ? (
              <div className="toolbar-leave-section">
                <button
                  type="button"
                  className="toolbar-leave-btn"
                  onClick={() => setShowLeaveConfirmModal(true)}
                  disabled={leaveLoading}
                >
                  {leaveLoading ? t("toolbar.leaving") : t("toolbar.leaveHive")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <UnifiedPromptModal
        isOpen={showLeaveConfirmModal}
        title={t("toolbar.confirmLeaveTitle")}
        message={t("toolbar.confirmLeaveMessage")}
        confirmLabel={t("toolbar.confirmLeave")}
        confirmClassName="danger"
        onCancel={() => setShowLeaveConfirmModal(false)}
        onConfirm={async () => {
          setShowLeaveConfirmModal(false);
          await handleLeaveHive();
        }}
      />

      <UnifiedPromptModal
        isOpen={Boolean(exportErrorMessage)}
        title={t("toolbar.screenshotTitle")}
        message={exportErrorMessage}
        cancelLabel={t("common.close")}
        confirmLabel="OK"
        onCancel={() => setExportErrorMessage("")}
        onConfirm={() => setExportErrorMessage("")}
      />
    </>
  );
}
