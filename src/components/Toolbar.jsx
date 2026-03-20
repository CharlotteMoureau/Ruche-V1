import domtoimage from "dom-to-image-more";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faCamera,
  faComments,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import UnifiedPromptModal from "./UnifiedPromptModal";

export default function Toolbar({
  onReset,
  canInvite = false,
  canLeaveHive = false,
  collaborators = [],
  onInviteCollaborator,
  onChangeCollaboratorRole,
  onRemoveCollaborator,
  onLeaveHive,
  onOpenComments,
  commentCount = 0,
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COMMENT");
  const [inviteWarning, setInviteWarning] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manageLoadingId, setManageLoadingId] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const getRoleLabel = (role) => {
    switch (role) {
      case "ADMIN":
        return "Administrateur";
      case "COMMENT":
        return "Commentaire uniquement";
      case "READ":
        return "Lecture seule";
      default:
        return role;
    }
  };

  useEffect(() => {
    if (!showInviteModal) {
      setInviteWarning("");
    }
  }, [showInviteModal]);

  useEffect(() => {
    if (!inviteWarning) return undefined;
    const timeoutId = window.setTimeout(() => {
      setInviteWarning("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [inviteWarning]);

  const waitForCaptureFrame = () =>
    new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });

  const loadImage = (dataUrl) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

  const mergeFrontAndBackCapture = async (frontDataUrl, backDataUrl) => {
    const [frontImage, backImage] = await Promise.all([
      loadImage(frontDataUrl),
      loadImage(backDataUrl),
    ]);

    const spacing = 24;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(frontImage.width, backImage.width);
    canvas.height = frontImage.height + backImage.height + spacing;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Impossible de generer l'image fusionnee.");
    }

    context.drawImage(frontImage, 0, 0);
    context.drawImage(backImage, 0, frontImage.height + spacing);

    return canvas.toDataURL("image/png");
  };

  const handleExport = async () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    document.body.classList.add("capture-mode");

    try {
      await waitForCaptureFrame();

      const frontDataUrl = await domtoimage.toPng(board, {
        cacheBust: true,
      });

      document.body.classList.add("capture-mode-back");
      await waitForCaptureFrame();

      const backDataUrl = await domtoimage.toPng(board, {
        cacheBust: true,
      });

      const dataUrl = await mergeFrontAndBackCapture(frontDataUrl, backDataUrl);

      const link = document.createElement("a");
      link.download = "ruche.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erreur lors de la capture :", err);
      setExportErrorMessage(
        `Erreur lors de la capture : ${err?.message || "inconnue"}`,
      );
    } finally {
      document.body.classList.remove("capture-mode-back");
      document.body.classList.remove("capture-mode");
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteWarning(
        "Impossible d'envoyer l'invitation: l'email est obligatoire.",
      );
      return;
    }

    if (!isValidEmail(email)) {
      setInviteWarning(
        "Impossible d'envoyer l'invitation: veuillez saisir un email valide.",
      );
      return;
    }

    if (!onInviteCollaborator) {
      setInviteWarning("Invitation indisponible pour le moment.");
      return;
    }

    setInviteLoading(true);
    try {
      await onInviteCollaborator(email, inviteRole);
      setInviteEmail("");
      setInviteRole("COMMENT");
      setShowInviteModal(false);
      setInviteWarning("");
    } catch (err) {
      const message = err?.message || "";
      const normalized = message.toLowerCase();

      if (
        normalized.includes("aucun compte") ||
        normalized.includes("introuvable")
      ) {
        setInviteWarning(
          "Invitation impossible: aucun utilisateur n'existe avec cet email. Le collaborateur doit d'abord creer un compte.",
        );
      } else if (normalized.includes("invitation invalide")) {
        setInviteWarning(
          "Invitation invalide: verifiez l'email saisi puis reessayez.",
        );
      } else {
        setInviteWarning(message || "Invitation impossible.");
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
      setInviteWarning(err?.message || "Rôle invalide");
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
      setInviteWarning(
        err?.message || "Impossible de retirer ce collaborateur",
      );
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
      setInviteWarning(err?.message || "Impossible de quitter cette ruche");
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <button onClick={onReset}>
          <FontAwesomeIcon icon={faArrowsRotate} /> Réinitialiser
        </button>
        <button onClick={handleExport}>
          <FontAwesomeIcon icon={faCamera} /> Capture d'écran
        </button>
        {(canInvite && onInviteCollaborator) || canLeaveHive ? (
          <button onClick={() => setShowInviteModal(true)}>
            <FontAwesomeIcon icon={faUserPlus} /> Collaborateurs
          </button>
        ) : null}
        {onOpenComments && (
          <button onClick={onOpenComments} className="toolbar-comments-btn">
            <FontAwesomeIcon icon={faComments} /> Commentaires
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
            <h2>Gestion des collaborateurs</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setShowInviteModal(false)}
              aria-label="Fermer"
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
                    placeholder="email@exemple.com"
                    autoFocus
                  />
                </label>
                <label>
                  Rôle
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                  >
                    <option value="ADMIN">{getRoleLabel("ADMIN")}</option>
                    <option value="COMMENT">{getRoleLabel("COMMENT")}</option>
                    <option value="READ">{getRoleLabel("READ")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Invitation..." : "Inviter"}
                </button>
              </div>
            ) : null}

            {inviteWarning ? (
              <p className="form-error toolbar-modal-warning">
                {inviteWarning}
              </p>
            ) : null}

            <div className="toolbar-collaborators-section">
              <h3>Collaborateurs actuels</h3>
              {collaborators.length === 0 ? (
                <p className="comments-empty">
                  Aucun collaborateur pour le moment.
                </p>
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
                            value={collaborator.role}
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
                            Retirer
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canLeaveHive && onLeaveHive ? (
              <div className="toolbar-leave-section">
                <button
                  type="button"
                  className="toolbar-leave-btn"
                  onClick={() => setShowLeaveConfirmModal(true)}
                  disabled={leaveLoading}
                >
                  {leaveLoading ? "Sortie..." : "Quitter la ruche"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <UnifiedPromptModal
        isOpen={showLeaveConfirmModal}
        title="Quitter la ruche"
        message="Voulez-vous vraiment quitter cette ruche ?"
        confirmLabel="Quitter"
        onCancel={() => setShowLeaveConfirmModal(false)}
        onConfirm={async () => {
          setShowLeaveConfirmModal(false);
          await handleLeaveHive();
        }}
      />

      <UnifiedPromptModal
        isOpen={Boolean(exportErrorMessage)}
        title="Capture d'ecran"
        message={exportErrorMessage}
        cancelLabel="Fermer"
        confirmLabel="OK"
        onCancel={() => setExportErrorMessage("")}
        onConfirm={() => setExportErrorMessage("")}
      />
    </>
  );
}
