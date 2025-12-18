import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button";

describe("Button", () => {
  it("renders the label and triggers click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button label="Entrar" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows loading state and disables interactions", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button label="Carregando" isLoading onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Carregando" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
