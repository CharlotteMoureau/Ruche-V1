import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";

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
      <h2>Creer un compte</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          Nom d'utilisateur (unique)
          <input
            value={form.username}
            onChange={(e) => onChange("username", e.target.value)}
            required
            minLength={3}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            required
          />
        </label>

        <label>
          Role
          <select
            value={form.role}
            onChange={(e) => onChange("role", e.target.value)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        {form.role === "Autre" ? (
          <label>
            Precisez votre role
            <input
              value={form.roleOtherText}
              onChange={(e) => onChange("roleOtherText", e.target.value)}
              required
            />
          </label>
        ) : null}

        <PasswordField
          label="Mot de passe"
          value={form.password}
          onChange={(e) => onChange("password", e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <PasswordField
          label="Confirmation du mot de passe"
          value={form.passwordConfirm}
          onChange={(e) => onChange("passwordConfirm", e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        {error ? <p className="form-error">{error}</p> : null}
        <button disabled={loading} type="submit">
          {loading ? "Creation..." : "Creer mon compte"}
        </button>
      </form>
    </section>
  );
}
