import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Alert,
  CircularProgress,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import Section from "./ui/Section";
import { todayISO, parseNum, toBRL } from "../utils/helpers";
import { compareMonths, formatMonthLabel } from "../utils/dateHelpers";
import LoopIcon from "@mui/icons-material/Loop";
import EventIcon from "@mui/icons-material/Event";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { AnimatePresence, motion } from "framer-motion";
import ExpenseBulkModal from "./ExpenseBulkModal";
import { useExpenses } from "../hooks/useExpenses";
import { useToast } from "../hooks/useToast";
import EmptyState from "./ui/EmptyState";

/**
 * Lancamentos
 *
 * Tela principal de controle de despesas. Foi atualizada para:
 * - Reutilizar o hook useToast e garantir feedback nas operações CRUD.
 * - Exibir EmptyState quando filtros retornam listas vazias.
 * - Propagar categorias dinâmicas para formulários e para o modal de edição em lote.
 */

export default function Lancamentos({
  state,
  month,
  onChangeMonth,
  createExpense,
  deleteExpense,
  duplicateExpense,
  adjustExpense,
  createRecurringExpense,
  fetchRecurringExpenses,
  fetchSharedExpenses,
  categories,
}) {
  // A lista dinâmica depende dos cadastros criados na aba anterior; mantemos um fallback para "Outros".
  const resolvedCategories = useMemo(
    () => (categories && categories.length ? categories : ["Outros"]),
    [categories]
  );
  const defaultCategory = resolvedCategories[0] ?? "Outros";
  const originById = useMemo(
    () => Object.fromEntries(state.origins.map((origin) => [origin.id, origin])),
    [state.origins]
  );
  const debtorById = useMemo(
    () => Object.fromEntries(state.debtors.map((debtor) => [debtor.id, debtor.name])),
    [state.debtors]
  );
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);
  const [page, setPage] = useState(1);
  const [monthDirection, setMonthDirection] = useState(0);
  const limit = 20;
  const {
    expensesQuery: paginatedQuery,
    pagination,
    bulkUpdate,
    bulkDelete,
  } = useExpenses(month, { enabled: true, mode: "calendar", page, limit });
  const toast = useToast();
  const createSectionRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const focusCreateForm = useCallback(() => {
    createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, []);
  const previousMonthRef = useRef(month);
  const paginatedExpenses = useMemo(() => paginatedQuery.data?.data ?? [], [paginatedQuery.data]);
  const isPageLoading = paginatedQuery.isLoading;
  const isPageFetching = paginatedQuery.isFetching;
  const expensesError = paginatedQuery.error
    ? paginatedQuery.error instanceof Error
      ? paginatedQuery.error
      : new Error("Não foi possível carregar os lançamentos.")
    : null;

  useEffect(() => {
    const previous = previousMonthRef.current;
    if (previous === month) return;
    const diff = compareMonths(month, previous);
    setMonthDirection(diff >= 0 ? 1 : -1);
    previousMonthRef.current = month;
  }, [month]);

  const [form, setForm] = useState({
    date: todayISO(),
    description: "",
    originId: state.origins[0]?.id || "",
    category: defaultCategory,
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
    category: defaultCategory,
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
  const [filterType, setFilterType] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendarValue, setCalendarValue] = useState(month);

  useEffect(() => {
    if (!form.originId && state.origins.length > 0) {
      setForm((current) => ({ ...current, originId: state.origins[0].id }));
    }
  }, [state.origins, form.originId]);

  useEffect(() => {
    setForm((current) => {
      if (!current.category || resolvedCategories.includes(current.category)) {
        return current;
      }
      return { ...current, category: defaultCategory };
    });
  }, [resolvedCategories, defaultCategory]);

  useEffect(() => {
    setDialogValues((current) => {
      if (!current.category || resolvedCategories.includes(current.category)) {
        return current;
      }
      return { ...current, category: defaultCategory };
    });
  }, [resolvedCategories, defaultCategory]);

  useEffect(() => {
    setPage(1);
    setCalendarValue(month);
  }, [month]);

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
    if (!description || !form.originId || totalAmount <= 0) {
      // Mensagem preventiva evita requisições desnecessárias.
      toast.warning("Informe descrição, origem e valor válidos.");
      return;
    }

    const payloads = [];
    if (form.sharedEnabled) {
      const sharedValue = parseNum(form.sharedAmount);
      if (!form.sharedWith.trim() || sharedValue <= 0 || sharedValue > totalAmount) {
        // Fornece feedback contextual para compartilhamento inválido.
        toast.warning("Dados de divisão compartilhada inválidos.");
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

    setSubmitting(true);
    try {
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
      // Confirma ao usuário que o fluxo de criação (único ou parcelado) foi finalizado.
      // Delete não possui retorno visual imediato, então usamos o toast para reforçar o status.
      // Indica que o patch na API foi aplicado e o modal será fechado em seguida.
      // Assegura o usuário de que o job foi enfileirado; info extra mostra o ID.
      toast.success();
    } catch (error) {
      toast.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Deseja excluir este lançamento?")) return;
    try {
      await deleteExpense(id);
      toast.success();
    } catch (error) {
      toast.error(error);
    }
  };

  const handleDuplicate = async (expense) => {
    try {
      setActionId(expense.id);
      await duplicateExpense(expense.id, { incrementMonth: true });
      toast.success();
      if (expense.recurring) {
        // Mensagem adicional explica o efeito específico sobre recorrências.
        toast.info("Despesa recorrente duplicada para o próximo período.");
      }
    } catch (error) {
      toast.error(error);
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
    const amountNumber = parseNum(dialogValues.amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      // Reaproveitamos o toast para validar o modal antes do patch.
      toast.warning("Informe um valor válido para o lançamento.");
      return;
    }
    const sharedAmountNumber = dialogValues.sharedEnabled ? parseNum(dialogValues.sharedAmount) : null;
    if (dialogValues.sharedEnabled && (sharedAmountNumber <= 0 || sharedAmountNumber > amountNumber)) {
      // Evita enviar payload inválido ao backend.
      toast.warning("Valor compartilhado inválido.");
      return;
    }
    const parcelaValue = dialogValues.isInstallment ? dialogValues.parcela || "1/1" : "Único";
    setDialogLoading(true);
    try {
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
      toast.success();
      setDialogOpen(false);
      setEditingExpense(null);
    } catch (error) {
      toast.error(error);
    } finally {
      setDialogLoading(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleCalendarChange = (event) => setCalendarValue(event.target.value);
  const handleCalendarSave = () => {
    if (!calendarValue || !/^\d{4}-\d{2}$/.test(calendarValue)) return;
    onChangeMonth(calendarValue);
    setPage(1);
    setCalendarDialogOpen(false);
  };

  const filteredExpenses = useMemo(() => {
    return paginatedExpenses.filter((expense) => {
      if (filterType === "recurring") return expense.recurring;
      if (filterType === "fixed") return expense.fixed;
      if (filterType === "shared") return Boolean(expense.sharedWith);
      return true;
    });
  }, [paginatedExpenses, filterType]);

  const toggleSelection = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (event) => {
    const { checked } = event.target;
    setSelectedIds((prev) => {
      if (!checked) {
        const next = new Set(prev);
        filteredExpenses.forEach((expense) => next.delete(expense.id));
        return next;
      }
      const next = new Set(prev);
      filteredExpenses.forEach((expense) => next.add(expense.id));
      return next;
    });
  };

  const isAllSelected =
    filteredExpenses.length > 0 && filteredExpenses.every((expense) => selectedIds.has(expense.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  const handleBulkSubmit = async (values) => {
    if (!selectedIds.size) return;
    setBulkSubmitting(true);
    try {
      const result = await bulkUpdate({ 
        filters: { expenseIds: Array.from(selectedIds) }, 
        data: values,
        options: { mode: 'calendar', invalidate: true }
      });
      toast.success();
      if (result?.jobId) {
        toast.info(`Job ${result.jobId} agendado para processamento.`);
      }
      setSelectedIds(new Set());
      setBulkModalOpen(false);
    } catch (error) {
      toast.error(error);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    if (!window.confirm(`Excluir ${count} lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setBulkSubmitting(true);
    try {
      await bulkDelete(Array.from(selectedIds));
      toast.success(`${count} lançamento(s) excluído(s).`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error);
    } finally {
      setBulkSubmitting(false);
    }
  };

  useEffect(() => {
    if (filterType === "recurring") {
      fetchRecurringExpenses();
    } else if (filterType === "shared") {
      fetchSharedExpenses();
    }
  }, [filterType, fetchRecurringExpenses, fetchSharedExpenses]);

  return (
    <Stack spacing={3}>
      <div ref={createSectionRef}>
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
            <TextField
              label="Descrição"
              fullWidth
              value={form.description}
              onChange={handleChange("description")}
              inputRef={descriptionInputRef}
            />
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
              {resolvedCategories.map((category) => (
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
      </div>

      <Section
        title="Lançamentos do Mês"
        subtitle="Lista completa dos lançamentos no mês selecionado."
        right={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={month}
                  initial={{ opacity: 0, x: monthDirection * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: monthDirection * -24 }}
                  transition={{ duration: 0.3 }}
                >
                  <Typography sx={{ fontWeight: 600, textTransform: "none" }}>
                    {monthLabel}
                  </Typography>
                </motion.div>
              </AnimatePresence>
              <Tooltip title="Selecionar mês">
                <IconButton size="small" onClick={() => setCalendarDialogOpen(true)} aria-label="Selecionar mês">
                  <CalendarMonthIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
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
          </Stack>
        }
      >
        {paginatedQuery.isError && expensesError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {expensesError.message || "Não foi possível carregar os lançamentos."}
          </Alert>
        )}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {selectedIds.size} lançamento(s) selecionado(s)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              onClick={() => setBulkModalOpen(true)}
              disabled={selectedIds.size === 0 || bulkSubmitting}
            >
              {bulkSubmitting ? "Enviando..." : "Editar selecionados"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkSubmitting}
            >
              {bulkSubmitting ? "Removendo..." : "Excluir selecionados"}
            </Button>
          </Stack>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleSelectAll}
                  />
                </TableCell>
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
              {isPageLoading && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress size={20} />
                  </TableCell>
                </TableRow>
              )}
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id} hover sx={{ bgcolor: expense.debtorId ? "secondary.50" : undefined }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(expense.id)}
                      onChange={(event) => toggleSelection(expense.id, event.target.checked)}
                    />
                  </TableCell>
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
              {!isPageLoading && filteredExpenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    {/* EmptyState orienta o usuário e oferece CTA para voltar ao formulário de criação. */}
                    <EmptyState
                      title="Nenhum lançamento encontrado"
                      description="Os lançamentos que você criar aparecerão aqui."
                      ctaLabel="Adicionar novo"
                      onCtaClick={focusCreateForm}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {isPageFetching && !isPageLoading && <LinearProgress sx={{ mt: 1 }} />}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            Página {pagination.page} de {pagination.pages} • {pagination.total} lançamentos
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={pagination.page <= 1 || isPageFetching}
            >
              Anterior
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPage((prev) => Math.min(prev + 1, pagination.pages))}
              disabled={pagination.page >= pagination.pages || isPageFetching}
            >
              Próxima
            </Button>
          </Stack>
        </Stack>
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
                {resolvedCategories.map((category) => (
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
      <Dialog open={calendarDialogOpen} onClose={() => setCalendarDialogOpen(false)}>
        <DialogTitle>Selecionar mês</DialogTitle>
        <DialogContent>
          <TextField
            type="month"
            value={calendarValue}
            onChange={handleCalendarChange}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 1, minWidth: 220 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalendarDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCalendarSave}>
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>
      <ExpenseBulkModal
        open={bulkModalOpen}
        onClose={() => !bulkSubmitting && setBulkModalOpen(false)}
        onSubmit={handleBulkSubmit}
        origins={state.origins}
        categories={resolvedCategories}
      />

    </Stack>
  );
}
