import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { fileURLToPath, URL } from "node:url";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd())
  const {
    VITE_APP_TOS_NATIVE_URL,
    VITE_APP_TOS_CDN_URL,
    VITE_ORDER_CENTER_BASE_URL,
  } = viteEnv
  const orderCenterTarget =
    VITE_ORDER_CENTER_BASE_URL || "http://fadada-notify.scqkxx.com"
  return {
    plugins: [
      vue(),
      UnoCSS(),
      AutoImport({
        resolvers: [ElementPlusResolver({ importStyle: false })],
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: false })],
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // 微信网站应用 redirect_uri 不宜带 :5173；本地用 80 使
      // http://wx.qktz.com.cn/api/v1/auth/wechat/callback 无端口（需管理员权限绑 80）
      host: true,
      port: 80,
      strictPort: true,
      allowedHosts: ["wx.qktz.com.cn", "localhost"],
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8081",
          changeOrigin: true,
        },
        // 仅代理 /tos/... 上传请求；勿匹配 /tos.umd.production.min.js（public 静态 SDK）
        "/tos/": {
          target: VITE_APP_TOS_NATIVE_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/tos/, ""),
        },
        // downloadFile / fileInfo 开发态把 CDN 换成 /cdn-media，避免直连跨域
        "/cdn-media": {
          target: VITE_APP_TOS_CDN_URL || VITE_APP_TOS_NATIVE_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/cdn-media/, ""),
        },
        // 新建页商品列表：开发态走同源 /order-center，避免直连跨域
        "/order-center": {
          target: orderCenterTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
