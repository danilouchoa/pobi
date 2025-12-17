import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "../TextField";

describe("TextField", () => {
  it("renders label and helper text", () => {
    render(<TextField label="Email" name="email" helperText="Digite seu e-mail" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByText("Digite seu e-mail")).toBeInTheDocument();
  });

  it("marks field as invalid when error is provided", () => {
    render(<TextField label="Senha" name="password" error="Obrigatório" />);
    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = input.getAttribute("aria-describedby");
    expect(described).toContain("error");
    expect(screen.getByText("Obrigatório")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<TextField label="Senha" name="password" type="password" />);
    const input = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(input.type).toBe("password");

    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    expect(input.type).toBe("text");
  });
});
