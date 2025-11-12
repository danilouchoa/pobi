import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";
import { GoogleOAuthProvider } from '@react-oauth/google';
import theme from "./theme";
import { ToastProvider } from "./ui/feedback";

/**
 * main.jsx
 *
 * Ponto de entrada que agrupa providers compartilhados (React Query, Auth e Toasts).
 * Manter essa pilha documentada ajuda a entender a ordem de montagem e dependências entre hooks.
 */

const queryClient = new QueryClient();
const isDev = import.meta.env.DEV;

// Safeguard for libraries expecting a global React reference (legacy bundles, widgets).
if (typeof window !== "undefined") {
  window.React = window.React || React;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* ToastProvider garante feedback visual consistente em todas as rotas. */}
      <ToastProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </GoogleOAuthProvider>
        </ThemeProvider>
      </ToastProvider>
      {isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </StrictMode>
);
