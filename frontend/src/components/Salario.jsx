import Section from "./ui/Section";
import Field from "./ui/Field";
import KPI from "./ui/KPI";
import { parseNum, toBRL } from "../utils/helpers";

export default function Salario({ state, setState, month }) {
  const salary = state.salaryHistory[month] || {
    hours: "178",
    hourRate: "95.24",
    taxRate: "0.06",
    cnae: "Suporte e manutenção de computadores",
  };

  const updateSalaryForCurrentMonth = (patch) => {
    setState((s) => {
      const current = s.salaryHistory[month] || salary;
      const updated = { ...current, ...patch };
      return { ...s, salaryHistory: { ...s.salaryHistory, [month]: updated } };
    });
  };

  const hoursNum = parseNum(salary.hours);
  const hourRateNum = parseNum(salary.hourRate);
  const taxRateNum = parseNum(salary.taxRate);
  const gross = hoursNum * hourRateNum;
  const tax = gross * taxRateNum;
  const net = gross - tax;
  const netHourRate = net / Math.max(1, hoursNum);

  return (
    <>
      <Section
        title={`Salário por horas (Mês: ${month})`}
        subtitle="Os dados são salvos automaticamente para o mês selecionado."
      >
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Horas no mês" id="sal-hours">
            <input
              id="sal-hours"
              className="border rounded-lg px-3 py-2 w-full"
              inputMode="numeric"
              value={salary.hours}
              onChange={(e) =>
                updateSalaryForCurrentMonth({ hours: e.target.value })
              }
            />
          </Field>

          <Field label="Valor/hora (R$)" id="sal-hourRate">
            <input
              id="sal-hourRate"
              className="border rounded-lg px-3 py-2 w-full"
              inputMode="decimal"
              value={salary.hourRate}
              onChange={(e) =>
                updateSalaryForCurrentMonth({ hourRate: e.target.value })
              }
            />
          </Field>

          <Field label="Alíquota de imposto" id="sal-taxRate">
            <div className="flex items-center gap-2">
              <input
                id="sal-taxRate"
                className="border rounded-lg px-3 py-2 w-full"
                inputMode="decimal"
                value={salary.taxRate}
                onChange={(e) =>
                  updateSalaryForCurrentMonth({ taxRate: e.target.value })
                }
              />
              <span className="text-sm text-gray-500">(ex.: 0.06 = 6%)</span>
            </div>
          </Field>

          <Field label="CNAE" id="sal-cnae">
            <input
              id="sal-cnae"
              className="border rounded-lg px-3 py-2 w-full"
              value={salary.cnae}
              onChange={(e) =>
                updateSalaryForCurrentMonth({ cnae: e.target.value })
              }
            />
          </Field>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mt-6">
          <KPI label="Bruto (Mês)" value={toBRL(gross)} />
          <KPI
            label={`Impostos (${(parseNum(salary.taxRate) * 100).toFixed(2)}%)`}
            value={toBRL(tax)}
          />
          <KPI label="Líquido (Mês)" value={toBRL(net)} highlight />
          <KPI label="Valor hora líquido" value={toBRL(netHourRate)} />
        </div>
      </Section>
    </>
  );
}
