import { defineConfig } from 'vitest/config';

// Standalone config so test runs don't execute the extension-files build plugin from vite.config.js
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js']
  }
});
