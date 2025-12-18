import { render, screen } from "@testing-library/react";
import { Alert } from "../Alert";

describe("Alert", () => {
  it("applies aria roles and variant styling", () => {
    render(<Alert variant="error" title="Erro" message="Credenciais inválidas" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Erro")).toBeInTheDocument();
    expect(screen.getByText("Credenciais inválidas")).toBeInTheDocument();
  });
});
