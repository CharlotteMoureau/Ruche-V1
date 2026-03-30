import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import { useLanguage } from "../context/LanguageContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, roleOptions } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    passwordConfirm: "",
    role: "",
    roleOtherText: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (form.role || !roleOptions.length) return;

    setForm((prev) => ({
      ...prev,
      role: roleOptions[0].value,
    }));
  }, [form.role, roleOptions]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await register(form);
      navigate("/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-shell">
      <h2>{t("register.title")}</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          {t("register.username")}
          <input
            value={form.username}
            onChange={(e) => onChange("username", e.target.value)}
            required
            minLength={3}
          />
        </label>

        <label>
          {t("register.email")}
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            required
          />
        </label>

        <label>
          {t("register.firstName")}
          <input
            value={form.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            required
          />
        </label>

        <label>
          {t("register.lastName")}
          <input
            value={form.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            required
          />
        </label>

        <label>
          {t("register.role")}
          <select
            value={form.role}
            onChange={(e) => onChange("role", e.target.value)}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        {form.role === "Autre" ? (
          <label>
            {t("register.roleOther")}
            <input
              value={form.roleOtherText}
              onChange={(e) => onChange("roleOtherText", e.target.value)}
              required
            />
          </label>
        ) : null}

        <PasswordField
          label={t("register.password")}
          value={form.password}
          onChange={(e) => onChange("password", e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <PasswordField
          label={t("register.passwordConfirm")}
          value={form.passwordConfirm}
          onChange={(e) => onChange("passwordConfirm", e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        {error ? <p className="form-error">{error}</p> : null}
        <button disabled={loading} type="submit">
          {loading ? t("register.submitting") : t("register.submit")}
        </button>
      </form>
    </section>
  );
}
