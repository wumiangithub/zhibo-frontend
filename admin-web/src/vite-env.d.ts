/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_BASE_API: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_TOS_NATIVE_URL: string;
  readonly VITE_APP_TOS_CDN_URL: string;
  readonly VITE_WECHAT_APPID: string;
  readonly VITE_WECHAT_REDIRECT_URI: string;
  /**
   * 可选显式覆盖微信 self_redirect。
   * 未设时：import.meta.env.DEV → false（顶层跳）；uat/prod 构建 → true（iframe）。
   */
  readonly VITE_WECHAT_SELF_REDIRECT?: string;
  readonly VITE_AUTH_PASSWORD_AES_KEY_BASE64: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
