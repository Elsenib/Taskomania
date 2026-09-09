import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/renderer",
  // Packaged builds load index.html via file:// from inside an asar archive
  // (main.ts's win.loadFile), where Vite's default root-absolute "/assets/…"
  // URLs resolve to the filesystem root instead of the app bundle — relative
  // paths are required so they resolve against index.html's own directory.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
});
