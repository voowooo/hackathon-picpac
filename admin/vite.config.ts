import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API = process.env.PICPAC_API ?? "http://localhost:4000";

// Сборка раздаётся сервером по /admin/; в разработке Vite проксирует /api на сервер.
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": API } },
});
