import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <section className="page-shell">
        <h2>Bienvenue dans La Ruche</h2>
        <p>Chargement de votre session...</p>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <h2>Bienvenue dans La Ruche</h2>
      <p>
        {isAuthenticated
          ? "Continuez votre activité en quelques clics."
          : "Connectez-vous ou créez votre compte pour commencer."}
      </p>
      <div className="cta-grid">
        {isAuthenticated ? (
          <>
            <Link to="/profile" className="cta-card">
              Accéder au profil
            </Link>
            <Link to="/hives/new" className="cta-card">
              Créer une Ruche
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="cta-card">
              Se connecter
            </Link>
            <Link to="/register" className="cta-card">
              Créer un compte
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
