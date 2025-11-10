import { useEffect, useMemo } from "react";
import {
  Box,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Section from "../components/ui/Section";
import KPI from "../components/ui/KPI";
import MonthNavigator from "../components/MonthNavigator";
import { toBRL, parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";
import { formatCurrency, formatDate } from "../utils/formatters";
import type { Debtor, Expense, Origin } from "../types";

const palette = ["#6366f1", "#3b82f6", "#10b981", "#f97316", "#ec4899", "#0ea5e9"] as const;

type DashboardSalaryRecord = {
  id?: string;
  month: string;
  hours: string | number;
  hourRate: string | number;
  taxRate: string | number;
  cnae?: string | null;
};

type DashboardState = {
  expenses: Expense[];
  origins: Origin[];
  debtors: Debtor[];
  salaryHistory: Record<string, DashboardSalaryRecord>;
  recurringExpenses: Expense[];
  sharedExpenses: Expense[];
};

type DashboardProps = {
  state: DashboardState;
  month: string;
  onChangeMonth: (value: string) => void;
  viewMode: "calendar" | "billing";
  onChangeViewMode: (mode: "calendar" | "billing") => void;
};

const groupBySum = <T,>(
  items: T[],
  keyFn: (item: T) => string | null | undefined,
  valueFn: (item: T) => number | string
) => {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) ?? "-";
    const value = parseNum(valueFn(item));
    map.set(key, (map.get(key) ?? 0) + value);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

export default function Dashboard({ state, month, onChangeMonth, viewMode, onChangeViewMode }: DashboardProps) {
  const originById = useMemo(
    () => Object.fromEntries(state.origins.map((origin) => [origin.id, origin])),
    [state.origins]
  );
  const debtorById = useMemo(
    () => Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name])),
    [state.debtors]
  );

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
  const debtExpensesMonth = expensesMonth.filter((expense) => Boolean(expense.debtorId));

  const salaryData = state.salaryHistory[month] ?? DEFAULT_SALARY_TEMPLATE;
  const hours = parseNum(salaryData?.hours);
  const hourRate = parseNum(salaryData?.hourRate);
  const taxRate = parseNum(salaryData?.taxRate);
  const gross = hours * hourRate;
  const tax = gross * taxRate;
  const net = gross - tax;

  const totalsByOrigin: Record<string, number> = { total: 0 };
  state.origins.forEach((origin) => {
    totalsByOrigin[origin.id] = 0;
  });
  expensesMonth.forEach((expense) => {
    const amount = parseNum(expense.amount);
    if (expense.originId && totalsByOrigin[expense.originId] !== undefined) {
      totalsByOrigin[expense.originId] += amount;
    }
    totalsByOrigin.total += amount;
  });

  const totalsMyExpensesByType: Record<string, number> = { Cartão: 0, Conta: 0, total: 0 };
  myExpensesMonth.forEach((expense) => {
    const amount = parseNum(expense.amount);
    const origin = expense.originId ? originById[expense.originId] : undefined;
    if (origin) {
      totalsMyExpensesByType[origin.type] += amount;
      totalsMyExpensesByType.total += amount;
    }
  });

  const totalDebts = debtExpensesMonth.reduce((acc, expense) => acc + parseNum(expense.amount), 0);
  const recurringTotal = expensesMonth.reduce(
    (acc, expense) => (expense.recurring ? acc + parseNum(expense.amount) : acc),
    0
  );
  const fixedTotal = expensesMonth.reduce(
    (acc, expense) => (expense.fixed ? acc + parseNum(expense.amount) : acc),
    0
  );
  const sharedTotal = expensesMonth.reduce(
    (acc, expense) => acc + parseNum(expense.sharedAmount ?? 0),
    0
  );

  const summary = {
    totalContas: totalsMyExpensesByType["Conta"],
    totalCartoes: totalsMyExpensesByType["Cartão"],
    totalMinhasDespesas: totalsMyExpensesByType["total"],
    impostos: tax,
    saldoFinal: net - totalsMyExpensesByType["total"],
  };

  const categoriesData = groupBySum(
    expensesMonth,
    (expense) => expense.category,
    (expense) => expense.amount
  );
  const categoriesTotal = categoriesData.reduce((acc, item) => acc + item.value, 0);

  const handleModeChange = (_: unknown, value: "calendar" | "billing" | null) => {
    if (value) {
      onChangeViewMode(value);
    }
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Navegação mensal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use as setas para viajar entre meses e escolha se prefere visualizar por calendário ou fatura de cartão.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Modo atual: {viewMode === "billing" ? "Faturas (Cartões)" : "Calendário (Todos)"}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <MonthNavigator month={month} onChange={onChangeMonth} />
          <ToggleButtonGroup
            size="small"
            color="primary"
            value={viewMode}
            exclusive
            onChange={handleModeChange}
          >
            <ToggleButton value="calendar">Calendário</ToggleButton>
            <ToggleButton value="billing">Fatura</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

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
              const percent = categoriesTotal ? Math.round((category.value / categoriesTotal) * 100) : 0;
              return (
                <Box key={category.name} sx={{ width: "100%" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
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
          <Typography color="text.secondary">Nenhum lançamento encontrado para este mês.</Typography>
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
                <TableCell align="left" sx={{ fontWeight: 600, px: 2, py: 1.5, maxWidth: 220 }}>
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
              {expensesMonth.slice(0, 10).map((expense) => (
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
                    {expense.originId ? originById[expense.originId]?.name ?? "Deletada" : "-"}
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
