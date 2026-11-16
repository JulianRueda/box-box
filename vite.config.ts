import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // En GitHub Pages el juego vive en /box-box/. El resto de usos (dev, preview, tests) sirve desde la raíz.
  base: process.env.GITHUB_PAGES ? '/box-box/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 60_000,
    environment: 'node',
  },
});
