import { useEffect, useState } from "react";
import { Grid, TextField, Button, Stack, Typography } from "@mui/material";
import Section from "./ui/Section";
import KPI from "./ui/KPI";
import { parseNum, toBRL } from "../utils/helpers";
import { DEFAULT_SALARY_TEMPLATE } from "../hooks/useFinanceApp";
import { useToast } from "../ui/feedback";

export default function Salario({ month, salary, saveSalary }) {
  const [form, setForm] = useState(() => ({
    hours: salary?.hours ?? DEFAULT_SALARY_TEMPLATE.hours,
    hourRate: salary?.hourRate ?? DEFAULT_SALARY_TEMPLATE.hourRate,
    taxRate: salary?.taxRate ?? DEFAULT_SALARY_TEMPLATE.taxRate,
    cnae: salary?.cnae ?? DEFAULT_SALARY_TEMPLATE.cnae,
  }));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setForm({
      hours: salary?.hours ?? DEFAULT_SALARY_TEMPLATE.hours,
      hourRate: salary?.hourRate ?? DEFAULT_SALARY_TEMPLATE.hourRate,
      taxRate: salary?.taxRate ?? DEFAULT_SALARY_TEMPLATE.taxRate,
      cnae: salary?.cnae ?? DEFAULT_SALARY_TEMPLATE.cnae,
    });
  }, [salary, month]);

  useEffect(() => {
    console.log("Salario updated:", { month, salary });
  }, [month, salary]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveSalary(month, form);
      toast.success();
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const hoursNum = parseNum(form.hours);
  const hourRateNum = parseNum(form.hourRate);
  const taxRateNum = parseNum(form.taxRate);
  const gross = hoursNum * hourRateNum;
  const tax = gross * taxRateNum;
  const net = gross - tax;
  const netHourRate = net / Math.max(1, hoursNum);

  return (
    <Stack spacing={3}>
      <Section
        title={`Salário por horas (Mês: ${month})`}
        subtitle="Atualize as informações de horas, valor hora e impostos para cada mês."
      >
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Horas no mês"
                fullWidth
                value={form.hours}
                onChange={handleChange("hours")}
                inputProps={{ inputMode: "numeric" }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Valor/hora (R$)"
                fullWidth
                value={form.hourRate}
                onChange={handleChange("hourRate")}
                inputProps={{ inputMode: "decimal" }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Alíquota de imposto"
                fullWidth
                value={form.taxRate}
                onChange={handleChange("taxRate")}
                helperText="Ex.: 0.06 = 6%"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="CNAE" fullWidth value={form.cnae} onChange={handleChange("cnae")} />
            </Grid>
          </Grid>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Salvando..." : "Salvar salário"}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Os dados são sincronizados com a API autenticada.
            </Typography>
          </Stack>
        </Stack>
      </Section>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <KPI label="Bruto (Mês)" value={toBRL(gross)} />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label={`Impostos (${(parseNum(form.taxRate) * 100).toFixed(2)}%)`} value={toBRL(tax)} />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="Líquido (Mês)" value={toBRL(net)} highlight />
        </Grid>
        <Grid item xs={12} md={3}>
          <KPI label="Valor hora líquido" value={toBRL(netHourRate)} />
        </Grid>
      </Grid>
    </Stack>
  );
}
