import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // 与 admin-web 一致：同时听 IPv4，避免仅 ::1 时 127.0.0.1 打不开
    host: true,
    port: 5174,
    proxy: {
      // 观看 / 进出 / 中控台名单一律 live-service
      "/api": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
      },
    },
  },
});
