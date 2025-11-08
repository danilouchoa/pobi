import { useCallback, useMemo, useState } from "react";
import { readLS, saveLS } from "../utils/helpers";

const STORAGE_KEY = "pf-categories";

export const DEFAULT_CATEGORIES = [
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

const sanitize = (value: string) => value.trim().replace(/\s+/g, " ");

const buildInitialList = () => {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  const stored = readLS(STORAGE_KEY, []) as unknown;
  const extras =
    Array.isArray(stored) && stored.length
      ? stored
          .map((item) => (typeof item === "string" ? sanitize(item) : null))
          .filter(Boolean)
      : [];
  return Array.from(
    new Map(
      [...DEFAULT_CATEGORIES, ...extras].map((entry) => [
        entry.toLowerCase(),
        entry,
      ])
    ).values()
  );
};

export function useCategories() {
  const [categories, setCategories] = useState<string[]>(buildInitialList);

  const persistCustom = useCallback((list: string[]) => {
    const custom = list.filter(
      (item) =>
        !DEFAULT_CATEGORIES.some(
          (defaultItem) =>
            defaultItem.toLocaleLowerCase("pt-BR") ===
            item.toLocaleLowerCase("pt-BR")
        )
    );
    if (typeof window !== "undefined") {
      saveLS(STORAGE_KEY, custom);
    }
  }, []);

  const addCategory = useCallback(
    (name: string) => {
      const normalized = sanitize(name);
      if (!normalized) {
        throw new Error("Informe um nome válido para a categoria.");
      }
      setCategories((prev) => {
        const exists = prev.some(
          (item) =>
            item.toLocaleLowerCase("pt-BR") ===
            normalized.toLocaleLowerCase("pt-BR")
        );
        if (exists) {
          throw new Error("Esta categoria já está cadastrada.");
        }
        const next = [...prev, normalized];
        persistCustom(next);
        return next;
      });
    },
    [persistCustom]
  );

  return useMemo(
    () => ({
      categories,
      addCategory,
    }),
    [categories, addCategory]
  );
}
