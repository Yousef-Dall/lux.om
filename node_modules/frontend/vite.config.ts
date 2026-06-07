import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: true,
      proxy: {
        '/auth': apiUrl,
        '/uploads': apiUrl,
        '/health': apiUrl
      }
    },
    preview: {
      port: 4173,
      host: '0.0.0.0'
    },
    build: {
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react')) return 'react';
            if (id.includes('node_modules/react-dom')) return 'react';
            if (id.includes('node_modules/react-router-dom')) return 'react';
            if (id.includes('node_modules/lucide-react')) return 'icons';

            return undefined;
          }
        }
      }
    }
  };
});