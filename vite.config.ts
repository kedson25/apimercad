import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''
      ),
      'process.env.ML_CLIENT_ID': JSON.stringify(
        process.env.ML_CLIENT_ID || env.ML_CLIENT_ID || ''
      ),
      'process.env.ML_CLIENT_SECRET': JSON.stringify(
        process.env.ML_CLIENT_SECRET || env.ML_CLIENT_SECRET || ''
      ),
      'process.env.ML_REDIRECT_URI': JSON.stringify(
        process.env.ML_REDIRECT_URI || env.ML_REDIRECT_URI || ''
      ),
      'process.env.ML_ACCESS_TOKEN': JSON.stringify(
        process.env.ML_ACCESS_TOKEN || env.ML_ACCESS_TOKEN || ''
      ),
      'process.env.ML_REFRESH_TOKEN': JSON.stringify(
        process.env.ML_REFRESH_TOKEN || env.ML_REFRESH_TOKEN || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
