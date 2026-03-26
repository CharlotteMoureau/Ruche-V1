import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function ProtectedRoute({
  children,
  adminOnly = false,
  nonAdminOnly = false,
}) {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return <p className="page-status">{t("protectedRoute.loading")}</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (nonAdminOnly && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
