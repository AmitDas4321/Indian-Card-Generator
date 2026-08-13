import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.API_KEY || env.VITE_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY || '';
  const apiSecretKey = env.API_SECRET_KEY || env.VITE_API_SECRET_KEY || process.env.API_SECRET_KEY || process.env.VITE_API_SECRET_KEY || '';
  const verificationBaseUrl = env.VERIFICATION_BASE_URL || env.VITE_VERIFICATION_BASE_URL || process.env.VERIFICATION_BASE_URL || process.env.VITE_VERIFICATION_BASE_URL || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_API_SECRET_KEY': JSON.stringify(apiSecretKey),
      'import.meta.env.VITE_VERIFICATION_BASE_URL': JSON.stringify(verificationBaseUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
