import { useState } from "react";
import { useFinanceApp } from "./hooks/useFinanceApp";
import Tab from "./components/ui/Tab";
import Dashboard from "./components/Dashboard";
import Lancamentos from "./components/Lancamentos";
import Salario from "./components/Salario";
import Cadastros from "./components/Cadastros";
import Exportacao from "./components/Exportacao";

function App() {
  const [tab, setTab] = useState("dashboard");
  const { state, setState, month, setMonth } = useFinanceApp();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Controle Financeiro v5.2 (React Modular)</h1>
        <p className="text-gray-600">Versão React usando Vite e Tailwind</p>
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

      {tab === "dashboard" && <Dashboard state={state} month={month} />}
      {tab === "lancamentos" && <Lancamentos state={state} setState={setState} month={month} />}
      {tab === "salary" && <Salario state={state} setState={setState} month={month} />}
      {tab === "cadastros" && <Cadastros state={state} setState={setState} />}
      {tab === "export" && <Exportacao state={state} month={month} />}
    </div>
  );
}

export default App;
