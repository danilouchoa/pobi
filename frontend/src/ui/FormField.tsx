import type { ReactNode } from "react";
import { tokens } from "./tokens";

export type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ id, label, required, helperText, error, children }: FormFieldProps) {
  const helperColor = error ? tokens.colors.error.text : tokens.colors.mutedText;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xxs }}>
      <label
        htmlFor={id}
        style={{
          color: tokens.colors.neutralText,
          display: "flex",
          font: tokens.typography.label,
          fontFamily: tokens.typography.fontFamily,
          gap: tokens.spacing.xxs,
          alignItems: "center",
        }}
      >
        <span>{label}</span>
        {required && (
          <span aria-hidden style={{ color: tokens.colors.danger.base, fontSize: "12px" }}>
            *
          </span>
        )}
      </label>
      {children}
      {(helperText || error) && (
        <p
          id={error ? `${id}-error` : `${id}-helper`}
          style={{
            color: helperColor,
            font: tokens.typography.helper,
            fontFamily: tokens.typography.fontFamily,
            margin: 0,
          }}
          aria-live={error ? "assertive" : "polite"}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}
