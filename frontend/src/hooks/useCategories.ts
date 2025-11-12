import { useCallback, useMemo, useState, useEffect } from "react";
import { readLS, saveLS } from "../utils/helpers";

/**
 * useCategories
 *
 * Fornece categorias padrão + personalizadas, persistindo apenas as customizadas em localStorage.
 * Motivação: a API ainda não gerencia categorias, mas o frontend precisa oferecer flexibilidade
 * para o usuário cadastrar rótulos próprios e usá-los nos formulários de lançamento.
 */

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

const readCustomList = (key: string): string[] => {
  const stored = readLS(key, []) as unknown;
  if (!Array.isArray(stored) || !stored.length) return [];
  return stored
    .map((item) => (typeof item === "string" ? sanitize(item) : null))
    .filter(Boolean) as string[];
};

export function useCategories(userId?: string) {
  const buildInitialListFor = (uid?: string) => {
    const key = uid ? `${STORAGE_KEY}:${uid}` : STORAGE_KEY;
    if (typeof window === "undefined") return DEFAULT_CATEGORIES;
    const extras = readCustomList(key);
    // Remove duplicidades mantendo a ordem de inserção (padrões + customizados).
    return Array.from(
      new Map(
        [...DEFAULT_CATEGORIES, ...extras].map((entry) => [
          entry.toLowerCase(),
          entry,
        ])
      ).values()
    );
  };

  const [categories, setCategories] = useState<string[]>(() =>
    buildInitialListFor(userId)
  );

  const migrateLegacyCategories = useCallback(
    (uid: string) => {
      if (typeof window === "undefined") return false;
      const legacy = readCustomList(STORAGE_KEY);
      if (!legacy.length) return false;

      const key = `${STORAGE_KEY}:${uid}`;
      const current = readCustomList(key);
      const merged = Array.from(
        new Map(
          [...current, ...legacy].map((entry) => [
            entry.toLowerCase(),
            entry,
          ])
        ).values()
      );

      saveLS(key, merged);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        // ignore removal failures (quota, private mode, etc.)
      }
      return true;
    },
    []
  );

  // Quando o userId muda (login/logout), recarregar categorias do storage correspondente
  useEffect(() => {
    if (userId) {
      const migrated = migrateLegacyCategories(userId);
      if (migrated) {
        setCategories(buildInitialListFor(userId));
        return;
      }
    }
    setCategories(buildInitialListFor(userId));
  }, [userId, migrateLegacyCategories]);

  const persistCustom = useCallback(
    (list: string[]) => {
      // Persistimos somente o que não faz parte do catálogo padrão para manter o storage enxuto.
      const custom = list.filter(
        (item) =>
          !DEFAULT_CATEGORIES.some(
            (defaultItem) =>
              defaultItem.toLocaleLowerCase("pt-BR") ===
              item.toLocaleLowerCase("pt-BR")
          )
      );
      const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
      if (typeof window !== "undefined") {
        saveLS(key, custom);
      }
    },
    [userId]
  );

  const addCategory = useCallback(
    (name: string) => {
      const normalized = sanitize(name);
      if (!normalized) {
        throw new Error("Informe um nome válido para a categoria.");
      }
      setCategories((prev) => {
        // Comparação case-insensitive para evitar duplicatas com letras maiúsculas/minúsculas.
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
