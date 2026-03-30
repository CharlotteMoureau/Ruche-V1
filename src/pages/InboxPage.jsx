import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { apiFetch } from "../lib/api";

function formatDateTime(value, locale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRoleLabel(role, t) {
  if (role === "ADMIN") return t("toolbar.roleAdmin");
  if (role === "EDITOR" || role === "EDIT") return t("toolbar.roleEdit");
  if (role === "COMMENT") return t("toolbar.roleComment");
  if (role === "READ") return t("toolbar.roleRead");
  return role;
}

export default function InboxPage() {
  const { token } = useAuth();
  const { t, dateLocale } = useLanguage();
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  const loadInvitations = async () => {
    if (!token) return;

    setError("");
    try {
      const data = await apiFetch("/hives/invitations", { token });
      setInvitations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t("inbox.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        const data = await apiFetch("/hives/invitations", { token });
        if (mounted) {
          setInvitations(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || t("inbox.loadError"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [token, t]);

  const handleRespond = async (invitationId, action) => {
    if (!token) return;

    setActionId(invitationId);
    setError("");
    try {
      await apiFetch(`/hives/invitations/${invitationId}/${action}`, {
        method: "POST",
        token,
      });
      await loadInvitations();
    } catch (err) {
      setError(err.message || t("inbox.actionError"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="page-shell profile-page inbox-page">
      <h2>{t("inbox.title")}</h2>
      <p>{t("inbox.subtitle")}</p>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>{t("inbox.loading")}</p> : null}

      {!isLoading && invitations.length === 0 ? (
        <p>{t("inbox.empty")}</p>
      ) : null}

      {!isLoading && invitations.length > 0 ? (
        <>
          <h3>{t("inbox.title")}</h3>
          <ul className="list-grid">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <div className="hive-details">
                  <strong>
                    {invitation.hive?.title || t("inbox.unknownHive")}
                  </strong>
                  <br />
                  {t("inbox.invitedBy")}: {" "}
                  {invitation.inviter?.username ||
                    invitation.inviter?.email ||
                    "-"}
                  <br />
                  {t("inbox.role")}: {getRoleLabel(invitation.role, t)}
                  <br />
                  {t("inbox.sentAt")}: {" "}
                  {formatDateTime(invitation.createdAt, dateLocale)}
                </div>

                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-link button-link-open"
                    onClick={() => handleRespond(invitation.id, "accept")}
                    disabled={actionId === invitation.id}
                  >
                    {actionId === invitation.id
                      ? t("inbox.accepting")
                      : t("inbox.accept")}
                  </button>
                  <button
                    type="button"
                    className="button-link button-link-delete"
                    onClick={() => handleRespond(invitation.id, "decline")}
                    disabled={actionId === invitation.id}
                  >
                    {actionId === invitation.id
                      ? t("inbox.declining")
                      : t("inbox.decline")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
