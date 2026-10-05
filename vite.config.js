import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React app built with Vite. The 3D logo files in public/ are copied as they are.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/three") ? "three" : id.includes("node_modules") ? "react" : id.endsWith("/src/data.js") ? "data" : undefined) } }
  },
  server: { port: 5173 }
});
