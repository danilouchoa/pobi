import type { HTMLAttributes, ReactNode } from "react";
import { tokens } from "./tokens";

export type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Card({ title, description, actions, children, ...props }: CardProps) {
  return (
    <section
      {...props}
      style={{
        backgroundColor: tokens.colors.surface,
        borderRadius: tokens.radii.lg,
        boxShadow: tokens.shadows.md,
        padding: tokens.spacing.xl,
        border: `${tokens.borders.width} solid ${tokens.colors.divider}`,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.md,
        width: "100%",
        ...props.style,
      }}
    >
      {(title || description || actions) && (
        <header style={{ display: "flex", justifyContent: "space-between", gap: tokens.spacing.md, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xs }}>
            {title && (
              <h3
                style={{
                  margin: 0,
                  color: tokens.colors.neutralText,
                  font: tokens.typography.heading,
                  fontFamily: tokens.typography.fontFamily,
                }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p
                style={{
                  margin: 0,
                  color: tokens.colors.mutedText,
                  font: tokens.typography.body,
                  fontFamily: tokens.typography.fontFamily,
                }}
              >
                {description}
              </p>
            )}
          </div>
          {actions && <div style={{ display: "flex", gap: tokens.spacing.sm }}>{actions}</div>}
        </header>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.sm }}>{children}</div>
    </section>
  );
}
