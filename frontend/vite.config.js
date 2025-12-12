import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost', // Bind to all interfaces
    port: 5173,
  },
  base: '/', // For Vercel deployment
});