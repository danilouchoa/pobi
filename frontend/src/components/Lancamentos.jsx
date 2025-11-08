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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import Section from "./ui/Section";
import { todayISO, parseNum, toBRL } from "../utils/helpers";
import LoopIcon from "@mui/icons-material/Loop";
import EventIcon from "@mui/icons-material/Event";
import HandshakeIcon from "@mui/icons-material/Handshake";

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

export default function Lancamentos({
  state,
  month,
  createExpense,
  deleteExpense,
  duplicateExpense,
  adjustExpense,
  createRecurringExpense,
  fetchRecurringExpenses,
  fetchSharedExpenses,
}) {
  const originById = useMemo(
    () => Object.fromEntries(state.origins.map((origin) => [origin.id, origin])),
    [state.origins]
  );
  const debtorById = useMemo(
    () => Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name])),
    [state.debtors]
  );
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
    expenseType: "normal",
    recurrenceType: "monthly",
    sharedEnabled: false,
    sharedWith: "",
    sharedAmount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [dialogValues, setDialogValues] = useState({
    description: "",
    amount: "",
    date: todayISO(),
    category: "Outros",
    originId: "",
    debtorId: "",
    parcela: "Único",
    isInstallment: false,
    expenseType: "normal",
    recurrenceType: "monthly",
    sharedEnabled: false,
    sharedWith: "",
    sharedAmount: "",
    incrementMonth: false,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [filterType, setFilterType] = useState("all");

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
  }, [month, expensesMonth.length, state.expenses.length]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "isInstallment" && !value ? { installments: "" } : null),
      ...(field === "expenseType" && value !== "recurring" ? { recurrenceType: "monthly" } : null),
      ...(field === "sharedEnabled" && !value ? { sharedWith: "", sharedAmount: "" } : null),
    }));
  };

  const handleAddExpense = async () => {
    const totalAmount = parseNum(form.amount);
    const description = form.description.trim();
    if (!description || !form.originId || totalAmount <= 0) return;

    const payloads = [];
    if (form.sharedEnabled) {
      const sharedValue = parseNum(form.sharedAmount);
      if (!form.sharedWith.trim() || sharedValue <= 0 || sharedValue > totalAmount) {
        alert("Dados de divisão compartilhada inválidos.");
        return;
      }
    }

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
      const basePayload = {
        date: form.date,
        description,
        originId: form.originId,
        category: form.category,
        parcela: "Único",
        debtorId: form.debtorId || null,
        amount: totalAmount,
        recurring: form.expenseType === "recurring",
        recurrenceType: form.expenseType === "recurring" ? form.recurrenceType : undefined,
        fixed: form.expenseType === "fixed",
        sharedWith: form.sharedEnabled ? form.sharedWith : undefined,
        sharedAmount: form.sharedEnabled ? parseNum(form.sharedAmount) : undefined,
      };
      payloads.push(basePayload);
    }

    try {
      setSubmitting(true);
      for (const payload of payloads) {
        if (payload.recurring || payload.fixed) {
          await createRecurringExpense(payload);
        } else {
          await createExpense(payload);
        }
      }
      setForm((current) => ({
        ...current,
        description: "",
        isInstallment: false,
        installments: "",
        debtorId: "",
        amount: "",
        expenseType: "normal",
        recurrenceType: "monthly",
        sharedEnabled: false,
        sharedWith: "",
        sharedAmount: "",
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

  const handleDuplicate = async (expense) => {
    try {
      setActionId(expense.id);
      await duplicateExpense(expense.id, { incrementMonth: true });
      setSnackbar({ open: true, message: "Lançamento duplicado!", severity: "success" });
      if (expense.recurring) {
        setSnackbar({ open: true, message: "Despesa recorrente duplicada para o próximo período!", severity: "success" });
      }
    } catch (error) {
      console.error("Erro ao duplicar lançamento:", error);
      setSnackbar({ open: true, message: "Erro ao duplicar lançamento.", severity: "error" });
    } finally {
      setActionId(null);
    }
  };

  const openEditDialog = (expense) => {
    const expenseType = expense.recurring ? "recurring" : expense.fixed ? "fixed" : "normal";
    setEditingExpense(expense);
    setDialogValues({
      description: expense.description ?? "",
      amount: String(expense.amount ?? ""),
      date: (expense.date ?? "").slice(0, 10),
      category: expense.category ?? "Outros",
      originId: expense.originId || "",
      debtorId: expense.debtorId || "",
      parcela: expense.parcela || "Único",
      expenseType,
      isInstallment: Boolean(expense.parcela && expense.parcela !== "Único"),
      recurrenceType: expense.recurrenceType || "monthly",
      sharedEnabled: Boolean(expense.sharedWith),
      sharedWith: expense.sharedWith || "",
      sharedAmount: expense.sharedAmount != null ? String(expense.sharedAmount) : "",
      incrementMonth: Boolean(expense.incrementMonth),
    });
    setDialogOpen(true);
  };

  const handleDialogChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDialogValues((current) => ({
      ...current,
      [field]: value,
      ...(field === "expenseType" && value !== "recurring" ? { recurrenceType: "monthly" } : null),
      ...(field === "sharedEnabled" && !value ? { sharedWith: "", sharedAmount: "" } : null),
    }));
  };

  const handleAdjust = async () => {
    if (!editingExpense) return;
    try {
      setDialogLoading(true);
      const amountNumber = parseNum(dialogValues.amount);
      if (Number.isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Valor inválido.");
      }
      const sharedAmountNumber = dialogValues.sharedEnabled ? parseNum(dialogValues.sharedAmount) : null;
      if (dialogValues.sharedEnabled && (sharedAmountNumber <= 0 || sharedAmountNumber > amountNumber)) {
        throw new Error("Valor compartilhado inválido.");
      }
      const parcelaValue = dialogValues.isInstallment
        ? dialogValues.parcela || "1/1"
        : "Único";
      await adjustExpense(editingExpense.id, {
        description: dialogValues.description,
        amount: amountNumber,
        date: dialogValues.date,
        category: dialogValues.category,
        originId: dialogValues.originId || null,
        debtorId: dialogValues.debtorId || null,
        parcela: parcelaValue,
        recurring: dialogValues.expenseType === "recurring",
        recurrenceType: dialogValues.expenseType === "recurring" ? dialogValues.recurrenceType : null,
        fixed: dialogValues.expenseType === "fixed",
        sharedWith: dialogValues.sharedEnabled ? dialogValues.sharedWith : null,
        sharedAmount: dialogValues.sharedEnabled ? sharedAmountNumber : null,
        incrementMonth: dialogValues.incrementMonth,
      });
      setSnackbar({ open: true, message: "Lançamento atualizado!", severity: "success" });
      setDialogOpen(false);
      setEditingExpense(null);
    } catch (error) {
      console.error("Erro ao ajustar lançamento:", error);
      setSnackbar({ open: true, message: "Erro ao salvar alterações.", severity: "error" });
    } finally {
      setDialogLoading(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  const filteredExpenses = expensesMonth.filter((expense) => {
    if (filterType === "recurring") return expense.recurring;
    if (filterType === "fixed") return expense.fixed;
    if (filterType === "shared") return Boolean(expense.sharedWith);
    return true;
  });

  useEffect(() => {
    if (filterType === "recurring") {
      fetchRecurringExpenses();
    } else if (filterType === "shared") {
      fetchSharedExpenses();
    }
  }, [filterType, fetchRecurringExpenses, fetchSharedExpenses]);

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
            <TextField label="Data" type="date" fullWidth value={form.date} onChange={handleChange("date")} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField label="Descrição" fullWidth value={form.description} onChange={handleChange("description")} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField select label="Origem" fullWidth value={form.originId} onChange={handleChange("originId")} disabled={state.origins.length === 0}>
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
            <TextField select label="Devedor (opcional)" fullWidth value={form.debtorId} onChange={handleChange("debtorId")}>
              <MenuItem value="">Minha despesa</MenuItem>
              {state.debtors.map((debtor) => (
                <MenuItem key={debtor.id} value={debtor.id}>
                  {debtor.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Valor (R$)" fullWidth value={form.amount} onChange={handleChange("amount")} InputProps={{ inputMode: "decimal" }} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel control={<Checkbox checked={form.isInstallment} onChange={handleChange("isInstallment")} />} label="Lançamento parcelado?" />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField select label="Tipo de despesa" fullWidth value={form.expenseType} onChange={handleChange("expenseType")}>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="recurring">Recorrente</MenuItem>
              <MenuItem value="fixed">Fixa</MenuItem>
            </TextField>
          </Grid>
          {form.expenseType === "recurring" && (
            <Grid item xs={12} md={4}>
              <TextField select label="Recorrência" fullWidth value={form.recurrenceType} onChange={handleChange("recurrenceType")}>
                <MenuItem value="monthly">Mensal</MenuItem>
                <MenuItem value="weekly">Semanal</MenuItem>
                <MenuItem value="yearly">Anual</MenuItem>
              </TextField>
            </Grid>
          )}
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={form.sharedEnabled} onChange={handleChange("sharedEnabled")} />}
              label="Dividir pagamento com outra pessoa?"
            />
          </Grid>
          {form.sharedEnabled && (
            <>
              <Grid item xs={12} md={4}>
                <TextField label="Nome da pessoa" fullWidth value={form.sharedWith} onChange={handleChange("sharedWith")} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Valor compartilhado" fullWidth value={form.sharedAmount} onChange={handleChange("sharedAmount")} InputProps={{ inputMode: "decimal" }} />
              </Grid>
            </>
          )}
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

      <Section
        title="Lançamentos do Mês"
        subtitle="Lista completa dos lançamentos no mês selecionado."
        right={
          <TextField
            select
            size="small"
            label="Filtro"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="recurring">Recorrentes</MenuItem>
            <MenuItem value="fixed">Fixas</MenuItem>
            <MenuItem value="shared">Compartilhadas</MenuItem>
          </TextField>
        }
      >
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
                <TableCell align="center">Indicadores</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense) => (
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
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      {expense.recurring && (
                        <Tooltip title="Despesa recorrente">
                          <LoopIcon fontSize="small" color="secondary" />
                        </Tooltip>
                      )}
                      {expense.fixed && (
                        <Tooltip title="Despesa fixa">
                          <EventIcon fontSize="small" color="info" />
                        </Tooltip>
                      )}
                      {expense.sharedWith && (
                        <Tooltip title={`Compartilhada com ${expense.sharedWith} (${toBRL(expense.sharedAmount)})`}>
                          <HandshakeIcon fontSize="small" color="success" />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => handleDuplicate(expense)} disabled={actionId === expense.id}>
                        {actionId === expense.id ? <CircularProgress size={16} /> : <ContentCopyIcon fontSize="small" />}
                      </IconButton>
                      <IconButton size="small" onClick={() => openEditDialog(expense)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => handleDeleteExpense(expense.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExpenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
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

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>Editar lançamento</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField label="Descrição" value={dialogValues.description} onChange={handleDialogChange("description")} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Valor (R$)" value={dialogValues.amount} onChange={handleDialogChange("amount")} fullWidth type="number" inputProps={{ step: "0.01" }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Data" type="date" value={dialogValues.date} onChange={handleDialogChange("date")} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField select label="Categoria" value={dialogValues.category} onChange={handleDialogChange("category")} fullWidth>
                {CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField select label="Origem" value={dialogValues.originId} onChange={handleDialogChange("originId")} fullWidth>
                <MenuItem value="">Selecionar origem</MenuItem>
                {state.origins.map((origin) => (
                  <MenuItem key={origin.id} value={origin.id}>
                    {origin.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField select label="Devedor" value={dialogValues.debtorId} onChange={handleDialogChange("debtorId")} fullWidth>
                <MenuItem value="">Minha despesa</MenuItem>
                {state.debtors.map((debtor) => (
                  <MenuItem key={debtor.id} value={debtor.id}>
                    {debtor.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={<Checkbox checked={dialogValues.isInstallment} onChange={handleDialogChange("isInstallment")} />}
                label="Lançamento parcelado?"
              />
            </Grid>
            {dialogValues.isInstallment && (
              <Grid item xs={12} md={6}>
                <TextField
                  label="Parcela (ex: 1/7)"
                  value={dialogValues.parcela}
                  onChange={handleDialogChange("parcela")}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField select label="Tipo de despesa" fullWidth value={dialogValues.expenseType} onChange={handleDialogChange("expenseType")}>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="recurring">Recorrente</MenuItem>
                <MenuItem value="fixed">Fixa</MenuItem>
              </TextField>
            </Grid>
            {dialogValues.expenseType === "recurring" && (
              <Grid item xs={12} md={6}>
                <TextField select label="Recorrência" fullWidth value={dialogValues.recurrenceType} onChange={handleDialogChange("recurrenceType")}>
                  <MenuItem value="monthly">Mensal</MenuItem>
                  <MenuItem value="weekly">Semanal</MenuItem>
                  <MenuItem value="yearly">Anual</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={dialogValues.sharedEnabled} onChange={handleDialogChange("sharedEnabled")} />}
                label="Dividir pagamento com outra pessoa?"
              />
            </Grid>
            {dialogValues.sharedEnabled && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField label="Nome da pessoa" fullWidth value={dialogValues.sharedWith} onChange={handleDialogChange("sharedWith")} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Valor dividido (R$)"
                    fullWidth
                    type="number"
                    value={dialogValues.sharedAmount}
                    onChange={handleDialogChange("sharedAmount")}
                    inputProps={{ step: "0.01" }}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={dialogValues.incrementMonth} onChange={handleDialogChange("incrementMonth")} />}
                label="Incrementar mês automaticamente"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleAdjust} disabled={dialogLoading} startIcon={dialogLoading ? <CircularProgress size={16} color="inherit" /> : null}>
            {dialogLoading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={closeSnackbar}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
