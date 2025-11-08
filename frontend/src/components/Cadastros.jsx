import { useState, useRef } from "react";
import {
  Grid,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Section from "./ui/Section";
import { parseNum, toBRL } from "../utils/helpers";
import { useToast } from "../ui/feedback";
import EmptyState from "./ui/EmptyState";

export default function Cadastros({
  origins,
  debtors,
  createOrigin,
  deleteOrigin,
  updateOrigin,
  createDebtor,
  deleteDebtor,
  updateDebtor,
  categories,
  addCategory,
}) {
  const [originForm, setOriginForm] = useState({
    name: "",
    type: "Cartão",
    dueDay: "",
    limit: "",
    closingDay: "",
    billingRolloverPolicy: "NEXT_BUSINESS_DAY",
  });
  const [debtorForm, setDebtorForm] = useState({ name: "" });
  const [originLoading, setOriginLoading] = useState(false);
  const [debtorLoading, setDebtorLoading] = useState(false);
  const [dialogState, setDialogState] = useState({ open: false, type: null, entity: null });
  const [dialogValues, setDialogValues] = useState({
    name: "",
    status: "",
    limit: "",
    active: true,
    closingDay: "",
    billingRolloverPolicy: "NEXT_BUSINESS_DAY",
  });
  const toast = useToast();
  const originNameRef = useRef(null);
  const debtorNameRef = useRef(null);
  const categoryNameRef = useRef(null);
  const focusOriginForm = () => originNameRef.current?.focus();
  const focusDebtorForm = () => debtorNameRef.current?.focus();
  const focusCategoryForm = () => categoryNameRef.current?.focus();
  const [categoryName, setCategoryName] = useState("");

  const handleOriginChange = (field) => (event) => {
    const value = event.target.value;
    setOriginForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type" && value !== "Cartão") {
        next.closingDay = "";
        next.billingRolloverPolicy = "NEXT_BUSINESS_DAY";
      }
      return next;
    });
  };

  const handleDebtorChange = (event) => {
    setDebtorForm({ name: event.target.value });
  };

  const handleCategoryChange = (event) => {
    setCategoryName(event.target.value);
  };

  const handleAddCategory = () => {
    if (!categoryName.trim()) {
      toast.warning("Informe o nome da categoria.");
      focusCategoryForm();
      return;
    }
    try {
      addCategory(categoryName);
      setCategoryName("");
      toast.success();
    } catch (error) {
      toast.error(error);
    }
  };

  const addOrigin = async () => {
    if (!originForm.name.trim()) {
      toast.warning("Informe o nome da origem.");
      focusOriginForm();
      return;
    }
    if (originForm.type === "Cartão" && !originForm.closingDay.trim()) {
      toast.warning("Informe o dia de fechamento do cartão.");
      return;
    }
    setOriginLoading(true);
    try {
      await createOrigin({
        name: originForm.name.trim(),
        type: originForm.type,
        dueDay: originForm.dueDay.trim(),
        limit: originForm.limit.trim(),
        closingDay:
          originForm.type === "Cartão" && originForm.closingDay
            ? Number(originForm.closingDay)
            : originForm.type === "Cartão"
              ? null
              : undefined,
        billingRolloverPolicy:
          originForm.type === "Cartão" ? originForm.billingRolloverPolicy : null,
      });
      setOriginForm({
        name: "",
        type: "Cartão",
        dueDay: "",
        limit: "",
        closingDay: "",
        billingRolloverPolicy: "NEXT_BUSINESS_DAY",
      });
      toast.success();
    } catch (error) {
      toast.error(error);
    } finally {
      setOriginLoading(false);
    }
  };

  const delOrigin = async (id) => {
    if (!window.confirm("Deseja remover esta origem?")) return;
    try {
      await deleteOrigin(id);
      toast.success();
    } catch (error) {
      toast.error(error);
    }
  };

  const addDebtor = async () => {
    if (!debtorForm.name.trim()) {
      toast.warning("Informe o nome da pessoa.");
      focusDebtorForm();
      return;
    }
    setDebtorLoading(true);
    try {
      await createDebtor({ name: debtorForm.name.trim() });
      setDebtorForm({ name: "" });
      toast.success();
    } catch (error) {
      toast.error(error);
    } finally {
      setDebtorLoading(false);
    }
  };

  const delDebtor = async (id) => {
    if (!window.confirm("Deseja remover este devedor?")) return;
    try {
      await deleteDebtor(id);
      toast.success();
    } catch (error) {
      toast.error(error);
    }
  };

  const openDialog = (type, entity) => {
    setDialogState({ open: true, type, entity });
    setDialogValues({
      name: entity.name,
      status: entity.status ?? "",
      active: entity.active ?? true,
      limit: entity.limit != null ? String(entity.limit) : "",
      closingDay: entity.closingDay != null ? String(entity.closingDay) : "",
      billingRolloverPolicy: entity.billingRolloverPolicy ?? "NEXT_BUSINESS_DAY",
    });
  };

  const closeDialog = () => {
    setDialogState({ open: false, type: null, entity: null });
  };

  const handleDialogChange = (field) => (event) => {
    const value = field === "active" ? event.target.checked : event.target.value;
    setDialogValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleDialogSave = async () => {
    if (!dialogState.open || !dialogState.entity) return;
    try {
      const payload = {
        name: dialogValues.name,
        status: dialogValues.status,
        active: dialogValues.active,
      };
      if (dialogState.type === "origin") {
        payload.limit = dialogValues.limit === "" ? null : Number(dialogValues.limit);
        payload.closingDay =
          dialogState.entity.type === "Cartão"
            ? dialogValues.closingDay === ""
              ? null
              : Number(dialogValues.closingDay)
            : null;
        payload.billingRolloverPolicy =
          dialogState.entity.type === "Cartão"
            ? dialogValues.billingRolloverPolicy
            : null;
        await updateOrigin(dialogState.entity.id, payload);
      } else {
        await updateDebtor(dialogState.entity.id, payload);
      }
      toast.success();
      closeDialog();
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Section title="Minhas Contas/Origens" subtitle="Cadastre seus cartões e contas fixas.">
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Nome"
                  placeholder="Ex.: Cartão Nubank"
                  fullWidth
                  value={originForm.name}
                  onChange={handleOriginChange("name")}
                  inputRef={originNameRef}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="Tipo" fullWidth value={originForm.type} onChange={handleOriginChange("type")}>
                  <MenuItem value="Cartão">Cartão</MenuItem>
                  <MenuItem value="Conta">Conta</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Dia vencimento" fullWidth value={originForm.dueDay} onChange={handleOriginChange("dueDay")} placeholder="Ex.: 5" />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Limite (R$)" fullWidth value={originForm.limit} onChange={handleOriginChange("limit")} inputProps={{ inputMode: "decimal" }} />
              </Grid>
              {originForm.type === "Cartão" && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Dia de fechamento"
                      placeholder="Ex.: 4"
                      fullWidth
                      value={originForm.closingDay}
                      onChange={handleOriginChange("closingDay")}
                      inputProps={{ inputMode: "numeric", min: 1, max: 31 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="Política de rollover"
                      fullWidth
                      value={originForm.billingRolloverPolicy}
                      onChange={handleOriginChange("billingRolloverPolicy")}
                    >
                      <MenuItem value="NEXT_BUSINESS_DAY">Próximo dia útil</MenuItem>
                      <MenuItem value="PREVIOUS_BUSINESS_DAY">Dia útil anterior</MenuItem>
                    </TextField>
                  </Grid>
                </>
              )}
            </Grid>
            <Button onClick={addOrigin} disabled={originLoading} variant="contained">
              {originLoading ? "Salvando..." : "Adicionar Conta/Origem"}
            </Button>
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Contas cadastradas
            </Typography>
            {origins.length ? (
              <List>
                {origins.map((origin) => (
                  <ListItem
                    key={origin.id}
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <IconButton onClick={() => openDialog("origin", origin)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton edge="end" color="error" onClick={() => delOrigin(origin.id)} size="small">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{origin.name}</Typography>
                          <Chip label={origin.type} size="small" />
                          <Chip
                            label={origin.active ? "Ativo" : "Inativo"}
                            size="small"
                            color={origin.active ? "success" : "default"}
                            variant="outlined"
                          />
                        </Stack>
                      }
                      secondary={`Status: ${origin.status ?? "-"} • Limite: ${
                        origin.limit ? toBRL(parseNum(origin.limit)) : "N/A"
                      }${origin.type === "Cartão"
                        ? ` • Fechamento: ${origin.closingDay ?? "Configurar"} (${origin.billingRolloverPolicy ?? "NEXT_BUSINESS_DAY"})`
                        : ""}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                title="Nenhuma conta cadastrada"
                description="Cadastre suas contas e cartões para começar a lançar despesas."
                ctaLabel="Adicionar origem"
                onCtaClick={focusOriginForm}
              />
            )}
          </Stack>
        </Section>
      </Grid>

      <Grid item xs={12} md={6}>
        <Section title="Devedores" subtitle="Cadastre as pessoas que podem dever dinheiro para você.">
          <Stack spacing={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Nome da pessoa"
                placeholder="Ex.: Irmã, Esposa"
                fullWidth
                value={debtorForm.name}
                onChange={handleDebtorChange}
                inputRef={debtorNameRef}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDebtor();
                  }
                }}
              />
              <Button variant="contained" onClick={addDebtor} disabled={debtorLoading} sx={{ minWidth: 160 }}>
                {debtorLoading ? "Salvando..." : "Adicionar"}
              </Button>
            </Stack>
            <Divider />
            {debtors.length ? (
              <List>
                {debtors.map((debtor) => (
                  <ListItem
                    key={debtor.id}
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <IconButton onClick={() => openDialog("debtor", debtor)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton edge="end" color="error" onClick={() => delDebtor(debtor.id)} size="small">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{debtor.name}</Typography>
                          <Chip label={debtor.active ? "Ativo" : "Inativo"} size="small" color={debtor.active ? "success" : "default"} variant="outlined" />
                        </Stack>
                      }
                      secondary={`Status: ${debtor.status ?? "-"}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                title="Nenhum devedor cadastrado"
                description="Cadastre as pessoas com quem compartilha despesas."
                ctaLabel="Adicionar pessoa"
                onCtaClick={focusDebtorForm}
              />
            )}
          </Stack>
        </Section>
      </Grid>

      <Grid item xs={12}>
        <Section title="Categorias" subtitle="Personalize as categorias usadas nos lançamentos e edições em massa.">
          <Stack spacing={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Nome da categoria"
                placeholder="Ex.: Saúde"
                fullWidth
                value={categoryName}
                onChange={handleCategoryChange}
                inputRef={categoryNameRef}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button variant="outlined" onClick={handleAddCategory} sx={{ minWidth: 200 }}>
                Cadastrar categoria
              </Button>
            </Stack>
            {categories?.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {categories.map((category) => (
                  <Chip key={category} label={category} variant="outlined" />
                ))}
              </Stack>
            ) : (
              <EmptyState
                title="Nenhuma categoria disponível"
                description="As categorias cadastradas serão exibidas aqui."
                ctaLabel="Adicionar categoria"
                onCtaClick={focusCategoryForm}
              />
            )}
          </Stack>
        </Section>
      </Grid>

      <Dialog open={dialogState.open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Editar {dialogState.type === "origin" ? "origem" : "devedor"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome" value={dialogValues.name} onChange={handleDialogChange("name")} fullWidth />
            <TextField label="Status" value={dialogValues.status} onChange={handleDialogChange("status")} fullWidth />
            {dialogState.type === "origin" && (
              <TextField
                label="Limite (R$)"
                value={dialogValues.limit}
                onChange={handleDialogChange("limit")}
                fullWidth
                inputProps={{ inputMode: "decimal" }}
              />
            )}
            {dialogState.type === "origin" && dialogState.entity?.type === "Cartão" && (
              <>
                <TextField
                  label="Dia de fechamento"
                  value={dialogValues.closingDay}
                  onChange={handleDialogChange("closingDay")}
                  fullWidth
                  inputProps={{ inputMode: "numeric", min: 1, max: 31 }}
                />
                <TextField
                  select
                  label="Política de rollover"
                  value={dialogValues.billingRolloverPolicy}
                  onChange={handleDialogChange("billingRolloverPolicy")}
                  fullWidth
                >
                  <MenuItem value="NEXT_BUSINESS_DAY">Próximo dia útil</MenuItem>
                  <MenuItem value="PREVIOUS_BUSINESS_DAY">Dia útil anterior</MenuItem>
                </TextField>
              </>
            )}
            <FormControlLabel
              control={<Checkbox checked={dialogValues.active} onChange={handleDialogChange("active")} />}
              label="Ativo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleDialogSave}>
            Salvar alterações
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
