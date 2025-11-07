import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { registerUnauthorizedHandler, setAuthToken } from "../services/api";

const TOKEN_KEY = "finance_token";
const USER_KEY = "finance_user";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setAuthError("Sessão expirada. Faça login novamente.");
      setToken(null);
      setUser(null);
    });
  }, []);

  const login = async ({ email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? "Credenciais inválidas.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      authError,
      loading,
      isAuthenticated: Boolean(token),
    }),
    [token, user, authError, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
};
