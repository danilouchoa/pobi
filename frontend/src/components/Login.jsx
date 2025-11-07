import { useState } from "react";
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-center">Finance App</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-gray-600 block mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm text-gray-600 block mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>

          {(feedback || authError) && (
            <p className="text-sm text-red-600">
              {feedback ?? authError}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-black text-white rounded-lg py-2"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
