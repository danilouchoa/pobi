import { useState } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Stack,
  Button,
  Alert,
} from "@mui/material";
import { useAuth } from "../context/AuthProvider";

export default function Login() {
  const { login, authError, loading } = useAuth();
  const [form, setForm] = useState({
    email: "danilo.uchoa@finance.app",
    password: "finance123",
  });
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    try {
      await login(form);
    } catch (error) {
      const message = error.response?.data?.message ?? "Não foi possível fazer login.";
      setFeedback(message);
    }
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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
            {(feedback || authError) && (
              <Alert severity="error">{feedback ?? authError}</Alert>
            )}
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
