import { useState } from "react";
import Section from "./ui/Section";
import Field from "./ui/Field";
import { uid, todayISO, parseNum, toBRL } from "../utils/helpers";

export default function Lancamentos({ state, setState, month }) {
  const originById = Object.fromEntries(state.origins.map((o) => [o.id, o]));
  const debtorById = Object.fromEntries(state.debtors.map((d) => [d.id, d.name]));
  const expensesMonth = state.expenses.filter((e) => (e.date ?? "").slice(0, 7) === month);

  const [expForm, setExpForm] = useState({
    date: todayISO(),
    description: "",
    originId: state.origins[0]?.id || "",
    category: "Outros",
    isInstallment: false,
    installments: "",
    debtorId: "",
    amount: "",
  });

  const CATEGORIAS = [
    "Impostos e encargos",
    "Moradia",
    "Comunicação e Internet",
    "Compras / E-commerce",
    "Lazer / Viagem",
    "Finanças pessoais",
    "Serviços / Assinaturas",
    "Educação / Cursos",
    "Outros",
  ];

  const addExpense = () => {
    const totalAmount = parseNum(expForm.amount);
    const description = expForm.description.trim();
    if (!description || !expForm.originId || totalAmount <= 0) return;

    const isInstallment = expForm.isInstallment;
    const numInstallments = parseInt(expForm.installments, 10);

    if (isInstallment && numInstallments > 1) {
      // Parcelado
      const installmentAmount = totalAmount / numInstallments;
      const newExpenses = [];
      const startDate = new Date(expForm.date + "T12:00:00Z");

      for (let i = 0; i < numInstallments; i++) {
        const installmentDate = new Date(startDate);
        installmentDate.setMonth(startDate.getMonth() + i);

        newExpenses.push({
          id: uid(),
          date: installmentDate.toISOString().slice(0, 10),
          description: `${description} (${i + 1}/${numInstallments})`,
          originId: expForm.originId,
          category: expForm.category,
          parcela: `${i + 1}/${numInstallments}`,
          debtorId: expForm.debtorId || null,
          amount: installmentAmount,
        });
      }

      setState((s) => ({ ...s, expenses: [...newExpenses, ...s.expenses] }));
    } else {
      // Único
      const row = {
        id: uid(),
        date: expForm.date,
        description,
        originId: expForm.originId,
        category: expForm.category,
        parcela: "Único",
        debtorId: expForm.debtorId || null,
        amount: totalAmount,
      };
      setState((s) => ({ ...s, expenses: [row, ...s.expenses] }));
    }

    setExpForm((f) => ({
      ...f,
      description: "",
      isInstallment: false,
      installments: "",
      debtorId: "",
      amount: "",
    }));
  };

  const delExpense = (id) =>
    setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));

  return (
    <>
      <Section title="Adicionar Lançamento">
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Data" id="exp-date">
            <input
              id="exp-date"
              type="date"
              className="border rounded-lg px-3 py-2 w-full"
              value={expForm.date}
              onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>

          <Field label="Descrição" id="exp-desc">
            <input
              id="exp-desc"
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Ex.: Aluguel, DARF, Mercado Livre"
              value={expForm.description}
              onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>

          <Field label="Origem" id="exp-origin">
            <select
              id="exp-origin"
              className="border rounded-lg px-3 py-2 w-full"
              value={expForm.originId}
              onChange={(e) => setExpForm((f) => ({ ...f, originId: e.target.value }))}
            >
              <option value="" disabled>Selecione uma Origem</option>
              {state.origins.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Categoria" id="exp-cat">
            <select
              id="exp-cat"
              className="border rounded-lg px-3 py-2 w-full"
              value={expForm.category}
              onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </Field>

          {/* Parcelamento */}
          <div className="flex items-end pb-3">
            <div className="flex items-center h-full">
              <input
                id="exp-is-installment"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                checked={expForm.isInstallment}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setExpForm((f) => ({
                    ...f,
                    isInstallment: checked,
                    installments: checked ? f.installments : "",
                  }));
                }}
              />
              <label htmlFor="exp-is-installment" className="ml-2 text-sm font-medium text-gray-700">
                É parcelado?
              </label>
            </div>
          </div>

          {expForm.isInstallment && (
            <Field label="Nº de Parcelas" id="exp-installments">
              <input
                id="exp-installments"
                type="number"
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Ex: 12"
                value={expForm.installments}
                onChange={(e) => setExpForm((f) => ({ ...f, installments: e.target.value }))}
              />
            </Field>
          )}

          <Field label="Devedor (Opcional)" id="exp-debtor">
            <select
              id="exp-debtor"
              className="border rounded-lg px-3 py-2 w-full"
              value={expForm.debtorId}
              onChange={(e) => setExpForm((f) => ({ ...f, debtorId: e.target.value }))}
            >
              <option value="">Minha despesa</option>
              {state.debtors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Valor (R$)" id="exp-amount">
            <input
              id="exp-amount"
              className="border rounded-lg px-3 py-2 w-full"
              inputMode="decimal"
              placeholder="0,00"
              value={expForm.amount}
              onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-3">
          <button
            onClick={addExpense}
            className="px-4 py-2 rounded-xl bg-black text-white"
          >
            Adicionar Lançamento
          </button>
        </div>
      </Section>

      <Section title="Lançamentos do Mês">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">Data</th>
                <th>Descrição</th>
                <th>Origem</th>
                <th>Categoria</th>
                <th>Devedor</th>
                <th>Parcela</th>
                <th className="text-right">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expensesMonth.map((e) => (
                <tr key={e.id} className={`border-t ${e.debtorId ? "bg-yellow-50" : ""}`}>
                  <td className="py-2">{e.date}</td>
                  <td>{e.description}</td>
                  <td>{originById[e.originId]?.name ?? "Deletada"}</td>
                  <td>{e.category}</td>
                  <td>{e.debtorId ? debtorById[e.debtorId] || "Deletado" : "-"}</td>
                  <td>{e.parcela}</td>
                  <td className="text-right">{toBRL(e.amount)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => delExpense(e.id)}
                      className="text-red-600 hover:underline"
                    >
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
              {expensesMonth.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-4">
                    Sem lançamentos no mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
