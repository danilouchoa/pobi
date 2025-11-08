import { useEffect, useState, ChangeEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Stack,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import type { BulkUpdatePayload, Origin } from "../types";

type BulkFormState = {
  category: string;
  originId: string;
  fixed: "keep" | "true" | "false";
  recurring: "keep" | "true" | "false";
  recurrenceType: "keep" | "monthly" | "weekly" | "yearly";
};

type ExpenseBulkModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: BulkUpdatePayload["data"]) => Promise<void> | void;
  origins: Origin[];
  categories: string[];
};

const defaultState: BulkFormState = {
  category: "",
  originId: "",
  fixed: "keep",
  recurring: "keep",
  recurrenceType: "keep",
};

export default function ExpenseBulkModal({ open, onClose, onSubmit, origins, categories }: ExpenseBulkModalProps) {
  const [form, setForm] = useState<BulkFormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);
  const [applyRecurrenceType, setApplyRecurrenceType] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultState);
      setApplyRecurrenceType(false);
    }
  }, [open]);

  const handleChange = (field: keyof BulkFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    const payload: BulkUpdatePayload["data"] = {};
    if (form.category) payload.category = form.category;
    if (form.originId) payload.originId = form.originId;
    if (form.fixed !== "keep") payload.fixed = form.fixed === "true";
    if (form.recurring !== "keep") payload.recurring = form.recurring === "true";
    if (applyRecurrenceType && form.recurrenceType !== "keep") {
      payload.recurrenceType = form.recurrenceType;
    }
    if (Object.keys(payload).length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    Boolean(form.category) ||
    Boolean(form.originId) ||
    form.fixed !== "keep" ||
    form.recurring !== "keep" ||
    (applyRecurrenceType && form.recurrenceType !== "keep");

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar lançamentos selecionados</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Categoria"
            value={form.category}
            onChange={handleChange("category")}
            fullWidth
          >
            <MenuItem value="">Manter</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Origem"
            value={form.originId}
            onChange={handleChange("originId")}
            fullWidth
          >
            <MenuItem value="">Manter</MenuItem>
            {origins.map((origin) => (
              <MenuItem key={origin.id} value={origin.id}>
                {origin.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Fixa" value={form.fixed} onChange={handleChange("fixed")} fullWidth>
            <MenuItem value="keep">Manter</MenuItem>
            <MenuItem value="true">Sim</MenuItem>
            <MenuItem value="false">Não</MenuItem>
          </TextField>
          <TextField select label="Recorrente" value={form.recurring} onChange={handleChange("recurring")} fullWidth>
            <MenuItem value="keep">Manter</MenuItem>
            <MenuItem value="true">Sim</MenuItem>
            <MenuItem value="false">Não</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Checkbox checked={applyRecurrenceType} onChange={(event) => setApplyRecurrenceType(event.target.checked)} />}
            label="Atualizar tipo de recorrência"
          />
          {applyRecurrenceType && (
            <TextField
              select
              label="Tipo de recorrência"
              value={form.recurrenceType}
              onChange={handleChange("recurrenceType")}
              fullWidth
            >
              <MenuItem value="keep">Manter</MenuItem>
              <MenuItem value="monthly">Mensal</MenuItem>
              <MenuItem value="weekly">Semanal</MenuItem>
              <MenuItem value="yearly">Anual</MenuItem>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !canSubmit}>
          {submitting ? "Enviando..." : "Aplicar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
