export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const toBRL = (n) =>
  isNaN(n)
    ? "-"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const parseNum = (v) =>
  v === "" || v == null ? 0 : Number(String(v).replace(",", ".")) || 0;

export const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const readLS = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
