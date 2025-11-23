import { SnackbarProvider } from "notistack";
import type { ReactNode } from "react";

/**
 * ToastProvider
 *
 * Componente responsável por instanciar o SnackbarProvider (notistack) uma única vez,
 * disponível em toda a árvore React. Centralizamos aqui:
 * - Posição (top-right) para seguir o guideline da milestone.
 * - Quantidade máxima simultânea (3) para evitar ruídos.
 * - autoHideDuration curto (3000ms) para feedback ágil em CRUDs.
 * Qualquer tela pode chamar useToast sem se preocupar com configuração repetida.
 */
type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      /**
       * preventDuplicate garante que notistack ignore mensagens exatamente iguais.
       * Ainda assim implementamos o debounce manual no hook para reforçar o controle.
       */
      preventDuplicate
    >
      {children}
    </SnackbarProvider>
  );
}
