import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/metrolinx/": {
        target: "https://api.openmetrolinx.com/OpenDataAPI/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metrolinx\//, ""),
      },
      "/api/ttc/": {
        target: "https://bustime.ttc.ca/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ttc\//, ""),
      },
      "/api/miway/": {
        target: "https://www.miapp.ca/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/miway\//, ""),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
