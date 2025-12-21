import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Alert } from "../../ui/Alert";
import { Card } from "../../ui/Card";
import { tokens } from "../../ui/tokens";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const CheckEmailPage = lazy(() => import("./pages/CheckEmailPage"));

function AuthRoutesFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: tokens.spacing.lg }}>
      <Card>
        <Alert
          variant="info"
          title="Carregando autenticação"
          message="Preparando sua experiência de acesso com segurança."
        />
      </Card>
    </div>
  );
}

export function AuthRoutes() {
  return (
    <Suspense fallback={<AuthRoutesFallback />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="check-email" element={<CheckEmailPage />} />
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
    </Suspense>
  );
}
