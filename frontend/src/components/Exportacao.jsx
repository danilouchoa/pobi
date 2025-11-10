import { Stack, Button, Typography } from "@mui/material";
import Section from "./ui/Section";
import { parseNum } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";

export default function Exportacao({ state, month }) {
  const originById = Object.fromEntries(state.origins.map((origin) => [origin.id, origin]));
  const debtorById = Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name]));
  const expensesMonth = state.expenses.filter((expense) => (expense.date ?? "").slice(0, 7) === month);
  const salary = state.salaryHistory[month] ?? DEFAULT_SALARY_TEMPLATE;

  const toCSV = (rows, header) => {
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const head = header.map(escapeCell).join(";");
    const body = rows.map((row) => header.map((column) => escapeCell(row[column])).join(";")).join("\n");
    return `${head}\n${body}`;
  };

  const downloadCSV = (filename, csvString) => {
    const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const exportExpenses = () => {
    const header = ["id", "data", "descricao", "origem", "categoria", "parcela", "devedor", "valor"];
    const rows = state.expenses.map((expense) => ({
      id: expense.id,
      data: expense.date,
      descricao: expense.description,
      origem: originById[expense.originId]?.name ?? "Origem Deletada",
      categoria: expense.category,
      parcela: expense.parcela,
      devedor: expense.debtorId ? debtorById[expense.debtorId] : "-",
      valor: String(expense.amount).replace(".", ","),
    }));
    downloadCSV(`lancamentos_gerais_${month}.csv`, toCSV(rows, header));
  };

  const exportSalary = () => {
    const header = ["mes", "horas_trabalhadas", "valor_hora", "salario_bruto", "aliquota", "impostos", "salario_liquido", "cnae"];
    const hours = parseNum(salary.hours);
    const hourRate = parseNum(salary.hourRate);
    const taxRate = parseNum(salary.taxRate);
    const row = [
      {
        mes: month,
        horas_trabalhadas: salary.hours,
        valor_hora: salary.hourRate,
        salario_bruto: String((hours * hourRate).toFixed(2)).replace(".", ","),
        aliquota: String((taxRate * 100).toFixed(2)).replace(".", ","),
        impostos: String((hours * hourRate * taxRate).toFixed(2)).replace(".", ","),
        salario_liquido: String((hours * hourRate * (1 - taxRate)).toFixed(2)).replace(".", ","),
        cnae: salary.cnae,
      },
    ];
    downloadCSV(`salary_${month}.csv`, toCSV(row, header));
  };

  const exportSummary = () => {
    const header = [
      "mes",
      "total_despesas_minhas",
      "total_despesas_fatura",
      "total_a_receber",
      "impostos_salario",
      "salario_liquido",
      "saldo_final_real",
    ];
    const totalFatura = expensesMonth.reduce((acc, expense) => acc + parseNum(expense.amount), 0);
    const totalDebts = expensesMonth.filter((expense) => expense.debtorId).reduce((acc, expense) => acc + parseNum(expense.amount), 0);
    const totalMinhas = totalFatura - totalDebts;
    const impostos = parseNum(salary.taxRate) * parseNum(salary.hours) * parseNum(salary.hourRate);
    const liquido = parseNum(salary.hours) * parseNum(salary.hourRate) - impostos;
    const saldo = liquido - totalMinhas;

    const row = [
      {
        mes: month,
        total_despesas_minhas: String(totalMinhas.toFixed(2)).replace(".", ","),
        total_despesas_fatura: String(totalFatura.toFixed(2)).replace(".", ","),
        total_a_receber: String(totalDebts.toFixed(2)).replace(".", ","),
        impostos_salario: String(impostos.toFixed(2)).replace(".", ","),
        salario_liquido: String(liquido.toFixed(2)).replace(".", ","),
        saldo_final_real: String(saldo.toFixed(2)).replace(".", ","),
      },
    ];
    downloadCSV(`summary_${month}.csv`, toCSV(row, header));
  };

  const exportAll = () => {
    exportExpenses();
    exportSalary();
    exportSummary();
  };

  return (
    <Section title="Exportação CSV" subtitle="Arquivos com separador ';' e codificação UTF-8 (BOM).">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
        <Button onClick={exportExpenses}>Exportar Lançamentos (Geral)</Button>
        <Button onClick={exportSalary}>Exportar Salário (do Mês)</Button>
        <Button onClick={exportSummary}>Exportar Resumo (do Mês)</Button>
        <Button variant="outlined" color="secondary" onClick={exportAll}>
          Exportar tudo (do Mês)
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Os botões exportam os dados referentes ao mês selecionado: <strong>{month}</strong>.
      </Typography>
    </Section>
  );
}
