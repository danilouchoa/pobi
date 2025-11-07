import { useEffect } from "react";
import {
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  Box,
  Stack,
} from "@mui/material";
import Section from "./ui/Section";
import KPI from "./ui/KPI";
import Pie from "./ui/Pie";
import { toBRL, parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";

export default function Dashboard({ state, month }) {
  const originById = Object.fromEntries(state.origins.map((origin) => [origin.id, origin]));
  const debtorById = Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name]));
  useEffect(() => {
    console.log("Dashboard updated", {
      month,
      expenses: state.expenses.length,
      origins: state.origins.length,
      debtors: state.debtors.length,
    });
  }, [state.expenses, state.origins, state.debtors, month]);

  const expensesMonth = state.expenses.filter((expense) => (expense.date ?? "").slice(0, 7) === month);
  const myExpensesMonth = expensesMonth.filter((expense) => !expense.debtorId);
  const debtExpensesMonth = expensesMonth.filter((expense) => !!expense.debtorId);

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
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <KPI label="Salário Líquido (Mês)" value={toBRL(net)} sub={`Bruto ${toBRL(gross)}`} />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="Total Fatura (Mês)" value={toBRL(totalsByOrigin.total)} sub="Minhas + Dívidas de terceiros" />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="A Receber (Mês)" value={toBRL(totalDebts)} sub="Dívidas de terceiros" />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI
            label="Saldo Final Real (Mês)"
            value={toBRL(summary.saldoFinal)}
            sub="Líquido - Despesas (Minhas)"
            highlight={summary.saldoFinal >= 0}
          />
        </Grid>
      </Grid>

      <Section title="Despesas do Mês por Origem (Fatura Total)">
        <Grid container spacing={2}>
          {state.origins.map((origin) => (
            <Grid key={origin.id} item xs={12} md={4}>
              <KPI
                label={origin.name}
                value={toBRL(totalsByOrigin[origin.id] || 0)}
                sub={origin.type === "Cartão" ? `Limite: ${toBRL(parseNum(origin.limit))}` : undefined}
              />
            </Grid>
          ))}
          {state.origins.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">
                Nenhuma conta/origem cadastrada. Vá para a aba &quot;Cadastros&quot;.
              </Typography>
            </Grid>
          )}
        </Grid>
      </Section>

      <Section title="Distribuição por Categoria (Geral - Inclui Dívidas)">
        <Pie data={groupBySum(expensesMonth, (expense) => expense.category, (expense) => expense.amount)} />
      </Section>

      <Section title="Últimos Lançamentos (Mês)">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell>Devedor</TableCell>
                <TableCell>Parcela</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expensesMonth.slice(0, 10).map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{expense.date}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{originById[expense.originId]?.name ?? "Deletada"}</TableCell>
                  <TableCell>
                    {expense.debtorId ? (
                      <Chip
                        size="small"
                        label={debtorById[expense.debtorId] || "Deletado"}
                        color="secondary"
                        variant="outlined"
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{expense.parcela}</TableCell>
                  <TableCell align="right">{toBRL(expense.amount)}</TableCell>
                </TableRow>
              ))}
              {expensesMonth.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      Sem lançamentos para o mês selecionado.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>
    </Stack>
  );
}
