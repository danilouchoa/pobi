import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import api from "../services/api";
import { deleteInstallments } from "../services/expenseService";

describe("expenseService.deleteInstallments", () => {
  let deleteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deleteSpy = vi.spyOn(api, "delete").mockResolvedValue({} as any);
  });

  afterEach(() => {
    deleteSpy.mockRestore();
  });

  it("envia os IDs válidos para o endpoint correto", async () => {
    await deleteInstallments(["a", "b"]);

    expect(deleteSpy).toHaveBeenCalledWith("/api/installments", {
      data: { installmentIds: ["a", "b"] },
    });
  });

  it("não chama o backend quando a lista estiver vazia", async () => {
    await deleteInstallments([]);

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("protege a API contra valores inválidos", async () => {
    await deleteInstallments(undefined as unknown as string[]);

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
