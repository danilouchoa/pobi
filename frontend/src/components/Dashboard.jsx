import Section from "./ui/Section";
import KPI from "./ui/KPI";
import Pie from "./ui/Pie";
import { toBRL, parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";

export default function Dashboard({ state, month }) {
  // Mapeamentos
  const originById = Object.fromEntries(state.origins.map((o) => [o.id, o]));
  const debtorById = Object.fromEntries(state.debtors.map((d) => [d.id, d.name]));

  // Filtra lançamentos do mês atual
  const expensesMonth = state.expenses.filter(
    (e) => (e.date ?? "").slice(0, 7) === month
  );

  const myExpensesMonth = expensesMonth.filter((e) => !e.debtorId);
  const debtExpensesMonth = expensesMonth.filter((e) => !!e.debtorId);

  // Calcula salário
  const salaryData = state.salaryHistory[month] ?? DEFAULT_SALARY_TEMPLATE;
  const hours = parseNum(salaryData?.hours);
  const hourRate = parseNum(salaryData?.hourRate);
  const taxRate = parseNum(salaryData?.taxRate);
  const gross = hours * hourRate;
  const tax = gross * taxRate;
  const net = gross - tax;

  // Totais por origem
  const totalsByOrigin = state.origins.reduce((acc, o) => ({ ...acc, [o.id]: 0 }), { total: 0 });
  for (const e of expensesMonth) {
    const amount = parseNum(e.amount);
    if (totalsByOrigin[e.originId] !== undefined) totalsByOrigin[e.originId] += amount;
    totalsByOrigin.total += amount;
  }

  // Despesas minhas por tipo (Cartão/Conta)
  const totalsMyExpensesByType = { Cartão: 0, Conta: 0, total: 0 };
  for (const e of myExpensesMonth) {
    const amount = parseNum(e.amount);
    const origin = originById[e.originId];
    if (origin) {
      totalsMyExpensesByType[origin.type] += amount;
      totalsMyExpensesByType.total += amount;
    }
  }

  // Dívidas (a receber)
  const totalDebts = debtExpensesMonth.reduce(
    (acc, e) => acc + parseNum(e.amount),
    0
  );

  // Resumo final
  const summary = {
    totalContas: totalsMyExpensesByType["Conta"],
    totalCartoes: totalsMyExpensesByType["Cartão"],
    totalMinhasDespesas: totalsMyExpensesByType["total"],
    impostos: tax,
    saldoFinal: net - totalsMyExpensesByType["total"],
  };

  // Gráfico por categoria
  const groupBySum = (arr, keyFn, valFn) => {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x) ?? "-";
      const v = parseNum(valFn(x));
      m.set(k, (m.get(k) || 0) + v);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  };

  return (
    <>
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <KPI label="Salário Líquido" value={toBRL(net)} sub={`Bruto ${toBRL(gross)}`} />
        <KPI label="Total Fatura (Mês)" value={toBRL(totalsByOrigin.total)} sub="Minhas + Dívidas de terceiros" />
        <KPI label="A Receber (Mês)" value={toBRL(totalDebts)} sub="Dívidas de terceiros" />
        <KPI
          label="Saldo Final Real"
          value={toBRL(summary.saldoFinal)}
          sub="Líquido - Despesas Minhas"
          highlight={summary.saldoFinal >= 0}
        />
      </div>

      <Section title="Despesas por Origem (Fatura Total)">
        <div className="grid md:grid-cols-3 gap-4">
          {state.origins.map((origin) => (
            <KPI
              key={origin.id}
              label={origin.name}
              value={toBRL(totalsByOrigin[origin.id] || 0)}
              sub={
                origin.type === "Cartão"
                  ? `Limite: ${toBRL(parseNum(origin.limit))}`
                  : null
              }
            />
          ))}
          {state.origins.length === 0 && (
            <p className="text-gray-500">Nenhuma conta/origem cadastrada.</p>
          )}
        </div>
      </Section>

      <Section title="Distribuição por Categoria (Geral)">
        <Pie data={groupBySum(expensesMonth, (e) => e.category, (e) => e.amount)} />
      </Section>

      <Section title="Últimos Lançamentos (Mês)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Data</th>
              <th>Descrição</th>
              <th>Origem</th>
              <th>Devedor</th>
              <th>Parcela</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {expensesMonth.slice(0, 10).map((e) => (
              <tr key={e.id} className={`border-t ${e.debtorId ? "bg-yellow-50" : ""}`}>
                <td className="py-2">{e.date}</td>
                <td>{e.description}</td>
                <td>{originById[e.originId]?.name ?? "Deletada"}</td>
                <td>{e.debtorId ? debtorById[e.debtorId] || "Deletado" : "-"}</td>
                <td>{e.parcela}</td>
                <td className="text-right">{toBRL(e.amount)}</td>
              </tr>
            ))}
            {expensesMonth.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-4">
                  Sem lançamentos para o mês selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>
    </>
  );
}
