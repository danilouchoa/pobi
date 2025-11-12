import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Stack,
  Button,
  Alert,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { GoogleLogin } from "@react-oauth/google";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { useToast } from "../hooks/useToast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, loginWithGoogle, authError, loading } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    email: "danilo.uchoa@finance.app",
    password: "finance123",
  });
  const [feedback, setFeedback] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const showFeedback = useCallback((severity, message, options = {}) => {
    const {
      autoClose,
      dismissible = severity !== "success",
      source = "local",
    } = options;

    setFeedback({
      id: `${Date.now()}-${Math.random()}`,
      severity,
      message,
      dismissible,
      source,
      autoClose:
        autoClose !== undefined
          ? autoClose
          : severity === "success"
          ? 2500
          : severity === "info"
          ? 4000
          : undefined,
    });
  }, []);

  useEffect(() => {
    if (authError) {
      showFeedback("error", authError, { source: "auth" });
    } else {
      setFeedback((prev) => (prev?.source === "auth" ? null : prev));
    }
  }, [authError, showFeedback]);

  useEffect(() => {
    if (!feedback?.autoClose) return undefined;

    const timer = window.setTimeout(() => {
      setFeedback((prev) => (prev?.id === feedback.id ? null : prev));
    }, feedback.autoClose);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    const emailValue = form.email.trim();
    const passwordValue = form.password;

    if (!emailValue || !passwordValue.trim()) {
      showFeedback("error", "Informe e-mail e senha para continuar.");
      return;
    }

    if (!EMAIL_REGEX.test(emailValue)) {
      showFeedback("error", "Digite um e-mail válido.");
      return;
    }

    if (emailValue !== form.email) {
      setForm((prev) => ({ ...prev, email: emailValue }));
    }

    try {
      await login({ email: emailValue, password: passwordValue });
      toast.success({ message: "Login realizado! Bem-vindo de volta." });
      showFeedback("success", "Login realizado! Redirecionando...");
    } catch (error) {
      if (!error.response?.data?.message) {
        showFeedback("error", "Não foi possível fazer login.");
      }
    }
  };

  const handleGoogleSuccess = async (res) => {
    setFeedback(null);

    const credential = res?.credential;
    if (!credential) {
      showFeedback("error", "Credencial do Google não disponível.");
      return;
    }

    setGoogleLoading(true);

    try {
      await loginWithGoogle({ credential });
      toast.success({ message: "Login com Google concluído." });
      showFeedback("success", "Login com Google concluído! Redirecionando...");
    } catch (error) {
      if (!error.response?.data?.message) {
        showFeedback("error", "Não foi possível autenticar com Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    showFeedback("error", "Erro ao autenticar com Google.");
    setGoogleLoading(false);
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFeedback(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h5" fontWeight={700} align="center" gutterBottom>
            Finance App
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Acesse sua conta para continuar
          </Typography>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <AnimatePresence>
              {feedback && (
                <motion.div
                  key={feedback.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert
                    severity={feedback.severity}
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                    action={
                      feedback.dismissible ? (
                        <IconButton
                          aria-label="Fechar aviso"
                          size="small"
                          onClick={() => setFeedback(null)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : undefined
                    }
                  >
                    {feedback.message}
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              value={form.email}
              onChange={handleChange("email")}
              required
            />
            <TextField
              label="Senha"
              type="password"
              fullWidth
              value={form.password}
              onChange={handleChange("password")}
              required
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={
                loading ? (
                  <CircularProgress size={18} thickness={4} color="inherit" />
                ) : null
              }
            >
              {loading ? "Autenticando..." : "Entrar"}
            </Button>
            <Box sx={{ position: "relative" }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
              />
              {googleLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(255,255,255,0.72)",
                    borderRadius: 2,
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
