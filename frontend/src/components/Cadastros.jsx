import { useState, useEffect } from "react";
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
  Snackbar,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Section from "./ui/Section";
import { parseNum, toBRL } from "../utils/helpers";

export default function Cadastros({
  origins,
  debtors,
  createOrigin,
  deleteOrigin,
  updateOrigin,
  createDebtor,
  deleteDebtor,
  updateDebtor,
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
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    console.log("Cadastros updated:", { originsCount: origins?.length ?? 0, debtorsCount: debtors?.length ?? 0 });
  }, [origins, debtors]);

  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });
  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

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

  const addOrigin = async () => {
    if (!originForm.name.trim()) return;
    if (originForm.type === "Cartão" && !originForm.closingDay.trim()) {
      showSnackbar("Informe o dia de fechamento do cartão.", "error");
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
      showSnackbar("Origem adicionada!");
    } catch (error) {
      console.error("Erro ao criar origem:", error);
      showSnackbar("Erro ao criar origem.", "error");
    } finally {
      setOriginLoading(false);
    }
  };

  const delOrigin = async (id) => {
    if (!window.confirm("Deseja remover esta origem?")) return;
    try {
      await deleteOrigin(id);
      showSnackbar("Origem removida!");
    } catch (error) {
      console.error("Erro ao remover origem:", error);
      showSnackbar("Erro ao remover origem.", "error");
    }
  };

  const addDebtor = async () => {
    if (!debtorForm.name.trim()) return;
    setDebtorLoading(true);
    try {
      await createDebtor({ name: debtorForm.name.trim() });
      setDebtorForm({ name: "" });
      showSnackbar("Devedor adicionado!");
    } catch (error) {
      console.error("Erro ao criar devedor:", error);
      showSnackbar("Erro ao criar devedor.", "error");
    } finally {
      setDebtorLoading(false);
    }
  };

  const delDebtor = async (id) => {
    if (!window.confirm("Deseja remover este devedor?")) return;
    try {
      await deleteDebtor(id);
      showSnackbar("Devedor removido!");
    } catch (error) {
      console.error("Erro ao remover devedor:", error);
      showSnackbar("Erro ao remover devedor.", "error");
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
        showSnackbar("Origem atualizada!");
      } else {
        await updateDebtor(dialogState.entity.id, payload);
        showSnackbar("Devedor atualizado!");
      }
      closeDialog();
    } catch (error) {
      console.error("Erro ao atualizar registro:", error);
      showSnackbar("Erro ao salvar alterações.", "error");
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Section title="Minhas Contas/Origens" subtitle="Cadastre seus cartões e contas fixas.">
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Nome" placeholder="Ex.: Cartão Nubank" fullWidth value={originForm.name} onChange={handleOriginChange("name")} />
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
              {origins.length === 0 && (
                <ListItem>
                  <ListItemText primary={<Typography color="text.secondary">Nenhuma conta cadastrada ainda.</Typography>} />
                </ListItem>
              )}
            </List>
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
              {debtors.length === 0 && (
                <ListItem>
                  <ListItemText primary={<Typography color="text.secondary">Nenhuma pessoa cadastrada ainda.</Typography>} />
                </ListItem>
              )}
            </List>
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

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={closeSnackbar}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Grid>
  );
}
