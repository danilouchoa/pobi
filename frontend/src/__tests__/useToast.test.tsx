import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useToast } from "../hooks/useToast.ts";

const enqueueSnackbar = vi.fn();

vi.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

describe('useToast', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    enqueueSnackbar.mockClear();
  });

  it("deve exibir toast de sucesso", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.success("Sucesso!");
    expect(enqueueSnackbar).toHaveBeenCalledWith("Sucesso!", { variant: "success" });
  });

  it("deve exibir toast de erro com fallback", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.error();
    expect(enqueueSnackbar).toHaveBeenCalledWith("Não foi possível completar a operação.", {
      variant: "error",
    });
  });

  it("deve exibir toast de info", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.info("Info!");
    expect(enqueueSnackbar).toHaveBeenCalledWith("Info!", { variant: "info" });
  });

  it("deve exibir toast de warning", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.warning("Atenção!");
    expect(enqueueSnackbar).toHaveBeenCalledWith("Atenção!", { variant: "warning" });
  });
});
