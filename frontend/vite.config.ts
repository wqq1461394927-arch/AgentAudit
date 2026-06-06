import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 3000,
        proxyTimeout: 3000,
      },
      '/api/v1': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        timeout: 3000,
        proxyTimeout: 3000,
      },
    },
  },
});
