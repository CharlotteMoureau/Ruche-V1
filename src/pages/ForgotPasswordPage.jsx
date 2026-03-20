import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page-shell">
      <h2>Mot de passe oublié</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-info">{message}</p> : null}
        <button type="submit">Envoyer le lien</button>
      </form>
    </section>
  );
}
