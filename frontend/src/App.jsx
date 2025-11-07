import { useState } from "react";
import { useFinanceApp } from "./hooks/useFinanceApp";
import Tab from "./components/ui/Tab";
import Dashboard from "./components/Dashboard";
import Lancamentos from "./components/Lancamentos";
import Salario from "./components/Salario";
import Cadastros from "./components/Cadastros";
import Exportacao from "./components/Exportacao";
import Login from "./components/Login";
import { useAuth } from "./context/AuthProvider";

function Avatar({ name = "" }) {
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "U";

  return (
    <div className="size-8 grid place-items-center rounded-full bg-gray-900 text-white text-xs font-semibold shadow">
      {initials}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const { isAuthenticated, user, logout } = useAuth();
  const {
    state,
    month,
    setMonth,
    loading,
    error,
    refresh,
    createExpense,
    deleteExpense,
    createOrigin,
    deleteOrigin,
    createDebtor,
    deleteDebtor,
    saveSalaryForMonth,
  } = useFinanceApp();

  if (!isAuthenticated) return <Login />;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 antialiased">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Controle Financeiro v5.2 <span className="opacity-70">(Contas Dinâmicas)</span>
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Agora com cadastro dinâmico de contas, cartões e origens de despesa.
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm">
              <Avatar name={user?.name || user?.email} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Logado como</p>
                <p className="truncate font-semibold text-sm max-w-[180px]">
                  {user?.name ?? user?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-gray-50"
              >
                Sair
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button className="ml-3 underline" onClick={refresh}>
                Tentar novamente
              </button>
            </div>
          )}
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Tab id="dashboard" name="Resumo Mensal" activeTab={tab} setTab={setTab} />
          <Tab id="lancamentos" name="Lançamentos" activeTab={tab} setTab={setTab} />
          <Tab id="salary" name="Salário (Horas)" activeTab={tab} setTab={setTab} />
          <Tab id="cadastros" name="Cadastros" activeTab={tab} setTab={setTab} />
          <Tab id="export" name="Exportar CSV" activeTab={tab} setTab={setTab} />

          <div className="ml-auto flex items-center gap-2 rounded-xl bg-white px-3 py-2 border shadow-sm">
            <span className="text-sm text-gray-600">Mês de referência</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="h-4 w-40 rounded bg-gray-200" />
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
            </div>
          </div>
        ) : (
          <main className="space-y-6">
            {tab === "dashboard" && <Dashboard state={state} month={month} />}

            {tab === "lancamentos" && (
              <Lancamentos
                state={state}
                month={month}
                createExpense={createExpense}
                deleteExpense={deleteExpense}
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
                createDebtor={createDebtor}
                deleteDebtor={deleteDebtor}
              />
            )}

            {tab === "export" && <Exportacao state={state} month={month} />}
          </main>
        )}

        <footer className="mt-10 text-xs text-gray-500">
          Versão 5.2 (Dynamic Accounts).
        </footer>
      </div>
    </div>
  );
}

export default App;
