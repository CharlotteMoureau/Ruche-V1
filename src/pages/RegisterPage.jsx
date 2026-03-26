import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import { useLanguage } from "../context/LanguageContext";

const ROLE_OPTIONS = [
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

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, roleOptions } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
    role: ROLE_OPTIONS[0],
    roleOtherText: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
