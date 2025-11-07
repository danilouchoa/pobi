import { useState } from "react";
import Section from "./ui/Section";
import Field from "./ui/Field";
import { parseNum, toBRL } from "../utils/helpers";

export default function Cadastros({
  origins,
  debtors,
  createOrigin,
  deleteOrigin,
  createDebtor,
  deleteDebtor,
}) {
  // Forms
  const [originForm, setOriginForm] = useState({
    name: "",
    type: "Cartão",
    dueDay: "",
    limit: "",
  });

  const [debtorForm, setDebtorForm] = useState({ name: "" });
  const [originLoading, setOriginLoading] = useState(false);
  const [debtorLoading, setDebtorLoading] = useState(false);

  // === Ações de Contas/Origens ===
  const addOrigin = async () => {
    if (!originForm.name.trim() || !originForm.type) return;
    setOriginLoading(true);
    try {
      await createOrigin({
        name: originForm.name.trim(),
        type: originForm.type,
        dueDay: originForm.dueDay.trim(),
        limit: originForm.limit.trim(),
      });
      setOriginForm({ name: "", type: "Cartão", dueDay: "", limit: "" });
    } catch (error) {
      console.error("Erro ao criar origem:", error);
      alert("Não foi possível salvar a origem.");
    } finally {
      setOriginLoading(false);
    }
  };

  const delOrigin = async (id) => {
    if (!confirm("Deseja remover esta origem?")) return;
    try {
      await deleteOrigin(id);
    } catch (error) {
      console.error("Erro ao remover origem:", error);
      alert("Não foi possível remover a origem.");
    }
  };

  // === Ações de Devedores ===
  const addDebtor = async () => {
    if (!debtorForm.name.trim()) return;
    setDebtorLoading(true);
    try {
      await createDebtor({ name: debtorForm.name.trim() });
      setDebtorForm({ name: "" });
    } catch (error) {
      console.error("Erro ao criar devedor:", error);
      alert("Não foi possível salvar o devedor.");
    } finally {
      setDebtorLoading(false);
    }
  };

  const delDebtor = async (id) => {
    if (!confirm("Deseja remover este devedor?")) return;
    try {
      await deleteDebtor(id);
    } catch (error) {
      console.error("Erro ao remover devedor:", error);
      alert("Não foi possível remover o devedor.");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* === Contas/Origens === */}
      <Section
        title="Minhas Contas e Cartões"
        subtitle="Cadastre seus cartões e contas fixas."
      >
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Nome" id="origin-name">
            <input
              id="origin-name"
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Ex.: Cartão Nubank"
              value={originForm.name}
              onChange={(e) =>
                setOriginForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>

          <Field label="Tipo" id="origin-type">
            <select
              id="origin-type"
              className="border rounded-lg px-3 py-2 w-full"
              value={originForm.type}
              onChange={(e) =>
                setOriginForm((f) => ({ ...f, type: e.target.value }))
              }
            >
              <option value="Cartão">Cartão</option>
              <option value="Conta">Conta</option>
            </select>
          </Field>

          <Field label="Dia Vencimento" id="origin-due">
            <input
              id="origin-due"
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Ex.: 4"
              value={originForm.dueDay}
              onChange={(e) =>
                setOriginForm((f) => ({ ...f, dueDay: e.target.value }))
              }
            />
          </Field>

          <Field label="Limite (R$)" id="origin-limit">
            <input
              id="origin-limit"
              className="border rounded-lg px-3 py-2 w-full"
              inputMode="decimal"
              placeholder="Ex.: 5000"
              value={originForm.limit}
              onChange={(e) =>
                setOriginForm((f) => ({ ...f, limit: e.target.value }))
              }
            />
          </Field>
        </div>

        <button
          onClick={addOrigin}
          className="px-4 py-2 rounded-xl bg-black text-white w-full disabled:opacity-50"
          disabled={originLoading}
        >
          {originLoading ? "Salvando..." : "Adicionar Conta/Origem"}
        </button>

        <div className="mt-6">
          <h4 className="text-md font-semibold mb-2">Contas Cadastradas</h4>
          <ul className="divide-y divide-gray-100">
            {origins.map((o) => (
              <li key={o.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {o.name}{" "}
                    <span className="text-sm text-gray-500">({o.type})</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Venc: dia {o.dueDay || "N/A"} | Limite:{" "}
                    {o.limit ? toBRL(parseNum(o.limit)) : "N/A"}
                  </div>
                </div>
                <button
                  onClick={() => delOrigin(o.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  remover
                </button>
              </li>
            ))}
            {origins.length === 0 && (
              <li className="text-gray-400 py-2">Nenhuma conta cadastrada.</li>
            )}
          </ul>
        </div>
      </Section>

      {/* === Devedores === */}
      <Section
        title="Devedores"
        subtitle="Cadastre as pessoas que podem dever dinheiro para você."
      >
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Nome da Pessoa" id="debtor-name">
            <input
              id="debtor-name"
              className="border rounded-lg px-3 py-2 w-64"
              placeholder="Ex.: Irmã, Esposa"
              value={debtorForm.name}
              onChange={(e) => setDebtorForm({ name: e.target.value })}
              onKeyPress={(e) => e.key === "Enter" && addDebtor()}
            />
          </Field>
          <button
            onClick={addDebtor}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={debtorLoading}
          >
            {debtorLoading ? "Salvando..." : "Adicionar Pessoa"}
          </button>
        </div>

        <ul className="mt-4 divide-y divide-gray-100">
          {debtors.map((d) => (
            <li key={d.id} className="py-2 flex items-center justify-between">
              <div className="font-medium">{d.name}</div>
              <button
                onClick={() => delDebtor(d.id)}
                className="text-red-600 text-sm hover:underline"
              >
                remover
              </button>
            </li>
          ))}
          {debtors.length === 0 && (
            <li className="text-gray-400 py-2">Nenhuma pessoa cadastrada.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}
