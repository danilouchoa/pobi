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
  Box,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Section from "./ui/Section";
import { parseNum, toBRL } from "../utils/helpers";

export default function Cadastros({
  origins,
  debtors,
  createOrigin,
  deleteOrigin,
  createDebtor,
  deleteDebtor,
}) {
  const [originForm, setOriginForm] = useState({
    name: "",
    type: "Cartão",
    dueDay: "",
    limit: "",
  });
  const [debtorForm, setDebtorForm] = useState({ name: "" });
  const [originLoading, setOriginLoading] = useState(false);
  const [debtorLoading, setDebtorLoading] = useState(false);

  useEffect(() => {
    console.log("Cadastros updated:", { originsCount: origins?.length ?? 0, debtorsCount: debtors?.length ?? 0 });
  }, [origins, debtors]);

  const handleOriginChange = (field) => (event) => {
    setOriginForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleDebtorChange = (event) => {
    setDebtorForm({ name: event.target.value });
  };

  const addOrigin = async () => {
    if (!originForm.name.trim()) return;
    setOriginLoading(true);
    try {
      await createOrigin({
        name: originForm.name.trim(),
        type: originForm.type,
        dueDay: originForm.dueDay.trim(),
        limit: originForm.limit.trim(),
      });
      setOriginForm({ name: "", type: "Cartão", dueDay: "", limit: "" });
    } catch (error) {
      console.error("Erro ao criar origem:", error);
      alert("Não foi possível salvar a origem.");
    } finally {
      setOriginLoading(false);
    }
  };

  const delOrigin = async (id) => {
    if (!window.confirm("Deseja remover esta origem?")) return;
    try {
      await deleteOrigin(id);
    } catch (error) {
      console.error("Erro ao remover origem:", error);
      alert("Não foi possível remover a origem.");
    }
  };

  const addDebtor = async () => {
    if (!debtorForm.name.trim()) return;
    setDebtorLoading(true);
    try {
      await createDebtor({ name: debtorForm.name.trim() });
      setDebtorForm({ name: "" });
    } catch (error) {
      console.error("Erro ao criar devedor:", error);
      alert("Não foi possível salvar o devedor.");
    } finally {
      setDebtorLoading(false);
    }
  };

  const delDebtor = async (id) => {
    if (!window.confirm("Deseja remover este devedor?")) return;
    try {
      await deleteDebtor(id);
    } catch (error) {
      console.error("Erro ao remover devedor:", error);
      alert("Não foi possível remover o devedor.");
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
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="Tipo" fullWidth value={originForm.type} onChange={handleOriginChange("type")}>
                  <MenuItem value="Cartão">Cartão</MenuItem>
                  <MenuItem value="Conta">Conta</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Dia vencimento"
                  placeholder="Ex.: 4"
                  fullWidth
                  value={originForm.dueDay}
                  onChange={handleOriginChange("dueDay")}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Limite (R$)"
                  placeholder="Ex.: 5000"
                  fullWidth
                  value={originForm.limit}
                  onChange={handleOriginChange("limit")}
                />
              </Grid>
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
                    <IconButton edge="end" color="error" onClick={() => delOrigin(origin.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={600}>{origin.name}</Typography>
                        <Chip label={origin.type} size="small" variant="outlined" color="secondary" />
                      </Stack>
                    }
                    secondary={`Venc: dia ${origin.dueDay || "N/A"} • Limite: ${
                      origin.limit ? toBRL(parseNum(origin.limit)) : "N/A"
                    }`}
                  />
                </ListItem>
              ))}
              {origins.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={<Typography color="text.secondary">Nenhuma conta cadastrada ainda.</Typography>}
                  />
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
              <Button variant="contained" onClick={addDebtor} disabled={debtorLoading} sx={{ minWidth: 180 }}>
                {debtorLoading ? "Salvando..." : "Adicionar"}
              </Button>
            </Stack>
            <Divider />
            <List>
              {debtors.map((debtor) => (
                <ListItem
                  key={debtor.id}
                  secondaryAction={
                    <IconButton edge="end" color="error" onClick={() => delDebtor(debtor.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={debtor.name} />
                </ListItem>
              ))}
              {debtors.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={<Typography color="text.secondary">Nenhuma pessoa cadastrada ainda.</Typography>}
                  />
                </ListItem>
              )}
            </List>
          </Stack>
        </Section>
      </Grid>
    </Grid>
  );
}
