// vite.config.ts
// Vite configuration file for the Plex Poster Set Helper project. 

// This configuration sets up the development environment with React and Tailwind CSS, 
// defines the build output directory, and configures path aliases for easier imports.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  root: 'src',
  build: {
    outDir: '../src/dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
