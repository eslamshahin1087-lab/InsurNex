import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  build: {
    // Firebase + Firestore + Recharts are naturally large
    // 800 KB is reasonable for a rich SPA
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // Firebase — split each product into its own chunk
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) {
            return 'firebase-storage';
          }
          if (id.includes('@firebase/app-check') || id.includes('firebase/app-check')) {
            return 'firebase-appcheck';
          }
          if (id.includes('@firebase/') || id.includes('firebase/')) {
            return 'firebase-core';
          }

          // Charts (Recharts + d3)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }

          // PDF — lazy loaded, isolated
          if (
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('canvg') ||
            id.includes('dompurify')
          ) {
            return 'pdf';
          }

          // Supabase
          if (id.includes('@supabase')) {
            return 'supabase';
          }

          // Icons
          if (id.includes('lucide-react')) {
            return 'icons';
          }

          // React ecosystem
          if (
            id.includes('react-router') ||
            id.includes('@remix-run')
          ) {
            return 'router';
          }
          if (id.includes('react-dom')) {
            return 'react-dom';
          }
          if (id.includes('node_modules/react/') || id.includes('scheduler')) {
            return 'react';
          }

          // Radix UI
          if (id.includes('@radix-ui')) {
            return 'radix';
          }

          // Let Rollup decide for everything else
          return undefined;
        },
      },
    },
  },

  server: {
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/DashboardPage.tsx',
      ],
    },
  },
});