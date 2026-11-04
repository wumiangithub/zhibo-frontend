import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { fileURLToPath, URL } from "node:url";

function listenPort(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  return fallback;
}

/** 同机为 /api 或 /live-client；写成域名时浏览器直连，开发代理仍用 /api。 */
function apiProxyPrefix(raw: string | undefined): string {
  const base = (raw ?? "").trim().replace(/\/+$/, "");
  if (!base || base === "/" || /^https?:\/\//i.test(base)) return "/api";
  return base.startsWith("/") ? base : `/${base}`;
}

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd());
  const fileEnv = loadEnv(mode, process.cwd(), "");
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
      port: listenPort(fileEnv.LIVE_WEB_PORT, 5174),
      proxy: {
        // 观看 / 进出 / 中控台名单一律 live-service
        [apiProxyPrefix(viteEnv.VITE_APP_BASE_API)]: {
          target: `http://127.0.0.1:${listenPort(fileEnv.LIVE_SERVER_PORT, 8082)}`,
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
