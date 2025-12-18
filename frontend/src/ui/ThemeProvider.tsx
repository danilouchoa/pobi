import { useEffect } from "react";
import type { ReactNode } from "react";
import { applyTokensToRoot, tokens, type TokenDefinition } from "./tokens";

export type ThemeProviderProps = {
  children: ReactNode;
  tokenOverrides?: TokenDefinition;
  target?: HTMLElement | null;
};

export function TokenProvider({ children, tokenOverrides, target }: ThemeProviderProps) {
  useEffect(() => {
    applyTokensToRoot(tokenOverrides ?? tokens, target ?? document.documentElement);
  }, [tokenOverrides, target]);

  return <>{children}</>;
}
