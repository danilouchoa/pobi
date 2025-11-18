import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type ConfirmInstallmentDeleteModalProps = {
  open: boolean;
  count: number;
  groupId: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export default function ConfirmInstallmentDeleteModal({
  open,
  count,
  groupId,
  onCancel,
  onConfirm,
  loading = false,
}: ConfirmInstallmentDeleteModalProps) {
  const label = count === 1 ? "parcela" : "parcelas";
  const groupLabel = groupId ? `#${groupId}` : "sem identificador";

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel}>
      <DialogTitle>Confirmar exclusão</DialogTitle>
      <DialogContent>
        <Typography component="p" sx={{ mb: 1.5 }}>
          Você confirma a exclusão de <strong>{count}</strong> {label}(s) do agrupamento <strong>{groupLabel}</strong>?
        </Typography>
        <Typography component="p" color="text.secondary">
          Essa ação é irreversível.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={loading}>
          {loading ? "Excluindo..." : "Confirmar exclusão"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
