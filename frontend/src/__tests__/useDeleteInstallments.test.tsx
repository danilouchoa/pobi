import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteInstallments } from "../hooks/useDeleteInstallments";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

const deleteInstallmentsRequest = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("../services/expenseService", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    deleteInstallments: (...args: unknown[]) => deleteInstallmentsRequest(...args),
  };
});

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    success,
    error,
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const wrapper =
  ({ children }: { children: React.ReactNode }) =>
  (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );

describe("useDeleteInstallments", () => {
  beforeEach(() => {
    deleteInstallmentsRequest.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("chama o backend com os IDs corretos e emite toast de sucesso", async () => {
    deleteInstallmentsRequest.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteInstallments({ month: "2025-01", mode: "calendar" }), { wrapper });

    await act(async () => {
      await result.current.deleteInstallments(["a", "b"]);
    });

    expect(deleteInstallmentsRequest).toHaveBeenCalledWith(["a", "b"]);
    expect(success).toHaveBeenCalledWith("Parcelas excluídas com sucesso.");
    expect(result.current.isDeletingInstallments).toBe(false);
  });

  it("não chama o backend quando IDs estiverem vazios", async () => {
    deleteInstallmentsRequest.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteInstallments({ month: "2025-01", mode: "calendar" }), { wrapper });

    await act(async () => {
      await result.current.deleteInstallments([]);
    });

    expect(deleteInstallmentsRequest).toHaveBeenCalledWith([]);
  });

  it("trata erros retornando toast vermelho e limpando o loading", async () => {
    deleteInstallmentsRequest.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useDeleteInstallments({ month: "2025-01", mode: "calendar" }), { wrapper });

    await expect(
      act(async () => {
        await result.current.deleteInstallments(["err"]);
      })
    ).rejects.toThrowError("fail");

    expect(error).toHaveBeenCalled();
    expect(result.current.isDeletingInstallments).toBe(false);
  });

  it("controla o estado de loading enquanto a exclusão está em andamento", async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    deleteInstallmentsRequest.mockReturnValueOnce(pendingPromise);
    const { result } = renderHook(() => useDeleteInstallments({ month: "2025-01", mode: "calendar" }), { wrapper });

    await act(async () => {
      const call = result.current.deleteInstallments(["temp"]);
      expect(result.current.isDeletingInstallments).toBe(true);
      resolvePromise!();
      await call;
    });

    expect(result.current.isDeletingInstallments).toBe(false);
  });
});
