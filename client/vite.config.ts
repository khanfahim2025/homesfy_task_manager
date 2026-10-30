import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `wrangler dev` (npm run dev -w server) serves the API on 8787.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false, ws: true } },
  },
});
