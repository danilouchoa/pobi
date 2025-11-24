import { render, screen } from "@testing-library/react";
import { AuthShell } from "../AuthShell";

describe("AuthShell", () => {
  it("renders headline, subtitle and children", () => {
    render(
      <AuthShell title="Teste Finfy" subtitle="Subcopy clara" variant="login">
        <div>Form content</div>
      </AuthShell>
    );

    expect(screen.getByRole("heading", { level: 1, name: /Teste Finfy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Subcopy clara/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Form content/i)).toBeInTheDocument();
  });

  it("renders side content inside hero bullets", () => {
    render(
      <AuthShell sideContent={<div>Extra confiança</div>}>
        <div>content</div>
      </AuthShell>
    );

    expect(screen.getByText(/Extra confiança/i)).toBeInTheDocument();
  });
});
