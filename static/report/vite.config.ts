import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' is required: Forge serves Custom UI from a CDN sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'build', emptyOutDir: true, sourcemap: false },
  server: { fs: { allow: ['..', '../..'] } },
});
