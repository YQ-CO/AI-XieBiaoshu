import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/api/**/*.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 45
      }
    }
  }
});