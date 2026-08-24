import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone config so test runs don't execute the extension-files build plugin from vite.config.js.
// The '@' alias mirrors vite.config.js: without it, importing a module that uses '@/...' fails on
// resolution, which is indistinguishable from the module failing for its own reasons.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src')
    }
  },
  test: {
    include: ['tests/**/*.test.js']
  }
});
