import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite' // Pastikan ini dibuang atau dikomen

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // tailwindcss(), // Pastikan ini dibuang atau dikomen
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '0.0.0.0'
  }
})
