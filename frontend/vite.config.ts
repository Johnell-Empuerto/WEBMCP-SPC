import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "favicon-fix",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/favicon.ico") {
            req.url = "/favicon.png";
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // expressjs API

      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },

      // FastAPI (Laya) — strip the /laya-api prefix: /laya-api/chat -> /chat

      "/laya-api": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/laya-api/, ""),
      },
    },
  },
});
