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
  Snackbar,
} from "@mui/material";
import LoopIcon from "@mui/icons-material/Loop";
import EventIcon from "@mui/icons-material/Event";
import HandshakeIcon from "@mui/icons-material/Handshake";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from "framer-motion";
import Section from "./ui/Section";
import ExpenseBulkModal from "./ExpenseBulkModal";
import EmptyState from "./ui/EmptyState";
import { useExpenses } from "../hooks/useExpenses";
import { useToast } from "../hooks/useToast";
import { todayISO, parseNum, toBRL } from "../utils/helpers";
import { compareMonths, formatMonthLabel } from "../utils/dateHelpers";

// Regex para detectar formato de parcelas (ex: "1/12", "3/6")
const INSTALLMENT_PATTERN = /(\d+)\/(\d+)/;

export default function Lancamentos({
    state,
    month,
    onChangeMonth,
    createExpense,
  createExpenseBatch,
    deleteExpense,
    duplicateExpense,
    adjustExpense,
    createRecurringExpense,
    fetchRecurringExpenses,
    fetchSharedExpenses,
    categories,
  }) {
    // Categories & maps
    const resolvedCategories = useMemo(() => (categories?.length ? categories : ["Outros"]), [categories]);
    const defaultCategory = resolvedCategories[0] ?? "Outros";
    const originById = useMemo(() => Object.fromEntries(state.origins.map((o) => [o.id, o])), [state.origins]);
    const debtorById = useMemo(() => Object.fromEntries(state.debtors.map((d) => [d.id, d.name])), [state.debtors]);
    // Pagination
    const [page, setPage] = useState(1);
    const limit = 20;
    const { expensesQuery: paginatedQuery, pagination, bulkUpdate, bulkDelete } = useExpenses(month, {
      enabled: true,
      mode: "calendar",
      page,
      limit,
    });
    const paginatedExpenses = useMemo(() => paginatedQuery.data?.data ?? [], [paginatedQuery.data]);
    const isPageLoading = paginatedQuery.isLoading;
    const isPageFetching = paginatedQuery.isFetching;
    const expensesError = paginatedQuery.error
      ? paginatedQuery.error instanceof Error
        ? paginatedQuery.error
        : new Error("Não foi possível carregar os lançamentos.")
      : null;

    // Month animation
    const previousMonthRef = useRef(month);
    const [monthDirection, setMonthDirection] = useState(0);
    useEffect(() => {
      const prev = previousMonthRef.current;
      if (prev === month) return;
      const diff = compareMonths(month, prev);
      setMonthDirection(diff >= 0 ? 1 : -1);
      previousMonthRef.current = month;
    }, [month]);
    const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

    // Form state
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

    // Dialog state
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

    // Selection & bulk
    const [filterType, setFilterType] = useState("all");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [actionId, setActionId] = useState(null);

    // Calendar dialog
    const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
    const [calendarValue, setCalendarValue] = useState(month);

    // Utils
    const toast = useToast();
    const createSectionRef = useRef(null);
    const descriptionInputRef = useRef(null);
    const focusCreateForm = useCallback(() => {
      createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      descriptionInputRef.current?.focus();
    }, []);

    // Ensure origin & category validity
    useEffect(() => {
      if (!form.originId && state.origins[0]) setForm((c) => ({ ...c, originId: state.origins[0].id }));
    }, [state.origins, form.originId]);
    useEffect(() => {
      setForm((c) => (resolvedCategories.includes(c.category) ? c : { ...c, category: defaultCategory }));
      setDialogValues((c) => (resolvedCategories.includes(c.category) ? c : { ...c, category: defaultCategory }));
    }, [resolvedCategories, defaultCategory]);

    // Reset page on month change
    useEffect(() => {
      setPage(1);
      setCalendarValue(month);
    }, [month]);

    // Change handlers
    const handleChange = (field) => (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((c) => ({
        ...c,
        [field]: value,
        ...(field === "expenseType" && value !== "recurring" ? { recurrenceType: "monthly" } : null),
        ...(field === "sharedEnabled" && !value ? { sharedWith: "", sharedAmount: "" } : null),
      }));
    };
    const handleDialogChange = (field) => (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setDialogValues((c) => ({
        ...c,
        [field]: value,
        ...(field === "expenseType" && value !== "recurring" ? { recurrenceType: "monthly" } : null),
        ...(field === "sharedEnabled" && !value ? { sharedWith: "", sharedAmount: "" } : null),
      }));
    };

    // Create / duplicate / delete / adjust
    const handleAddExpense = async () => {
      const description = form.description.trim();
      if (!description) return toast.warning("Informe uma descrição.");
      const totalAmount = parseNum(form.amount);
      if (Number.isNaN(totalAmount) || totalAmount <= 0) return toast.warning("Informe um valor válido.");
      let payloads = [];
      if (form.isInstallment) {
        const installments = parseInt(form.installments, 10);
        if (!installments || installments < 2) return toast.warning("Número de parcelas inválido.");
        const installmentAmount = +(totalAmount / installments).toFixed(2);
        const startDate = new Date(form.date);
        for (let i = 0; i < installments; i++) {
          const d = new Date(startDate);
          d.setMonth(startDate.getMonth() + i);
          payloads.push({
            date: d.toISOString().slice(0, 10),
            description: `${description} (${i + 1}/${installments})`,
            originId: form.originId,
            category: form.category,
            parcela: `${i + 1}/${installments}`,
            debtorId: form.debtorId || null,
            amount: installmentAmount,
            recurring: form.expenseType === "recurring",
            recurrenceType: form.expenseType === "recurring" ? form.recurrenceType : undefined,
            fixed: form.expenseType === "fixed",
            sharedWith: form.sharedEnabled ? form.sharedWith : undefined,
            sharedAmount: form.sharedEnabled ? parseNum(form.sharedAmount) : undefined,
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
          recurring: form.expenseType === "recurring",
          recurrenceType: form.expenseType === "recurring" ? form.recurrenceType : undefined,
          fixed: form.expenseType === "fixed",
          sharedWith: form.sharedEnabled ? form.sharedWith : undefined,
          sharedAmount: form.sharedEnabled ? parseNum(form.sharedAmount) : undefined,
        });
      }
      setSubmitting(true);
      
      // Show loading message for large batches
      if (payloads.length > 5) {
        toast.info(`Criando ${payloads.length} parcelas... isso pode levar alguns segundos.`);
      }
      
      try {
        const regularPayloads = [];
        const specialPayloads = [];
        for (const p of payloads) {
          if (p.recurring || p.fixed) specialPayloads.push(p);
          else regularPayloads.push(p);
        }

        if (regularPayloads.length > 1 && createExpenseBatch) {
          await createExpenseBatch(regularPayloads);
        } else {
          for (const p of regularPayloads) {
            await createExpense(p);
          }
        }

        for (const p of specialPayloads) {
          await createRecurringExpense(p);
        }
        setForm((c) => ({
          ...c,
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
        
        if (payloads.length > 1) {
          toast.success(`${payloads.length} parcelas criadas com sucesso!`);
        } else {
          toast.success();
        }
      } catch (e) {
        toast.error(e);
      } finally {
        setSubmitting(false);
      }
    };
    const handleDeleteExpense = async (expense) => {
      const isInstallment = expense.parcela && expense.parcela !== "Único" && INSTALLMENT_PATTERN.test(expense.parcela);
      
      let confirmMessage = "Deseja excluir este lançamento?";
      if (isInstallment) {
        const match = expense.parcela.match(INSTALLMENT_PATTERN);
        const totalInstallments = match ? match[2] : "X";
        confirmMessage = `⚠️ ATENÇÃO: Este é um lançamento PARCELADO (${expense.parcela}).\n\nAo confirmar, TODAS as ${totalInstallments} parcelas serão excluídas do histórico.\n\nEsta ação NÃO pode ser desfeita.\n\nDeseja continuar?`;
      }
      
      if (!window.confirm(confirmMessage)) return;
      try {
        await deleteExpense(expense.id);
        toast.success();
      } catch (e) {
        toast.error(e);
      }
    };
    const handleDuplicate = async (expense) => {
      try {
        setActionId(expense.id);
        await duplicateExpense(expense.id, { incrementMonth: true });
        toast.success();
        if (expense.recurring) toast.info("Despesa recorrente duplicada para o próximo período.");
      } catch (e) {
        toast.error(e);
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
        category: expense.category ?? defaultCategory,
        originId: expense.originId || "",
        debtorId: expense.debtorId || "",
        parcela: expense.parcela || "Único",
        isInstallment: Boolean(expense.parcela && expense.parcela !== "Único"),
        expenseType,
        recurrenceType: expense.recurrenceType || "monthly",
        sharedEnabled: Boolean(expense.sharedWith),
        sharedWith: expense.sharedWith || "",
        sharedAmount: expense.sharedAmount != null ? String(expense.sharedAmount) : "",
        incrementMonth: Boolean(expense.incrementMonth),
      });
      setDialogOpen(true);
    };
    const handleAdjust = async () => {
      if (!editingExpense) return;
      const amountNumber = parseNum(dialogValues.amount);
      if (Number.isNaN(amountNumber) || amountNumber <= 0) return toast.warning("Informe um valor válido para o lançamento.");
      const sharedAmountNumber = dialogValues.sharedEnabled ? parseNum(dialogValues.sharedAmount) : null;
      if (dialogValues.sharedEnabled && (sharedAmountNumber <= 0 || sharedAmountNumber > amountNumber)) return toast.warning("Valor compartilhado inválido.");
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
      } catch (e) {
        toast.error(e);
      } finally {
        setDialogLoading(false);
      }
    };
    const closeDialog = () => {
      setDialogOpen(false);
      setEditingExpense(null);
    };

    // Calendar
    const handleCalendarChange = (e) => setCalendarValue(e.target.value);
    const handleCalendarSave = () => {
      if (!calendarValue || !/\d{4}-\d{2}/.test(calendarValue)) return;
      onChangeMonth(calendarValue);
      setPage(1);
      setCalendarDialogOpen(false);
    };

    // Filter & selection
    const filteredExpenses = useMemo(() => {
      return paginatedExpenses.filter((e) => {
        if (filterType === "recurring") return e.recurring;
        if (filterType === "fixed") return e.fixed;
        if (filterType === "shared") return Boolean(e.sharedWith);
        return true;
      });
    }, [paginatedExpenses, filterType]);
    const toggleSelection = (id, checked) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    };
    const handleSelectAll = (e) => {
      const { checked } = e.target;
      setSelectedIds((prev) => {
        if (!checked) {
          const next = new Set(prev);
          filteredExpenses.forEach((ex) => next.delete(ex.id));
          return next;
        }
        const next = new Set(prev);
        filteredExpenses.forEach((ex) => next.add(ex.id));
        return next;
      });
    };
    const isAllSelected = filteredExpenses.length > 0 && filteredExpenses.every((ex) => selectedIds.has(ex.id));
    const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

    // Bulk ops
    const handleBulkSubmit = async (values) => {
      if (!selectedIds.size) return;
      setBulkSubmitting(true);
      try {
        const result = await bulkUpdate({
          filters: { expenseIds: Array.from(selectedIds) },
          data: values,
          options: { mode: "calendar", invalidate: true },
        });
        toast.success();
        if (result?.jobId) toast.info(`Job ${result.jobId} agendado para processamento.`);
        setSelectedIds(new Set());
        setBulkModalOpen(false);
      } catch (e) {
        toast.error(e);
      } finally {
        setBulkSubmitting(false);
      }
    };
    const handleBulkDelete = async () => {
      if (!selectedIds.size) return;
      const count = selectedIds.size;
      
      // Check if any selected expense is an installment
      const selectedExpenses = filteredExpenses.filter((ex) => selectedIds.has(ex.id));
      const hasInstallments = selectedExpenses.some((ex) => 
        ex.parcela && ex.parcela !== "Único" && INSTALLMENT_PATTERN.test(ex.parcela)
      );
      
      let confirmMessage = `Excluir ${count} lançamento(s)?`;
      if (hasInstallments) {
        confirmMessage = `⚠️ ATENÇÃO: Você selecionou ${count} lançamento(s) e pelo menos um é PARCELADO.\n\nAo confirmar, TODAS as parcelas relacionadas serão excluídas automaticamente (não só as visíveis nesta página).\n\nEsta ação NÃO pode ser desfeita.\n\nDeseja continuar?`;
      } else {
        confirmMessage += " Esta ação não pode ser desfeita.";
      }
      
      if (!window.confirm(confirmMessage)) return;
      
      setBulkSubmitting(true);
      try {
        await bulkDelete(Array.from(selectedIds));
        toast.success(`${count} lançamento(s) excluído(s).`);
        setSelectedIds(new Set());
      } catch (e) {
        toast.error(e);
      } finally {
        setBulkSubmitting(false);
      }
    };

    // Prefetch special lists when filtering
    useEffect(() => {
      if (filterType === "recurring") fetchRecurringExpenses();
      else if (filterType === "shared") fetchSharedExpenses();
    }, [filterType, fetchRecurringExpenses, fetchSharedExpenses]);

    return (
      <>
        <Snackbar
          open={bulkSubmitting}
          message="Processando lançamentos..."
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          ContentProps={{ sx: { bgcolor: "info.main", color: "info.contrastText", fontWeight: 500 } }}
        />
        <Stack spacing={3}>
          {/* Create form */}
          <div ref={createSectionRef}>
            <Section
              title="Adicionar Lançamento"
              subtitle="Cadastre novos lançamentos financeiros com opção de parcelamento."
              right={
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleAddExpense}
                  disabled={submitting || state.origins.length === 0}
                >
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
                  <TextField
                    label="Descrição"
                    fullWidth
                    value={form.description}
                    onChange={handleChange("description")}
                    inputRef={descriptionInputRef}
                  />
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
                    {state.origins.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    label="Categoria"
                    fullWidth
                    value={form.category}
                    onChange={handleChange("category")}
                  >
                    {resolvedCategories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
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
                    {state.debtors.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
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
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    label="Tipo de despesa"
                    fullWidth
                    value={form.expenseType}
                    onChange={handleChange("expenseType")}
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="recurring">Recorrente</MenuItem>
                    <MenuItem value="fixed">Fixa</MenuItem>
                  </TextField>
                </Grid>
                {form.expenseType === "recurring" && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      label="Recorrência"
                      fullWidth
                      value={form.recurrenceType}
                      onChange={handleChange("recurrenceType")}
                    >
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
                      <TextField
                        label="Nome da pessoa"
                        fullWidth
                        value={form.sharedWith}
                        onChange={handleChange("sharedWith")}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Valor compartilhado"
                        fullWidth
                        value={form.sharedAmount}
                        onChange={handleChange("sharedAmount")}
                        InputProps={{ inputMode: "decimal" }}
                      />
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

          {/* Expenses list */}
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
                      <Typography sx={{ fontWeight: 600 }}>{monthLabel}</Typography>
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
                  onChange={(e) => setFilterType(e.target.value)}
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
              {bulkSubmitting && <LinearProgress sx={{ position: "absolute", width: "100%", zIndex: 2 }} />}
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
                  {filteredExpenses.map((ex) => (
                    <TableRow key={ex.id} hover sx={{ bgcolor: ex.debtorId ? "secondary.50" : undefined }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(ex.id)}
                          onChange={(e) => toggleSelection(ex.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{ex.date}</TableCell>
                      <TableCell>{ex.description}</TableCell>
                      <TableCell>{originById[ex.originId]?.name ?? "Deletada"}</TableCell>
                      <TableCell>{ex.category}</TableCell>
                      <TableCell>
                        {ex.debtorId ? (
                          <Chip label={debtorById[ex.debtorId] || "Deletado"} size="small" color="secondary" variant="outlined" />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{ex.parcela}</TableCell>
                      <TableCell align="right">{toBRL(ex.amount)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          {ex.recurring && (
                            <Tooltip title="Despesa recorrente">
                              <LoopIcon fontSize="small" color="secondary" />
                            </Tooltip>
                          )}
                          {ex.fixed && (
                            <Tooltip title="Despesa fixa">
                              <EventIcon fontSize="small" color="info" />
                            </Tooltip>
                          )}
                          {ex.sharedWith && (
                            <Tooltip title={`Compartilhada com ${ex.sharedWith} (${toBRL(ex.sharedAmount)})`}>
                              <HandshakeIcon fontSize="small" color="success" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleDuplicate(ex)} disabled={actionId === ex.id}>
                            {actionId === ex.id ? <CircularProgress size={16} /> : <ContentCopyIcon fontSize="small" />}
                          </IconButton>
                          <IconButton size="small" onClick={() => openEditDialog(ex)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton color="error" size="small" onClick={() => handleDeleteExpense(ex)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isPageLoading && filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
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
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={pagination.page <= 1 || isPageFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
                  disabled={pagination.page >= pagination.pages || isPageFetching}
                >
                  Próxima
                </Button>
              </Stack>
            </Stack>
          </Section>

          {/* Edit dialog */}
          <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
            <DialogTitle>Editar lançamento</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    label="Descrição"
                    value={dialogValues.description}
                    onChange={handleDialogChange("description")}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Valor (R$)"
                    value={dialogValues.amount}
                    onChange={handleDialogChange("amount")}
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Data"
                    type="date"
                    value={dialogValues.date}
                    onChange={handleDialogChange("date")}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label="Categoria"
                    value={dialogValues.category}
                    onChange={handleDialogChange("category")}
                    fullWidth
                  >
                    {resolvedCategories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label="Origem"
                    value={dialogValues.originId}
                    onChange={handleDialogChange("originId")}
                    fullWidth
                  >
                    <MenuItem value="">Selecionar origem</MenuItem>
                    {state.origins.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label="Devedor"
                    value={dialogValues.debtorId}
                    onChange={handleDialogChange("debtorId")}
                    fullWidth
                  >
                    <MenuItem value="">Minha despesa</MenuItem>
                    {state.debtors.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
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
                  <TextField
                    select
                    label="Tipo de despesa"
                    fullWidth
                    value={dialogValues.expenseType}
                    onChange={handleDialogChange("expenseType")}
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="recurring">Recorrente</MenuItem>
                    <MenuItem value="fixed">Fixa</MenuItem>
                  </TextField>
                </Grid>
                {dialogValues.expenseType === "recurring" && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      label="Recorrência"
                      fullWidth
                      value={dialogValues.recurrenceType}
                      onChange={handleDialogChange("recurrenceType")}
                    >
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
                      <TextField
                        label="Nome da pessoa"
                        fullWidth
                        value={dialogValues.sharedWith}
                        onChange={handleDialogChange("sharedWith")}
                      />
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
              <Button
                variant="contained"
                onClick={handleAdjust}
                disabled={dialogLoading}
                startIcon={dialogLoading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {dialogLoading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Calendar month dialog */}
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

          {/* Bulk modal */}
          <ExpenseBulkModal
            open={bulkModalOpen}
            onClose={() => !bulkSubmitting && setBulkModalOpen(false)}
            onSubmit={handleBulkSubmit}
            origins={state.origins}
            categories={resolvedCategories}
          />
        </Stack>
        </>
      );
    }
