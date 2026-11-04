/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_BASE_API: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_TOS_NATIVE_URL: string;
  readonly VITE_APP_TOS_CDN_URL: string;
  /** 微信开放平台网站应用 AppID；仅从 env 读取，勿硬编码 */
  readonly VITE_WECHAT_APPID: string;
  /**
   * 微信扫码 redirect_uri（完整 URL，含 path）。
   * 仅从此变量拼 qrconnect；各环境可不同；预发/生产常共用开放平台回调域，由 nginx 转发。
   */
  readonly VITE_WECHAT_REDIRECT_URI: string;
  /**
   * 可选显式覆盖微信 self_redirect。
   * 未设时：import.meta.env.DEV → false（顶层跳）；test/uat/production 构建 → true（iframe）。
   */
  readonly VITE_WECHAT_SELF_REDIRECT?: string;
  readonly VITE_AUTH_PASSWORD_AES_KEY_BASE64: string;
  /** 订单中心根地址；开发态作 Vite 代理 target，构建态作请求前缀 */
  readonly VITE_ORDER_CENTER_BASE_URL?: string;
  /**
   * 观众端 live-web 根地址（含协议、主机、端口）。
   * 观看链接、课程链接、中控台都拼在它后面。未设时本地默认 http://localhost:5174。
   */
  readonly VITE_LIVE_WEB_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
