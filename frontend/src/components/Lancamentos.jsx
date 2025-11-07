import { useState, useEffect, useMemo } from "react";
import {
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  IconButton,
  Stack,
  Typography,
  Chip,
  Paper,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Section from "./ui/Section";
import { todayISO, parseNum, toBRL } from "../utils/helpers";

const CATEGORIES = [
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

export default function Lancamentos({ state, month, createExpense, deleteExpense }) {
  const originById = useMemo(() => Object.fromEntries(state.origins.map((origin) => [origin.id, origin])), [state.origins]);
  const debtorById = useMemo(() => Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name])), [state.debtors]);
  const expensesMonth = state.expenses.filter((expense) => (expense.date ?? "").slice(0, 7) === month);

  const [form, setForm] = useState({
    date: todayISO(),
    description: "",
    originId: state.origins[0]?.id || "",
    category: "Outros",
    isInstallment: false,
    installments: "",
    debtorId: "",
    amount: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!form.originId && state.origins.length > 0) {
      setForm((current) => ({ ...current, originId: state.origins[0].id }));
    }
  }, [state.origins, form.originId]);

  useEffect(() => {
    console.log("Lancamentos updated", {
      month,
      expensesMonth: expensesMonth.length,
      totalExpenses: state.expenses.length,
    });
  }, [month, expensesMonth.length, state.expenses]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "isInstallment" && !value ? { installments: "" } : null),
    }));
  };

  const handleAddExpense = async () => {
    const totalAmount = parseNum(form.amount);
    const description = form.description.trim();
    if (!description || !form.originId || totalAmount <= 0) return;

    const payloads = [];
    if (form.isInstallment && Number(form.installments) > 1) {
      const installments = Number(form.installments);
      const installmentAmount = totalAmount / installments;
      const startDate = new Date(`${form.date}T12:00:00Z`);
      for (let i = 0; i < installments; i += 1) {
        const installmentDate = new Date(startDate);
        installmentDate.setMonth(startDate.getMonth() + i);
        payloads.push({
          date: installmentDate.toISOString().slice(0, 10),
          description: `${description} (${i + 1}/${installments})`,
          originId: form.originId,
          category: form.category,
          parcela: `${i + 1}/${installments}`,
          debtorId: form.debtorId || null,
          amount: installmentAmount,
        });
      }
    } else {
      payloads.push({
        date: form.date,
        description,
        originId: form.originId,
        category: form.category,
        parcela: "Único",
        debtorId: form.debtorId || null,
        amount: totalAmount,
      });
    }

    try {
      setSubmitting(true);
      for (const payload of payloads) {
        await createExpense(payload);
      }
      setForm((current) => ({
        ...current,
        description: "",
        isInstallment: false,
        installments: "",
        debtorId: "",
        amount: "",
      }));
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      alert("Não foi possível salvar o lançamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Deseja excluir este lançamento?")) return;
    try {
      await deleteExpense(id);
    } catch (error) {
      console.error("Erro ao excluir lançamento:", error);
      alert("Não foi possível excluir o lançamento.");
    }
  };

  return (
    <Stack spacing={3}>
      <Section
        title="Adicionar Lançamento"
        subtitle="Cadastre novos lançamentos financeiros com opção de parcelamento."
        right={
          <Button variant="contained" color="secondary" onClick={handleAddExpense} disabled={submitting || state.origins.length === 0}>
            {submitting ? "Salvando..." : "Adicionar lançamento"}
          </Button>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Data"
              type="date"
              fullWidth
              value={form.date}
              onChange={handleChange("date")}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField label="Descrição" fullWidth value={form.description} onChange={handleChange("description")} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              label="Origem"
              fullWidth
              value={form.originId}
              onChange={handleChange("originId")}
              disabled={state.origins.length === 0}
            >
              {state.origins.map((origin) => (
                <MenuItem key={origin.id} value={origin.id}>
                  {origin.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField select label="Categoria" fullWidth value={form.category} onChange={handleChange("category")}>
              {CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              label="Devedor (opcional)"
              fullWidth
              value={form.debtorId}
              onChange={handleChange("debtorId")}
            >
              <MenuItem value="">Minha despesa</MenuItem>
              {state.debtors.map((debtor) => (
                <MenuItem key={debtor.id} value={debtor.id}>
                  {debtor.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Valor (R$)"
              fullWidth
              value={form.amount}
              onChange={handleChange("amount")}
              InputProps={{ inputMode: "decimal" }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={form.isInstallment} onChange={handleChange("isInstallment")} />}
              label="Lançamento parcelado?"
            />
          </Grid>
          {form.isInstallment && (
            <Grid item xs={12} md={4}>
              <TextField
                label="Número de parcelas"
                type="number"
                fullWidth
                value={form.installments}
                onChange={handleChange("installments")}
                placeholder="Ex.: 12"
                InputProps={{ inputProps: { min: 2 } }}
              />
            </Grid>
          )}
        </Grid>
      </Section>

      <Section title="Lançamentos do Mês" subtitle="Lista completa dos lançamentos no mês selecionado.">
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Devedor</TableCell>
                <TableCell>Parcela</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expensesMonth.map((expense) => (
                <TableRow key={expense.id} hover sx={{ bgcolor: expense.debtorId ? "secondary.50" : undefined }}>
                  <TableCell>{expense.date}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{originById[expense.originId]?.name ?? "Deletada"}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>
                    {expense.debtorId ? (
                      <Chip label={debtorById[expense.debtorId] || "Deletado"} size="small" color="secondary" variant="outlined" />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{expense.parcela}</TableCell>
                  <TableCell align="right">{toBRL(expense.amount)}</TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => handleDeleteExpense(expense.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {expensesMonth.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography align="center" color="text.secondary">
                      Sem lançamentos registrados para este mês.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>
    </Stack>
  );
}
