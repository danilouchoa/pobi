const toNumeric = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && typeof value.toString === "function") {
    const parsed = Number(value.toString());
    if (!Number.isNaN(parsed)) return parsed;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const formatDate = (isoDate) =>
  isoDate ? new Date(isoDate).toLocaleDateString("pt-BR") : "-";

export const formatCurrency = (value) =>
  toNumeric(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const formatNumber = (value, options = {}) =>
  toNumeric(value).toLocaleString("pt-BR", options);
