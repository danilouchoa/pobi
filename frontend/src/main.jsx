import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";
import theme from "./theme";
import { ToastProvider } from "./ui/feedback";
import { TokenProvider } from "./ui/ThemeProvider";

/**
 * main.jsx
 *
 * Ponto de entrada que agrupa providers compartilhados (React Query, Auth e Toasts).
 * Manter essa pilha documentada ajuda a entender a ordem de montagem e dependências entre hooks.
 */

const queryClient = new QueryClient();
const isDev = import.meta.env.DEV;
const rawGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleClientId = typeof rawGoogleClientId === "string" ? rawGoogleClientId.trim() : "";
const hasGoogleClientId = googleClientId.length > 0;

if (!hasGoogleClientId && isDev) {
  console.warn(
    "[Google OAuth] VITE_GOOGLE_CLIENT_ID não configurado. Login social ficará indisponível até definir o client ID no arquivo .env."
  );
}

const missingGoogleClientIdNotice = (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "1rem",
      padding: "2rem",
      textAlign: "center",
    }}
  >
    <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Configuração do Google OAuth ausente</h1>
    <p style={{ maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
      Defina a variável <code>VITE_GOOGLE_CLIENT_ID</code> no arquivo <code>.env</code> do frontend para
      habilitar o botão &quot;Login com Google&quot;. O valor deve ser o mesmo Client ID cadastrado na Google Cloud
      Console.
    </p>
    {isDev ? (
      <p style={{ maxWidth: 420, lineHeight: 1.6, margin: 0, fontSize: "0.9rem", color: "#666" }}>
        Dica: copie o identificador usado no backend (variável <code>GOOGLE_CLIENT_ID</code>) e cole em
        <code>VITE_GOOGLE_CLIENT_ID</code>. Reinicie <code>npm run dev</code> após alterar o arquivo.
      </p>
    ) : null}
  </div>
);

// Safeguard for libraries expecting a global React reference (legacy bundles, widgets).
if (typeof window !== "undefined") {
  window.React = window.React || React;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* ToastProvider garante feedback visual consistente em todas as rotas. */}
      <ToastProvider>
        <TokenProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {hasGoogleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                <BrowserRouter>
                  <AuthProvider>
                    <App />
                  </AuthProvider>
                </BrowserRouter>
              </GoogleOAuthProvider>
            ) : (
              missingGoogleClientIdNotice
            )}
          </ThemeProvider>
        </TokenProvider>
      </ToastProvider>
      {isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </StrictMode>
);
