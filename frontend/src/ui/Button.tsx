import { useMemo } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { tokens } from "./tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const cssVar = (name: string, fallback: string) => `var(${name}, ${fallback})`;
const px = (value: number) => `${value}px`;

export function Button({
  label,
  variant = "primary",
  size = "md",
  fullWidth,
  isLoading,
  disabled,
  startIcon,
  endIcon,
  ...props
}: ButtonProps) {
  const palette = useMemo(() => {
    const map = {
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      ghost: tokens.colors.ghost,
      danger: tokens.colors.danger,
    } as const;
    return map[variant];
  }, [variant]);

  const sizeStyles: Record<ButtonSize, { padding: string; fontSize: string; height: string }> = {
    sm: { padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`, fontSize: "14px", height: px(40) },
    md: { padding: `${tokens.spacing.sm} ${tokens.spacing.md}`, fontSize: "15px", height: px(44) },
    lg: { padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, fontSize: "16px", height: px(48) },
  };

  const isDisabled = disabled || isLoading;
  const tone = (toneName: keyof typeof palette) => cssVar(`--finfy-colors-${variant}-${toneName}`, palette[toneName]);

  const spinner = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 50 50"
      aria-hidden
      focusable={false}
      style={{ display: "block" }}
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={tone("text")}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="31.4 188.4"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );

  return (
    <button
      type="button"
      {...props}
      aria-busy={isLoading || undefined}
      disabled={isDisabled}
      style={{
        alignItems: "center",
        backgroundColor: tone("base"),
        border: `${tokens.borders.width} solid ${tone("border")}`,
        borderRadius: cssVar("--finfy-radii-md", tokens.radii.md),
        boxShadow: cssVar("--finfy-shadows-sm", tokens.shadows.sm),
        color: tone("text"),
        cursor: isDisabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        filter: isDisabled ? "grayscale(0.15)" : undefined,
        gap: tokens.spacing.xs,
        justifyContent: "center",
        font: tokens.typography.label,
        fontSize: sizeStyles[size].fontSize,
        fontFamily: cssVar("--finfy-typography-fontFamily", tokens.typography.fontFamily),
        letterSpacing: "0.01em",
        lineHeight: 1.2,
        minWidth: fullWidth ? "100%" : undefined,
        padding: sizeStyles[size].padding,
        height: sizeStyles[size].height,
        position: "relative",
        textDecoration: "none",
        transition: `background-color ${tokens.motion.transitionFast}, box-shadow ${tokens.motion.transitionFast}, transform ${tokens.motion.transitionFast}`,
        width: fullWidth ? "100%" : undefined,
        opacity: isDisabled ? 0.8 : 1,
      }}
      onFocus={(event) => {
        props.onFocus?.(event);
        event.currentTarget.style.boxShadow = `${cssVar("--finfy-shadows-focus", tokens.shadows.focus)}, 0 0 0 ${
          tokens.borders.focusGap
        } ${cssVar("--finfy-colors-surface", tokens.colors.surface)}`;
      }}
      onBlur={(event) => {
        props.onBlur?.(event);
        event.currentTarget.style.boxShadow = cssVar("--finfy-shadows-sm", tokens.shadows.sm);
      }}
      onMouseDown={(event) => {
        props.onMouseDown?.(event);
        if (!isDisabled) {
          event.currentTarget.style.transform = "translateY(1px)";
        }
      }}
      onMouseUp={(event) => {
        props.onMouseUp?.(event);
        event.currentTarget.style.transform = "translateY(0)";
      }}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        if (!isDisabled) {
          event.currentTarget.style.backgroundColor = tone("hover");
        }
      }}
      onMouseLeave={(event) => {
        props.onMouseLeave?.(event);
        event.currentTarget.style.backgroundColor = tone("base");
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {isLoading ? spinner : startIcon}
      <span style={{ pointerEvents: "none" }}>{label}</span>
      {endIcon && !isLoading ? endIcon : <span style={{ width: px(16) }} aria-hidden />}
    </button>
  );
}
