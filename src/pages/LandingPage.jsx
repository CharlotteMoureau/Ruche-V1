import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="page-shell">
      <h2>Bienvenue dans La Ruche</h2>
      <p>Choisissez ce que vous voulez faire.</p>
      <div className="cta-grid">
        <Link to={isAuthenticated ? "/profile" : "/login"} className="cta-card">
          Acceder au profil
        </Link>
        <Link
          to={isAuthenticated ? "/hives/new" : "/login"}
          className="cta-card"
        >
          Creer une Ruche
        </Link>
      </div>
    </section>
  );
}
