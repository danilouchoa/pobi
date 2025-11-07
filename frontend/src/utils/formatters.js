export const formatDate = (isoDate) =>
  isoDate ? new Date(isoDate).toLocaleDateString("pt-BR") : "-";

export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
