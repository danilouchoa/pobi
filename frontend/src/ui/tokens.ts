export type TokenScale<T extends string, V = string | number> = Record<T, V>;

export type SemanticColor = {
  base: string;
  text: string;
  hover: string;
  muted: string;
  border: string;
};

export type AlertColors = {
  background: string;
  border: string;
  text: string;
  icon: string;
};

export type TokenDefinition = {
  colors: {
    background: string;
    surface: string;
    elevatedSurface: string;
    overlay: string;
    primary: SemanticColor;
    secondary: SemanticColor;
    ghost: SemanticColor;
    danger: SemanticColor;
    success: AlertColors;
    info: AlertColors;
    warning: AlertColors;
    error: AlertColors;
    neutralText: string;
    mutedText: string;
    divider: string;
    focus: string;
    disabled: {
      text: string;
      surface: string;
      border: string;
    };
  };
  radii: TokenScale<"xs" | "sm" | "md" | "lg" | "xl" | "pill">;
  spacing: TokenScale<"xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl">;
  typography: {
    fontFamily: string;
    heading: string;
    subheading: string;
    body: string;
    label: string;
    helper: string;
    code: string;
  };
  shadows: TokenScale<"sm" | "md" | "lg" | "focus">;
  borders: {
    width: string;
    focusWidth: string;
    focusGap: string;
  };
  motion: {
    transitionFast: string;
    transitionBase: string;
  };
};

const px = (value: number) => `${value}px`;

export const tokens: TokenDefinition = {
  colors: {
    background: "#f4f6fb",
    surface: "#ffffff",
    elevatedSurface: "#f9fbff",
    overlay: "rgba(15, 23, 42, 0.4)",
    primary: {
      base: "#2563eb",
      text: "#ffffff",
      hover: "#1d4ed8",
      muted: "#e0e7ff",
      border: "#1d4ed8",
    },
    secondary: {
      base: "#0f172a",
      text: "#ffffff",
      hover: "#0b1221",
      muted: "#e2e8f0",
      border: "#1f2937",
    },
    ghost: {
      base: "transparent",
      text: "#0f172a",
      hover: "#eef2ff",
      muted: "#e5e7eb",
      border: "#cbd5e1",
    },
    danger: {
      base: "#d92d20",
      text: "#ffffff",
      hover: "#b42318",
      muted: "#fef3f2",
      border: "#b42318",
    },
    success: {
      background: "#ecfdf3",
      border: "#12b76a",
      text: "#027a48",
      icon: "#12b76a",
    },
    info: {
      background: "#eef2ff",
      border: "#6366f1",
      text: "#312e81",
      icon: "#4f46e5",
    },
    warning: {
      background: "#fffbeb",
      border: "#f59e0b",
      text: "#92400e",
      icon: "#d97706",
    },
    error: {
      background: "#fef3f2",
      border: "#d92d20",
      text: "#7f1d1d",
      icon: "#d92d20",
    },
    neutralText: "#0f172a",
    mutedText: "#475569",
    divider: "#e2e8f0",
    focus: "#a855f7",
    disabled: {
      text: "#94a3b8",
      surface: "#f1f5f9",
      border: "#e2e8f0",
    },
  },
  radii: {
    xs: px(4),
    sm: px(8),
    md: px(12),
    lg: px(16),
    xl: px(20),
    pill: px(999),
  },
  spacing: {
    xxs: px(4),
    xs: px(8),
    sm: px(12),
    md: px(16),
    lg: px(20),
    xl: px(28),
    xxl: px(36),
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "700 24px/1.3",
    subheading: "600 18px/1.4",
    body: "400 15px/1.5",
    label: "600 14px/1.4",
    helper: "500 13px/1.5",
    code: "600 13px/1.4",
  },
  shadows: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
    md: "0 8px 24px rgba(15, 23, 42, 0.08)",
    lg: "0 18px 45px rgba(15, 23, 42, 0.12)",
    focus: `0 0 0 ${px(2)} rgba(168, 85, 247, 0.35)`,
  },
  borders: {
    width: px(1.5),
    focusWidth: px(3),
    focusGap: px(2),
  },
  motion: {
    transitionFast: "150ms ease-out",
    transitionBase: "200ms ease",
  },
};

const flattened = (prefix: string, obj: Record<string, unknown>) => {
  return Object.entries(obj).flatMap(([key, value]) => {
    const variable = `${prefix}-${key}`;
    if (typeof value === "object" && value !== null) {
      return flattened(variable, value as Record<string, unknown>);
    }
    return [[variable, String(value)]] as [string, string][];
  });
};

export function tokensToCssVars(tokenSet: TokenDefinition = tokens) {
  return flattened("--finfy", tokenSet).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

export function applyTokensToRoot(tokenSet: TokenDefinition = tokens, root: HTMLElement = document.documentElement) {
  const variables = tokensToCssVars(tokenSet);
  Object.entries(variables).forEach(([variable, value]) => {
    root.style.setProperty(variable, value);
  });
}
