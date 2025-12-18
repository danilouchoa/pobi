import type { HTMLAttributes, ReactNode } from "react";
import { tokens } from "./tokens";

export type AlertVariant = "info" | "success" | "warning" | "error";

export type AlertProps = {
  title?: string;
  message: string;
  variant?: AlertVariant;
  icon?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Alert({ title, message, variant = "info", icon, ...props }: AlertProps) {
  const palette = tokens.colors[variant];

  return (
    <div
      role="alert"
      aria-live={variant === "error" ? "assertive" : "polite"}
      {...props}
      style={{
        alignItems: "flex-start",
        backgroundColor: palette.background,
        border: `${tokens.borders.width} solid ${palette.border}`,
        borderRadius: tokens.radii.md,
        color: palette.text,
        display: "flex",
        gap: tokens.spacing.sm,
        padding: tokens.spacing.md,
        ...props.style,
      }}
    >
      <div aria-hidden style={{ marginTop: "2px", color: palette.icon }}>
        {icon ?? "•"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xxs }}>
        {title && (
          <strong style={{ font: tokens.typography.label, fontFamily: tokens.typography.fontFamily, color: palette.text }}>
            {title}
          </strong>
        )}
        <span style={{ font: tokens.typography.body, fontFamily: tokens.typography.fontFamily }}>{message}</span>
      </div>
    </div>
  );
}
