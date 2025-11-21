import { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api, { registerUnauthorizedHandler, setAuthToken } from "../services/api";

/**
 * AuthProvider - Milestone #13: httpOnly Cookies Authentication
 * 
 * Mudanças de segurança:
 * - Access token armazenado APENAS em memória (state), não em localStorage
 * - Refresh token armazenado em cookie httpOnly (backend)
 * - Auto-refresh quando access token expira (interceptor 401)
 * - Logout chama backend para limpar cookie
 * 
 * Fluxo:
 * 1. Login → recebe accessToken no corpo + refreshToken em cookie httpOnly
 * 2. Access token expira (15min) → interceptor chama /auth/refresh automático
 * 3. Refresh renova accessToken usando cookie httpOnly
 * 4. Logout → backend remove cookie, frontend limpa state
 */

// IMPORTANTE: Não usar localStorage para tokens (vulnerável a XSS)
// User data pode ser cacheado para UX, mas não é crítico
const USER_KEY = "finance_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Access token APENAS em memória (não persiste entre reloads)
  const [token, setToken] = useState(null);
  
  // User data (pode ser cacheado para evitar re-fetch)
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const resetSession = useCallback(
    async (message = null) => {
      setToken(null);
      setUser(null);
      setAuthError(message);
      try {
        await queryClient.clear();
      } catch (err) {
        console.warn("[Auth] Failed to clear query cache:", err);
      }
    },
    [queryClient]
  );

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await api.get("/api/auth/me");
      setUser(data.user);
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message ?? "Sessão expirada. Faça login novamente.";
      await resetSession(message);
      throw error;
    }
  }, [resetSession]);

  // Definir token no axios quando mudar
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Cachear user no localStorage (apenas para UX, não é sensível)
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  /**
   * Tenta renovar access token usando refresh token (cookie httpOnly)
   * Chamado automaticamente quando access token expira (401)
   */
  const refreshAccessToken = useCallback(
    async () => {
      if (isRefreshing) return null;
      setIsRefreshing(true);
      try {
        const { data } = await api.post("/api/auth/refresh");
        setAuthToken(data.accessToken);
        setToken(data.accessToken);
        if (data.user) {
          setUser(data.user);
        } else {
          await fetchCurrentUser();
        }
        return data.accessToken;
      } catch (e) {
        console.warn("[Auth] Refresh token expired or invalid, redirecting to login", e);
        await resetSession("Sessão expirada. Faça login novamente.");
        return null;
      } finally {
        setIsRefreshing(false);
      }
      },
      [isRefreshing, fetchCurrentUser, resetSession]
    );

  // Registrar handler para 401 (access token expirado)
  useEffect(() => {
      registerUnauthorizedHandler(async () => {
        console.log("[Auth] Access token expired, attempting refresh...");
        const newToken = await refreshAccessToken();

        if (!newToken) {
          // Refresh falhou → redirecionar para login
          await resetSession("Sessão expirada. Faça login novamente.");
        }
      });
    }, [refreshAccessToken, resetSession]);

  /**
   * Tenta restaurar sessão ao carregar app
   * Se refresh token existir (cookie), renova access token
   */
  useEffect(() => {
    const restoreSession = async () => {
      // Se já tem token em memória, não precisa refresh
      if (token) return;
      
      // Se tem user cacheado, tenta refresh
      if (user) {
        setLoading(true);
        await refreshAccessToken();
        setLoading(false);
      }
    };

    restoreSession();
  }, [token, user, refreshAccessToken]); // Executar quando mudar sessão/refresh

  /**
   * Login com email e senha
   * Backend retorna accessToken no corpo + define refreshToken em cookie
   */
  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });

      // Limpar cache do QueryClient antes de configurar nova sessão
      try {
        await queryClient.clear();
      } catch (e) {
        console.warn("[Auth] Failed to clear query cache before login:", e);
      }
      
      // Backend retorna { user, accessToken }
      // refreshToken vem como cookie httpOnly (não acessível aqui)
      setToken(data.accessToken);
      setUser(data.user);
      
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? "Credenciais inválidas.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Cadastro com email/senha
   */
  const registerLocal = useCallback(async ({ name, email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post("/api/auth/register", { name, email, password });

      try {
        await queryClient.clear();
      } catch (e) {
        console.warn("[Auth] Failed to clear query cache before register:", e);
      }

      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? "Não foi possível criar sua conta.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Login via Google credential (ID token)
   * Backend expects { credential }
   */
  const loginWithGoogle = useCallback(async ({ credential }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post('/api/auth/google', { credential });

      try {
        await queryClient.clear();
      } catch (e) {
        console.warn('[Auth] Failed to clear query cache before google login:', e);
      }

      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? 'Não foi possível autenticar com Google.';
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Resolve conflito de conta LOCAL x GOOGLE com Google como canônico
   */
  const resolveGoogleConflict = useCallback(async ({ credential }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post('/api/auth/google/resolve-conflict', {
        credential,
        strategy: 'merge_using_google_as_canonical',
      });

      try {
        await queryClient.clear();
      } catch (e) {
        console.warn('[Auth] Failed to clear query cache after google conflict resolution:', e);
      }

      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? 'Não foi possível unificar as contas.';
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Vincula uma conta Google a um usuário autenticado
   */
  const linkGoogleAccount = useCallback(async ({ credential }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data } = await api.post('/api/auth/link/google', { credential });

      try {
        await queryClient.clear();
      } catch (e) {
        console.warn('[Auth] Failed to clear query cache after linking google:', e);
      }

      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? 'Não foi possível vincular sua conta Google.';
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Logout seguro
   * 1. Chama backend para limpar cookie httpOnly
   * 2. Limpa state local
   */
  const logout = useCallback(async () => {
    try {
      // Chamar backend para limpar cookie
      await api.post("/api/auth/logout");
    } catch (error) {
      console.error("[Auth] Error during logout:", error);
      // Mesmo com erro, limpar state local
    } finally {
      await resetSession(null);
    }
  }, [resetSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      register: registerLocal,
      loginWithGoogle,
      resolveGoogleConflict,
      linkGoogleAccount,
      logout,
      authError,
      loading,
      isAuthenticated: Boolean(token),
      refreshAccessToken,
    }),
    [token, user, authError, loading, refreshAccessToken, login, registerLocal, loginWithGoogle, resolveGoogleConflict, linkGoogleAccount, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth extraído para arquivo separado para evitar conflito com Fast Refresh
// Named export of context only; hook lives in separate file for Fast Refresh compliance.
export { AuthContext };
