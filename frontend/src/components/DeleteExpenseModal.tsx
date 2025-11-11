import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface DeleteExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmOne: () => void;
  onConfirmAll: () => void;
}

const DeleteExpenseModal: React.FC<DeleteExpenseModalProps> = ({
  isOpen,
  onClose,
  onConfirmOne,
  onConfirmAll,
}) => {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Excluir Lançamento</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Este item é uma parcela. Deseja excluir apenas esta parcela ou todas as parcelas relacionadas a esta compra?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button onClick={onConfirmOne} color="primary" variant="outlined">
          Excluir Só Esta Parcela
        </Button>
        <Button onClick={onConfirmAll} color="error" variant="contained">
          Excluir Todas as Parcelas
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteExpenseModal;
