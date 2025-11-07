import { useEffect, useState, useMemo } from "react";
import { uid, todayISO, saveLS, readLS, parseNum } from "../utils/helpers";

const DEFAULT_SALARY_TEMPLATE = {
  hours: "178",
  hourRate: "95.24",
  taxRate: "0.06",
  cnae: "Suporte e manutenção de computadores",
};

export function useFinanceApp() {
  const [state, setState] = useState(() =>
    readLS("pf-app-v5", {
      version: 5,
      expenses: [],
      salaryHistory: {
        [new Date().toISOString().slice(0, 7)]: DEFAULT_SALARY_TEMPLATE,
      },
      debtors: [
        { id: uid(), name: "Irmã" },
        { id: uid(), name: "Esposa" },
      ],
      origins: [
        {
          id: uid(),
          name: "Cartão C6",
          type: "Cartão",
          dueDay: "20",
          limit: "10000",
        },
        {
          id: uid(),
          name: "Cartão Nubank",
          type: "Cartão",
          dueDay: "4",
          limit: "5000",
        },
        {
          id: uid(),
          name: "Contas Fixas",
          type: "Conta",
          dueDay: "N/A",
          limit: "N/A",
        },
      ],
    })
  );

  const [month, setMonth] = useState(() =>
    readLS("pf-month", new Date().toISOString().slice(0, 7))
  );

  useEffect(() => saveLS("pf-app-v5", state), [state]);
  useEffect(() => saveLS("pf-month", month), [month]);

  // Mapeia devedores e origens
  const debtorById = useMemo(
    () => Object.fromEntries(state.debtors.map((d) => [d.id, d.name])),
    [state.debtors]
  );
  const originById = useMemo(
    () => Object.fromEntries(state.origins.map((o) => [o.id, o])),
    [state.origins]
  );

  return { state, setState, month, setMonth, debtorById, originById };
}
