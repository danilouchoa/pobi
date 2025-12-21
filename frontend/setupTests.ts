import "@testing-library/jest-dom";
import { vi } from "vitest";

// Config global para RTL pode ser adicionado aqui
// Exemplo: mock de window.matchMedia, etc.

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => null,
  GoogleOAuthProvider: ({ children }: { children: any }) => children,
}));
