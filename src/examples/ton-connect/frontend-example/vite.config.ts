import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Use port 3001 to avoid conflict with backend on 3000
    open: true,
  },
  resolve: {
    alias: {
      // Add path aliases for better imports
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // Add Buffer for TON libraries
    global: {},
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
  },
});
