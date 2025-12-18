import { AxiosError } from "axios";
import { vi } from "vitest";
import api, { registerEmailNotVerifiedHandler } from "../services/api";

const getEmailNotVerifiedInterceptor = () => {
  const handlers = (api.interceptors.response as any).handlers as Array<{
    fulfilled?: (value: any) => any;
    rejected?: (error: any) => any;
  }>;
  const handler = handlers.find((entry) => typeof entry?.rejected === "function")?.rejected;
  if (!handler) {
    throw new Error("Interceptor de resposta não encontrado");
  }
  return handler;
};

describe("Interceptor EMAIL_NOT_VERIFIED", () => {
  beforeEach(() => {
    registerEmailNotVerifiedHandler(null);
  });

  it("propaga mensagem amigável e chama handler de navegação", async () => {
    const rejected = getEmailNotVerifiedInterceptor();
    const navigate = vi.fn();

    registerEmailNotVerifiedHandler(navigate);

    const axiosError = new AxiosError(
      "Forbidden",
      undefined,
      {},
      {},
      {
        status: 403,
        data: { error: "EMAIL_NOT_VERIFIED", message: "Verifique seu e-mail" },
        statusText: "Forbidden",
        headers: {},
        config: {},
      } as any
    );

    await expect(rejected(axiosError)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
      redirectPath: "/auth/check-email",
    });
    expect(navigate).toHaveBeenCalledWith({
      message: "Verifique seu e-mail",
      redirectPath: "/auth/check-email",
    });
  });

  it("mantém comportamento padrão para outros 403", async () => {
    const rejected = getEmailNotVerifiedInterceptor();
    const axiosError = new AxiosError(
      "Forbidden",
      undefined,
      {},
      {},
      {
        status: 403,
        data: { error: "OTHER_ERROR" },
        statusText: "Forbidden",
        headers: {},
        config: {},
      } as any
    );

    await expect(rejected(axiosError)).rejects.toBe(axiosError);
  });
});
