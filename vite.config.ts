import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Explicitly define environment variables for Cloudflare Pages
  define: {
    'import.meta.env.VITE_CONVEX_URL': JSON.stringify(process.env.VITE_CONVEX_URL || ''),
  },
  build: {
    // ... keep existing code
    sourcemap: false,
    rollupOptions: {
      // ... keep existing code
    },
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    minify: 'esbuild',
  },
  optimizeDeps: {
    // ... keep existing code
  },
  server: {
    hmr: true,
  },
});
