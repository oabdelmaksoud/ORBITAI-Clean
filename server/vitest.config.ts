import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./src/__tests__/setup/globalSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/index.ts',
        '**/types.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
    include: ['**/*.test.ts', '**/*.spec.ts'],
    testTimeout: 15000,
    // Run test files sequentially to prevent shared MongoDB data conflicts
    // (parallel files can wipe each other's test data via deleteMany)
    fileParallelism: false,
    server: {
      deps: {
        // Externalize packages that may not be installed but are dynamically imported
        external: ['@trycua/agent'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub @trycua/agent since the package dist is not built
      '@trycua/agent': path.resolve(__dirname, './src/__mocks__/@trycua/agent.ts'),
    },
  },
});
