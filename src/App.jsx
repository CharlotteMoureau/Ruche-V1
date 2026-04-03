import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppHeader from "./components/AppHeader";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import InboxPage from "./pages/InboxPage";
import RucheEditorPage from "./pages/RucheEditorPage";
import AdminPage from "./pages/AdminPage";
import GdprPage from "./pages/GdprPage";
import WipPage from "./pages/WipPage";
import TutorialPage from "./pages/TutorialPage";
import { LanguageProvider } from "./context/LanguageContext";
import Footer from "./components/Footer";
import { useAuth } from "./context/AuthContext";
import "./styles/main.scss";

function HomeRoute() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
    return <LandingPage />;
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <LandingPage />;
}

export default function App() {
  useEffect(() => {
    const updateLayoutVars = () => {
      const header = document.querySelector(".site-header");
      const footer = document.querySelector("footer");
      const root = document.documentElement;

      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const footerHeight = footer ? footer.getBoundingClientRect().height : 80;

      root.style.setProperty(
        "--app-header-height",
        `${Math.round(headerHeight)}px`,
      );
      root.style.setProperty(
        "--app-footer-height",
        `${Math.round(footerHeight)}px`,
      );
    };

    const rafId = window.requestAnimationFrame(updateLayoutVars);
    window.addEventListener("resize", updateLayoutVars);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateLayoutVars);
    };
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <AppHeader />
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute nonAdminOnly>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute nonAdminOnly>
                <InboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hives/new"
            element={
              <ProtectedRoute nonAdminOnly>
                <RucheEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hives/:id"
            element={
              <ProtectedRoute nonAdminOnly>
                <RucheEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hives/:id"
            element={
              <ProtectedRoute adminOnly>
                <RucheEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/gdpr" element={<GdprPage />} />
          <Route path="/wip" element={<WipPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </AuthProvider>
    </LanguageProvider>
  );
}
