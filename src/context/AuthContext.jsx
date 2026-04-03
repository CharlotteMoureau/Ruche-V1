/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "ruche_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(
    Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await apiFetch("/auth/me", { token });
        if (!isMounted) return;
        setUser(data.user);
        setIsAdmin(Boolean(data.isAdmin));
      } catch {
        if (!isMounted) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
        setIsAdmin(false);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMe();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = useMemo(
    () => async (identifier, password) => {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setIsAdmin(Boolean(data.isAdmin));
      setIsLoading(false);
    },
    [],
  );

  const register = useMemo(
    () => async (payload) => {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: payload,
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setIsAdmin(Boolean(data.isAdmin));
      setIsLoading(false);
    },
    [],
  );

  const logout = useMemo(
    () => () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setIsAdmin(false);
      setIsLoading(false);
    },
    [],
  );

  const refreshMe = useMemo(
    () => async () => {
      if (!token) return null;
      const data = await apiFetch("/auth/me?includeCollections=1", { token });
      setUser(data.user);
      setIsAdmin(Boolean(data.isAdmin));
      return data;
    },
    [token],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      isAdmin,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      refreshMe,
    }),
    [token, user, isAdmin, isLoading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
