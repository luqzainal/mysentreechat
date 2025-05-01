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
})
