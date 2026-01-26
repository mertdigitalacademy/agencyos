/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'external'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['components/**/*.tsx', 'services/**/*.ts'],
      exclude: ['**/*.d.ts', '**/types.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@components': resolve(__dirname, './components'),
      '@services': resolve(__dirname, './services'),
    },
  },
});
