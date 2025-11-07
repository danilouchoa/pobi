import { useEffect, useState } from "react";
import Section from "./ui/Section";
import Field from "./ui/Field";
import KPI from "./ui/KPI";
import { parseNum, toBRL } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";

export default function Salario({ month, salary, saveSalary }) {
  const [form, setForm] = useState(() => ({
    hours: salary?.hours ?? DEFAULT_SALARY_TEMPLATE.hours,
    hourRate: salary?.hourRate ?? DEFAULT_SALARY_TEMPLATE.hourRate,
    taxRate: salary?.taxRate ?? DEFAULT_SALARY_TEMPLATE.taxRate,
    cnae: salary?.cnae ?? DEFAULT_SALARY_TEMPLATE.cnae,
  }));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm({
      hours: salary?.hours ?? DEFAULT_SALARY_TEMPLATE.hours,
      hourRate: salary?.hourRate ?? DEFAULT_SALARY_TEMPLATE.hourRate,
      taxRate: salary?.taxRate ?? DEFAULT_SALARY_TEMPLATE.taxRate,
      cnae: salary?.cnae ?? DEFAULT_SALARY_TEMPLATE.cnae,
    });
  }, [salary, month]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await saveSalary(month, form);
      setFeedback("Dados salvos com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar salário:", error);
      const message = error.response?.data?.message ?? error.message ?? "Erro ao salvar.";
      setFeedback(message);
    } finally {
      setSaving(false);
    }
  };

  const hoursNum = parseNum(form.hours);
  const hourRateNum = parseNum(form.hourRate);
  const taxRateNum = parseNum(form.taxRate);
  const gross = hoursNum * hourRateNum;
  const tax = gross * taxRateNum;
  const net = gross - tax;
  const netHourRate = net / Math.max(1, hoursNum);

  return (
    <Section
      title={`Salário por horas (Mês: ${month})`}
      subtitle="Os dados são salvos automaticamente para o mês de referência selecionado."
      right={feedback ? <span className="text-sm text-gray-500">{feedback}</span> : null}
    >
      <form className="grid md:grid-cols-4 gap-3" onSubmit={handleSubmit}>
        <Field label="Horas no mês" id="sal-hours">
          <input
            id="sal-hours"
            className="border rounded-lg px-3 py-2 w-full"
            inputMode="numeric"
            value={form.hours}
            onChange={(e) => handleChange("hours", e.target.value)}
          />
        </Field>
        <Field label="Valor/hora (R$)" id="sal-hourRate">
          <input
            id="sal-hourRate"
            className="border rounded-lg px-3 py-2 w-full"
            inputMode="decimal"
            value={form.hourRate}
            onChange={(e) => handleChange("hourRate", e.target.value)}
          />
        </Field>
        <Field label="Alíquota de imposto" id="sal-taxRate">
          <div className="flex items-center gap-2">
            <input
              id="sal-taxRate"
              className="border rounded-lg px-3 py-2 w-full"
              inputMode="decimal"
              value={form.taxRate}
              onChange={(e) => handleChange("taxRate", e.target.value)}
            />
            <span className="text-sm text-gray-500">(ex.: 0.06 = 6%)</span>
          </div>
        </Field>
        <Field label="CNAE" id="sal-cnae">
          <input
            id="sal-cnae"
            className="border rounded-lg px-3 py-2 w-full"
            value={form.cnae}
            onChange={(e) => handleChange("cnae", e.target.value)}
          />
        </Field>
        <div className="md:col-span-4 flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar salário"}
          </button>
          <span className="text-xs text-gray-500">Sincroniza com a API autenticada.</span>
        </div>
      </form>
      <div className="grid md:grid-cols-4 gap-4 mt-6">
        <KPI label="Bruto (Mês)" value={toBRL(gross)} />
        <KPI label={`Impostos (${(parseNum(form.taxRate) * 100).toFixed(2)}%)`} value={toBRL(tax)} />
        <KPI label="Líquido (Mês)" value={toBRL(net)} highlight />
        <KPI label="Valor hora líquido" value={toBRL(netHourRate)} />
      </div>
    </Section>
  );
}
