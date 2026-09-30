import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any path: GitHub Pages sub-path,
// the assembled suite (/phrase-board/), or a local file server.
export default defineConfig({
  base: './',
  plugins: [react()],
});
