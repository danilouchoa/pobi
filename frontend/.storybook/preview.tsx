/**
 * Storybook Preview Configuration
 * 
 * Configura decorators globais e parâmetros para todas as stories.
 * Inclui ThemeProvider do MUI para garantir consistência visual.
 */

import type { Preview } from "@storybook/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { TokenProvider } from "../src/ui/ThemeProvider";
import theme from "../src/theme";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#f4f6fb",
        },
        {
          name: "dark",
          value: "#0f172a",
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <TokenProvider>
          <CssBaseline />
          <div style={{ padding: "2rem", minHeight: "100vh", background: "var(--finfy-colors-background)" }}>
            <Story />
          </div>
        </TokenProvider>
      </ThemeProvider>
    ),
  ],
};

export default preview;
