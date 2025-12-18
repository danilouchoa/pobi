import { render, screen } from "@testing-library/react";
import { FormField } from "../FormField";

describe("FormField", () => {
  it("renders label and helper text", () => {
    render(
      <FormField id="name" label="Nome" helperText="Visível para a equipe">
        <input id="name" />
      </FormField>
    );

    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByText("Visível para a equipe")).toBeInTheDocument();
  });
});
