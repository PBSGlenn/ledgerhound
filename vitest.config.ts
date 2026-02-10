import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Run test files sequentially to avoid SQLite file locking conflicts
    fileParallelism: false,
    // Also run tests within a file sequentially
    sequence: {
      concurrent: false,
    },
    // Increase timeout for database operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Global setup creates the test database before all tests
    globalSetup: ['./src/lib/services/__test-utils__/globalSetup.ts'],
    // Exclude E2E tests (run via Playwright) and other non-unit test files
    exclude: [
      '**/node_modules/**',
      '**/e2e/**',
      '**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src-tauri/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/main.tsx',
        'src/App.tsx',
        '**/__tests__/**',
        '**/__test-utils__/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    setupFiles: ['./src/lib/services/__test-utils__/setup.ts'],
  },
});
