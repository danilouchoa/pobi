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

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Controle Financeiro v5.2 (React Modular)</h1>
            <p className="text-gray-600">Versão React usando Vite e Tailwind</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-gray-500">Logado como</p>
              <p className="font-semibold text-sm">{user?.name ?? user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1 text-sm border rounded-lg"
            >
              Sair
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error} <button className="underline ml-2" onClick={refresh}>Tentar novamente</button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center mb-4">
        <Tab id="dashboard" name="Resumo" activeTab={tab} setTab={setTab} />
        <Tab id="lancamentos" name="Lançamentos" activeTab={tab} setTab={setTab} />
        <Tab id="salary" name="Salário" activeTab={tab} setTab={setTab} />
        <Tab id="cadastros" name="Cadastros" activeTab={tab} setTab={setTab} />
        <Tab id="export" name="Exportar" activeTab={tab} setTab={setTab} />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">Mês</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded-lg px-2 py-1"
          />
        </div>
      </div>

      {loading && (
        <div className="mb-4 text-sm text-gray-500">Carregando dados...</div>
      )}

      {!loading && (
        <>
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
        </>
      )}
    </div>
  );
}

export default App;
