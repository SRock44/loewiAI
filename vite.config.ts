import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://www.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.google.com https://www.googleapis.com https://accounts.google.com https://www.gstatic.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.googleapis.com wss://firestore.googleapis.com; frame-src 'self' https://accounts.google.com https://apis.google.com https://*.firebaseapp.com; font-src 'self' data:;"
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', 'pdfjs-dist', 'prismjs', 'framer-motion'],
    exclude: ['prismjs/components'] // Let Prism.js language components load dynamically
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Ensure React and React-DOM are always together and loaded first
          if (id.includes('node_modules')) {
            // React must be in the same chunk to avoid undefined errors
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('pdfjs-dist')) {
              return 'pdfjs';
            }
            if (id.includes('@google/generative-ai') || id.includes('firebase')) {
              return 'ai-services';
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('prismjs')) {
              // Keep Prism.js components together to avoid issues
              return 'prism';
            }
            // Group document parsers with other utilities to avoid circular deps
            if (id.includes('mammoth') || id.includes('pptx-parser') || id.includes('katex')) {
              return 'utils';
            }
            // Other node_modules
            return 'vendor';
          }
        },
        // Optimize chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
