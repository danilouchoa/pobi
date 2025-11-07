import Section from "./ui/Section";
import { toBRL, parseNum } from "../utils/helpers";

export default function Exportacao({ state, month }) {
  const originById = Object.fromEntries(state.origins.map((o) => [o.id, o]));
  const debtorById = Object.fromEntries(state.debtors.map((d) => [d.id, d.name]));
  const expensesMonth = state.expenses.filter((e) => (e.date ?? "").slice(0, 7) === month);
  const salary = state.salaryHistory[month];

  const toCSV = (rows, header) => {
    const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
    const head = header.map(esc).join(";");
    const body = rows
      .map((r) => header.map((h) => esc(r[h] ?? "")).join(";"))
      .join("\n");
    return `${head}\n${body}`;
  };

  const downloadCSV = (filename, csvString) => {
    const blob = new Blob(["\ufeff" + csvString], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const exportExpenses = () => {
    const header = ["id", "data", "descricao", "origem", "categoria", "parcela", "devedor", "valor"];
    const rows = state.expenses.map((e) => ({
      id: e.id,
      data: e.date,
      descricao: e.description,
      origem: originById[e.originId]?.name ?? "Origem Deletada",
      categoria: e.category,
      parcela: e.parcela,
      devedor: e.debtorId ? debtorById[e.debtorId] : "-",
      valor: String(e.amount).replace(".", ","),
    }));
    downloadCSV(`lancamentos_gerais_${month}.csv`, toCSV(rows, header));
  };

  const exportSalary = () => {
    const header = [
      "mes",
      "horas_trabalhadas",
      "valor_hora",
      "salario_bruto",
      "aliquota",
      "impostos",
      "salario_liquido",
      "cnae",
    ];
    const s = salary;
    const row = [
      {
        mes: month,
        horas_trabalhadas: s.hours,
        valor_hora: s.hourRate,
        salario_bruto: String((parseNum(s.hours) * parseNum(s.hourRate)).toFixed(2)).replace(".", ","),
        aliquota: String((parseNum(s.taxRate) * 100).toFixed(2)).replace(".", ","),
        impostos: String((parseNum(s.hours) * parseNum(s.hourRate) * parseNum(s.taxRate)).toFixed(2)).replace(".", ","),
        salario_liquido: String((parseNum(s.hours) * parseNum(s.hourRate) * (1 - parseNum(s.taxRate))).toFixed(2)).replace(".", ","),
        cnae: s.cnae,
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
    const totalFatura = expensesMonth.reduce((acc, e) => acc + parseNum(e.amount), 0);
    const totalDebts = expensesMonth.filter((e) => e.debtorId).reduce((acc, e) => acc + parseNum(e.amount), 0);
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
    <Section
      title="Exportação CSV"
      subtitle="Separador: ponto-e-vírgula ; | Codificação: UTF-8 (BOM)"
    >
      <div className="flex flex-wrap gap-3">
        <button onClick={exportExpenses} className="px-4 py-2 rounded-xl bg-black text-white">
          Exportar Lançamentos (Geral)
        </button>
        <button onClick={exportSalary} className="px-4 py-2 rounded-xl bg-black text-white">
          Exportar Salário (Mês)
        </button>
        <button onClick={exportSummary} className="px-4 py-2 rounded-xl bg-black text-white">
          Exportar Resumo (Mês)
        </button>
        <button onClick={exportAll} className="px-4 py-2 rounded-xl bg-white border">
          Exportar Tudo (Mês)
        </button>
      </div>
      <div className="text-sm text-gray-600 mt-4">
        Os botões exportam os dados do mês: <strong>{month}</strong>.
      </div>
    </Section>
  );
}
