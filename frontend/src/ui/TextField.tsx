import { useId, useState } from "react";
import type { InputHTMLAttributes, Ref } from "react";
import { tokens } from "./tokens";

export type TextFieldProps = {
  label: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  onToggleVisibilityLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

const cssVar = (name: string, fallback: string) => `var(${name}, ${fallback})`;

export function TextField({
  id,
  type = "text",
  label,
  helperText,
  error,
  required,
  disabled,
  fullWidth,
  onToggleVisibilityLabel = "Mostrar senha",
  inputRef,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const controlType = isPassword && showPassword ? "text" : type;

  const describedBy: string[] = [];
  if (helperText) describedBy.push(`${inputId}-helper`);
  if (error) describedBy.push(`${inputId}-error`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xxs, width: fullWidth ? "100%" : undefined }}>
      <label
        htmlFor={inputId}
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
      <div
        style={{
          position: "relative",
          width: fullWidth ? "100%" : undefined,
        }}
      >
        <input
          id={inputId}
          {...inputProps}
          ref={inputRef}
          type={controlType}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy.length ? describedBy.join(" ") : undefined}
          style={{
            appearance: "none",
            backgroundColor: cssVar("--finfy-colors-surface", tokens.colors.surface),
            border: `${tokens.borders.width} solid ${
              error
                ? cssVar("--finfy-colors-error-border", tokens.colors.error.border)
                : cssVar("--finfy-colors-ghost-border", tokens.colors.ghost.border)
            }`,
            borderRadius: cssVar("--finfy-radii-md", tokens.radii.md),
            color: tokens.colors.neutralText,
            font: tokens.typography.body,
            fontFamily: tokens.typography.fontFamily,
            outline: "none",
            padding: `${tokens.spacing.sm} ${isPassword ? tokens.spacing.lg : tokens.spacing.sm}`,
            width: "100%",
            transition: `border-color ${tokens.motion.transitionFast}, box-shadow ${tokens.motion.transitionFast}`,
            height: "48px",
          }}
          onFocus={(event) => {
            inputProps.onFocus?.(event);
            event.currentTarget.style.boxShadow = `${cssVar("--finfy-shadows-focus", tokens.shadows.focus)}, 0 0 0 ${
              tokens.borders.focusGap
            } ${cssVar("--finfy-colors-surface", tokens.colors.surface)}`;
            event.currentTarget.style.borderColor = cssVar("--finfy-colors-primary-border", tokens.colors.primary.border);
          }}
          onBlur={(event) => {
            inputProps.onBlur?.(event);
            event.currentTarget.style.boxShadow = "none";
            event.currentTarget.style.borderColor = error
              ? cssVar("--finfy-colors-error-border", tokens.colors.error.border)
              : cssVar("--finfy-colors-ghost-border", tokens.colors.ghost.border);
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
            aria-label={onToggleVisibilityLabel}
            style={{
              position: "absolute",
              top: "50%",
              right: tokens.spacing.xs,
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: tokens.colors.mutedText,
              cursor: "pointer",
              font: tokens.typography.helper,
              padding: tokens.spacing.xxs,
            }}
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
      {(helperText || error) && (
        <p
          id={error ? `${inputId}-error` : `${inputId}-helper`}
          style={{
            color: error ? tokens.colors.error.text : tokens.colors.mutedText,
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
