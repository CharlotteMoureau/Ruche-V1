import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppHeader() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <Link to="/" className="brand-link">
        <img src="/hexagone.png" alt="hexagone" />
        <h1>La Ruche</h1>
        <img src="/abeille.png" alt="abeille" />
      </Link>

      <nav className="site-nav">
        {isAuthenticated ? (
          <>
            <span className="user-pill">{user?.username}</span>
            <Link to="/profile">Profil</Link>
            {isAdmin ? <Link to="/admin">Admin</Link> : null}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Deconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register">Creer un compte</Link>
          </>
        )}
      </nav>
    </header>
  );
}
