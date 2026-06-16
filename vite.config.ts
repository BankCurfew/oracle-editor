import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:3080",
      "/ws": {
        target: "ws://localhost:3080",
        ws: true,
      },
    },
  },
});
