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
import { toBRL, parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";
import { formatCurrency, formatDate } from "../utils/formatters";

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

  const expensesMonth = state.expenses;
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
  const recurringTotal = expensesMonth.reduce((acc, expense) => (expense.recurring ? acc + parseNum(expense.amount) : acc), 0);
  const fixedTotal = expensesMonth.reduce((acc, expense) => (expense.fixed ? acc + parseNum(expense.amount) : acc), 0);
  const sharedTotal = expensesMonth.reduce((acc, expense) => acc + parseNum(expense.sharedAmount ?? 0), 0);
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

  const categoriesData = groupBySum(
    expensesMonth,
    (expense) => expense.category,
    (expense) => expense.amount
  );
  const categoriesTotal = categoriesData.reduce((acc, item) => acc + item.value, 0);
  const palette = ["#6366f1", "#3b82f6", "#10b981", "#f97316", "#ec4899", "#0ea5e9"];

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
        <Grid item xs={12} md={3}>
          <KPI label="Despesas Recorrentes" value={toBRL(recurringTotal)} sub="Somatório de recorrentes" />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="Despesas Fixas" value={toBRL(fixedTotal)} sub="Contas fixas cadastradas" />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="Compartilhadas" value={toBRL(sharedTotal)} sub="Divisões com terceiros" />
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
        {categoriesData.length > 0 ? (
          <Stack spacing={2}>
            {categoriesData.map((category, index) => {
              const percent = categoriesTotal
                ? Math.round((category.value / categoriesTotal) * 100)
                : 0;
              return (
                <Box key={category.name} sx={{ width: "100%" }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <Typography fontWeight={600}>{category.name}</Typography>
                    <Typography color="text.secondary">{percent}%</Typography>
                  </Stack>
                  <Box
                    sx={{
                      width: "100%",
                      bgcolor: "grey.200",
                      borderRadius: 999,
                      height: 12,
                    }}
                  >
                    <Box
                      sx={{
                        width: `${percent}%`,
                        bgcolor: palette[index % palette.length],
                        borderRadius: 999,
                        height: "100%",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            Nenhum lançamento encontrado para este mês.
          </Typography>
        )}
      </Section>

      <Section title="Últimos Lançamentos (Mês)">
        <TableContainer
          sx={{
            borderRadius: 3,
            boxShadow: "0 10px 25px rgba(15,23,42,.08)",
            border: "1px solid",
            borderColor: "grey.100",
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "grey.100" }}>
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: 600, px: 2, py: 1.5 }}>
                  Data
                </TableCell>
                <TableCell
                  align="left"
                  sx={{ fontWeight: 600, px: 2, py: 1.5, maxWidth: 220 }}
                >
                  Descrição
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, px: 2, py: 1.5 }}>
                  Origem
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, px: 2, py: 1.5 }}>
                  Devedor
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, px: 2, py: 1.5 }}>
                  Parcela
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, px: 2, py: 1.5 }}>
                  Valor
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expensesMonth.slice(0, 10).map((expense, idx) => (
                <TableRow
                  key={expense.id}
                  hover
                  sx={{
                    "&:nth-of-type(odd)": { bgcolor: "grey.50" },
                  }}
                >
                  <TableCell align="center" sx={{ px: 2, py: 1.25 }}>
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell
                    align="left"
                    sx={{
                      px: 2,
                      py: 1.25,
                      maxWidth: { xs: 140, md: 260 },
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={expense.description}
                  >
                    {expense.description}
                  </TableCell>
                  <TableCell align="center" sx={{ px: 2, py: 1.25 }}>
                    {originById[expense.originId]?.name ?? "Deletada"}
                  </TableCell>
                  <TableCell align="center" sx={{ px: 2, py: 1.25 }}>
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
                  <TableCell align="center" sx={{ px: 2, py: 1.25 }}>
                    {expense.parcela}
                  </TableCell>
                  <TableCell align="right" sx={{ px: 2, py: 1.25 }}>
                    {formatCurrency(expense.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {expensesMonth.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum lançamento encontrado para este mês.
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
