import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localApi } from './server/local-api.mjs';

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
}));
