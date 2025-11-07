import Section from "./ui/Section";
import KPI from "./ui/KPI";
import Pie from "./ui/Pie";
import { toBRL, parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";

export default function Dashboard({ state, month }) {
  const originById = Object.fromEntries(state.origins.map((o) => [o.id, o]));
  const debtorById = Object.fromEntries(state.debtors.map((d) => [d.id, d.name]));
  const expensesMonth = state.expenses.filter((e) => (e.date ?? "").slice(0, 7) === month);
  const myExpensesMonth = expensesMonth.filter((e) => !e.debtorId);
  const debtExpensesMonth = expensesMonth.filter((e) => !!e.debtorId);

  const salaryData = state.salaryHistory[month] ?? DEFAULT_SALARY_TEMPLATE;
  const hours = parseNum(salaryData?.hours);
  const hourRate = parseNum(salaryData?.hourRate);
  const taxRate = parseNum(salaryData?.taxRate);
  const gross = hours * hourRate;
  const tax = gross * taxRate;
  const net = gross - tax;

  const totalsByOrigin = state.origins.reduce((acc, origin) => ({ ...acc, [origin.id]: 0 }), { total: 0 });
  for (const expense of expensesMonth) {
    const amount = parseNum(expense.amount);
    if (totalsByOrigin[expense.originId] !== undefined) {
      totalsByOrigin[expense.originId] += amount;
    }
    totalsByOrigin.total += amount;
  }

  const totalsMyExpensesByType = { Cartão: 0, Conta: 0, total: 0 };
  for (const expense of myExpensesMonth) {
    const amount = parseNum(expense.amount);
    const origin = originById[expense.originId];
    if (origin) {
      totalsMyExpensesByType[origin.type] += amount;
      totalsMyExpensesByType.total += amount;
    }
  }

  const totalDebts = debtExpensesMonth.reduce((acc, expense) => acc + parseNum(expense.amount), 0);
  const summary = {
    totalContas: totalsMyExpensesByType["Conta"],
    totalCartoes: totalsMyExpensesByType["Cartão"],
    totalMinhasDespesas: totalsMyExpensesByType["total"],
    impostos: tax,
    saldoFinal: net - totalsMyExpensesByType["total"],
  };

  const groupBySum = (arr, keyFn, valFn) => {
    const map = new Map();
    for (const item of arr) {
      const key = keyFn(item) ?? "-";
      const value = parseNum(valFn(item));
      map.set(key, (map.get(key) || 0) + value);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  };

  return (
    <>
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <KPI label="Salário Líquido (Mês)" value={toBRL(net)} sub={`Bruto ${toBRL(gross)}`} />
        <KPI label="Total Fatura (Mês)" value={toBRL(totalsByOrigin.total)} sub="Minhas + Dívidas de terceiros" />
        <KPI label="A Receber (Mês)" value={toBRL(totalDebts)} sub="Dívidas de terceiros" />
        <KPI
          label="Saldo Final Real (Mês)"
          value={toBRL(summary.saldoFinal)}
          sub="Líquido - Despesas (Minhas)"
          highlight={summary.saldoFinal >= 0}
        />
      </div>

      <Section title="Despesas do Mês por Origem (Fatura Total)">
        <div className="grid md:grid-cols-3 gap-4">
          {state.origins.map((origin) => (
            <KPI
              key={origin.id}
              label={origin.name}
              value={toBRL(totalsByOrigin[origin.id] || 0)}
              sub={origin.type === "Cartão" ? `Limite: ${toBRL(parseNum(origin.limit))}` : null}
            />
          ))}
          {state.origins.length === 0 && (
            <p className="text-gray-500">
              Nenhuma conta/origem cadastrada. Vá para a aba &quot;Cadastros&quot;.
            </p>
          )}
        </div>
      </Section>

      <Section title="Distribuição por Categoria (Geral - Inclui Dívidas)">
        <Pie data={groupBySum(expensesMonth, (expense) => expense.category, (expense) => expense.amount)} />
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
            {expensesMonth.slice(0, 10).map((expense) => (
              <tr key={expense.id} className={`border-t ${expense.debtorId ? "bg-yellow-50" : ""}`}>
                <td className="py-2">{expense.date}</td>
                <td>{expense.description}</td>
                <td>{originById[expense.originId]?.name ?? "Deletada"}</td>
                <td>{expense.debtorId ? debtorById[expense.debtorId] || "Deletado" : "-"}</td>
                <td>{expense.parcela}</td>
                <td className="text-right">{toBRL(expense.amount)}</td>
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
