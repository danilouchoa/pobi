import { useState, useCallback, useEffect, useMemo } from "react";
import debounce from "lodash.debounce";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  Stack,
  Paper,
  Avatar,
  Button,
  Alert,
  Skeleton,
  Divider,
} from "@mui/material";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useFinanceApp } from "./hooks/useFinanceApp";
import Dashboard from "./pages/Dashboard";
import Lancamentos from "./pages/Lancamentos";
import Salario from "./components/Salario";
import Cadastros from "./components/Cadastros";
import Exportacao from "./components/Exportacao";
import Login from "./components/Login";
import Signup from "./components/Signup";
import CheckEmail from "./components/auth/CheckEmail";
import VerifyEmail from "./components/auth/VerifyEmail";
import { useAuth } from "./context/useAuth";
import { UnverifiedEmailBanner } from "./components/auth/UnverifiedEmailBanner";
import { registerEmailNotVerifiedHandler } from "./services/api";
import Onboarding from "./pages/Onboarding";

const TABS = [
  { id: "dashboard", label: "Resumo Mensal" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "salary", label: "Salário (Horas)" },
  { id: "cadastros", label: "Cadastros" },
  { id: "export", label: "Exportar CSV" },
];

const getInitials = (value = "") => {
  if (!value) return "U";
  const parts = value.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

function AuthenticatedApp() {
  const [tab, setTab] = useState("dashboard");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const {
    state,
    month,
    setMonth,
    viewMode,
    setViewMode,
    loading,
    error,
    refresh,
    createExpense,
  createExpenseBatch,
    deleteExpense,
    duplicateExpense,
    adjustExpense,
    createOrigin,
    deleteOrigin,
    updateOrigin,
    createDebtor,
    deleteDebtor,
    updateDebtor,
    saveSalaryForMonth,
    createRecurringExpense,
    fetchRecurringExpenses,
    fetchSharedExpenses,
    categories,
    addCategory,
  } = useFinanceApp();

  const debouncedRefresh = useMemo(() => debounce(refresh, 500), [refresh]);

  useEffect(() => {
    return () => debouncedRefresh.cancel();
  }, [debouncedRefresh]);

  useEffect(() => {
    const handler = ({ message, redirectPath }) => {
      const snackbarKey = enqueueSnackbar(message, {
        variant: "warning",
        action: (key) => (
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              closeSnackbar(key);
              navigate(redirectPath);
            }}
          >
            Ver opções de verificação
          </Button>
        ),
      });

      if (!snackbarKey) {
        navigate(redirectPath);
      }
    };

    registerEmailNotVerifiedHandler(handler);
    return () => registerEmailNotVerifiedHandler(null);
  }, [closeSnackbar, enqueueSnackbar, navigate]);

  const handleTabChange = useCallback(
    (_, value) => {
      if (value === tab) return;
      setTab(value);
      debouncedRefresh();
    },
    [tab, debouncedRefresh]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar
          sx={{ justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}
        >
          <Box>
            <Typography variant="h6" color="primary.main" fontWeight={800}>
              Finance App Project
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Controle financeiro pessoal com dados dinâmicos
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={user?.avatar ?? undefined}
              alt={user?.name ?? user?.email}
              sx={{ bgcolor: user?.avatar ? "transparent" : "primary.main" }}
            >
              {!user?.avatar ? getInitials(user?.name ?? user?.email) : null}
            </Avatar>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 1 }}
              >
                Logado como
              </Typography>
              <Typography variant="subtitle2" noWrap maxWidth={180}>
                {user?.name ?? user?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Conta vinculada ao Google: {user?.googleLinked ? "Sim" : "Não"}
              </Typography>
            </Box>
            <Button variant="outlined" color="primary" onClick={logout}>
              Sair
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        <UnverifiedEmailBanner />
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Stack spacing={2} divider={<Divider flexItem />}>
            <Box>
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Controle Financeiro v5.2
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Agora com cadastro dinâmico de contas, cartões e origens de
                despesa.
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "center",
              }}
            >
              <Tabs
                value={tab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                textColor="primary"
                indicatorColor="secondary"
                sx={{ flexGrow: 1 }}
              >
                {TABS.map(({ id, label }) => (
                  <Tab
                    key={id}
                    value={id}
                    label={label}
                    disableRipple
                    wrapped
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: 2,
                      minHeight: 48,
                      "&.Mui-selected": {
                        color: "secondary.main",
                      },
                    }}
                  />
                ))}
              </Tabs>
            </Box>
          </Stack>

          {error && (
            <Alert
              severity="error"
              sx={{ mt: 3 }}
              action={<Button onClick={refresh}>Recarregar</Button>}
            >
              {error}
            </Alert>
          )}
        </Paper>

        {loading ? (
          <Paper sx={{ p: 4 }}>
            <Skeleton variant="text" width={160} height={32} />
            <GridSkeleton />
          </Paper>
        ) : (
          <Stack spacing={4}>
            {tab === "dashboard" && (
              <Dashboard
                state={state}
                month={month}
                onChangeMonth={setMonth}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
              />
            )}
            {tab === "lancamentos" && (
              <Lancamentos
                state={state}
                month={month}
                onChangeMonth={setMonth}
                createExpense={createExpense}
                createExpenseBatch={createExpenseBatch}
                deleteExpense={deleteExpense}
                duplicateExpense={duplicateExpense}
                adjustExpense={adjustExpense}
                createRecurringExpense={createRecurringExpense}
                fetchRecurringExpenses={fetchRecurringExpenses}
                fetchSharedExpenses={fetchSharedExpenses}
                // Passamos as categorias dinâmicas para o formulário e para o modal de edição em massa
                categories={categories}
              />
            )}
            {tab === "salary" && (
              <Salario
                month={month}
                salary={state.salaryHistory[month]}
                saveSalary={saveSalaryForMonth}
              />
            )}
            {tab === "cadastros" && (
              <Cadastros
                origins={state.origins}
                debtors={state.debtors}
                createOrigin={createOrigin}
                deleteOrigin={deleteOrigin}
                updateOrigin={updateOrigin}
                createDebtor={createDebtor}
                deleteDebtor={deleteDebtor}
                updateDebtor={updateDebtor}
                categories={categories}
                // Cadastros é o ponto onde o usuário pode criar novas categorias locais
                addCategory={addCategory}
              />
            )}
            {tab === "export" && <Exportacao state={state} month={month} />}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />
      <Route path="/auth/check-email" element={<CheckEmail />} />
      <Route path="/auth/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

function App() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPath = location.pathname.startsWith("/auth/");
  const isVerificationFlow =
    location.pathname.startsWith("/auth/check-email") ||
    location.pathname.startsWith("/auth/verify-email");

  useEffect(() => {
    if (!isAuthenticated) return;

    const needsOnboarding = Boolean(user?.onboarding?.needsOnboarding);
    const isOnOnboardingPage = location.pathname === "/onboarding";
    
    // Only redirect if we're not already on the target page to prevent loops
    if (needsOnboarding && !isOnOnboardingPage) {
      navigate("/onboarding", { replace: true });
    } else if (!needsOnboarding && isOnOnboardingPage) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user?.onboarding?.needsOnboarding, location.pathname, navigate]);

  if (!isAuthenticated) {
    return <AuthRoutes />;
  }

  if (isAuthPath && !isVerificationFlow) {
    return <Navigate to="/" replace />;
  }

  if (isAuthPath && isVerificationFlow) {
    return <AuthRoutes />;
  }

  if (location.pathname === "/onboarding") {
    return <Onboarding />;
  }

  return <AuthenticatedApp />;
}

function GridSkeleton() {
  return (
    <Box
      sx={{
        mt: 3,
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
      }}
    >
      {[...Array(4)].map((_, index) => (
        <Skeleton key={index} variant="rounded" height={96} />
      ))}
    </Box>
  );
}

export default App;
