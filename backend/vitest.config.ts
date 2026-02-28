import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/accounts.ts',
        'src/lib/modelConfig.ts',
        'src/lib/modelMetrics.ts',
        'src/lib/modelTasks.ts',
        'src/lib/riskControl.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 45
      }
    }
  }
});
