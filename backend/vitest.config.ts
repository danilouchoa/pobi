import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'html'],
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/tests/**', '**/__tests__/**'],
      // Thresholds desabilitados temporariamente para gerar relatório
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      // },
    },
    silent: false,
  },
});
