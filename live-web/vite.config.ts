import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd());
  const orderCenterTarget =
    viteEnv.VITE_ORDER_CENTER_BASE_URL || "http://oms-api.scqkxx.com";

  return {
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
        // 小黄车：观众端订单中心，开发态同源代理避免跨域
        "/order-center": {
          target: orderCenterTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
