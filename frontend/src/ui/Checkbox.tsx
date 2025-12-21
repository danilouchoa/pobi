import type { ChangeEventHandler, ReactNode } from "react";
import { tokens } from "./tokens";

export type CheckboxProps = {
  id: string;
  name?: string;
  label: ReactNode;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: string;
};

export function Checkbox({
  id,
  name,
  label,
  checked,
  onChange,
  required,
  disabled,
  helperText,
  error,
}: CheckboxProps) {
  const helperColor = error ? tokens.colors.error.text : tokens.colors.mutedText;
  const helperId = error ? `${id}-error` : `${id}-helper`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xxs }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: tokens.spacing.xs,
          color: tokens.colors.neutralText,
          font: tokens.typography.body,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={helperText || error ? helperId : undefined}
          disabled={disabled}
          style={{
            width: 18,
            height: 18,
            marginTop: 2,
            accentColor: tokens.colors.primary.base,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <span style={{ display: "inline-flex", gap: tokens.spacing.xxs, alignItems: "center" }}>
          <span>{label}</span>
          {required && (
            <span aria-hidden style={{ color: tokens.colors.danger.base, fontSize: "12px" }}>
              *
            </span>
          )}
        </span>
      </label>
      {(helperText || error) && (
        <p
          id={helperId}
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
