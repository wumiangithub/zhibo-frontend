/**
 * 微信网站应用扫码：自拼 qrconnect + iframe。
 * redirect_uri 只经 URLSearchParams 编码一次。
 *
 * self_redirect 默认按环境自动：
 * - development（import.meta.env.DEV）：false → 顶层跳 callback，避开本地 PNA；
 *   后端 HTML 应 location.replace('/login?wx_done=1')，前端仅在该 query 下续轮询。
 * - 生产 / uat 构建：true → iframe 内回调 + 同页 1.5s 轮询（对齐 sys-comon）；
 *   后端应返回极简 OK HTML，不要 location.replace 到 login。
 * 可选 VITE_WECHAT_SELF_REDIRECT=true|false 显式覆盖（未设置则自动）。
 */

export type MountWxLoginResult = {
  iframe: HTMLIFrameElement;
  dispose: () => void;
  /** 本次挂载是否 iframe 内回调（true）或顶层跳转（false） */
  selfRedirect: boolean;
};

/** 是否 iframe 内 self_redirect（生产默认 true；本地 DEV 默认 false） */
export function resolveWechatSelfRedirect(): boolean {
  const raw = import.meta.env.VITE_WECHAT_SELF_REDIRECT;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  // 未配置：仅 Vite development 模式走顶层跳；uat/prod 构建恒为 true
  return !import.meta.env.DEV;
}

/** 拼开放平台扫码页 URL */
export function buildWechatQrConnectUrl(state: string): string {
  const appid = import.meta.env.VITE_WECHAT_APPID;
  const redirectUri = import.meta.env.VITE_WECHAT_REDIRECT_URI;
  if (!appid || !redirectUri) {
    throw new Error("未配置 VITE_WECHAT_APPID / VITE_WECHAT_REDIRECT_URI");
  }
  const selfRedirect = resolveWechatSelfRedirect();
  const inlineCss = encodeURIComponent(
    "html,body{width:100%;height:100%}body{display:flex;align-items:center;justify-content:center;margin:0}body>*{flex:0 0 auto}",
  );
  const params = new URLSearchParams({
    appid,
    scope: "snsapi_login",
    redirect_uri: redirectUri,
    response_type: "code",
    login_type: "jssdk",
    style: "black",
    self_redirect: selfRedirect ? "true" : "false",
    href: `data:text/css;charset=UTF-8,${inlineCss}`,
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}

/** 在容器内挂 iframe 展示扫码页 */
export function mountWxLogin(options: {
  containerId: string;
  state: string;
  /** iframe 二次 load（确认后跳转）时回调，用于切「等待中」态 */
  onLeaveWeixinDomain?: () => void;
}): MountWxLoginResult {
  const el = document.getElementById(options.containerId);
  if (!el) {
    throw new Error(`找不到扫码容器 #${options.containerId}`);
  }
  const selfRedirect = resolveWechatSelfRedirect();
  const src = buildWechatQrConnectUrl(options.state);
  el.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "微信扫码登录";
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.allow = "clipboard-write";
  iframe.style.width = "300px";
  iframe.style.height = "400px";
  iframe.style.border = "0";

  let firstLoadDone = false;
  const onLoad = () => {
    if (!firstLoadDone) {
      firstLoadDone = true;
      return;
    }
    // self_redirect=true 时：回调落在 iframe 内，二次 load 可切等待态（同页继续 poll）
    options.onLeaveWeixinDomain?.();
  };
  iframe.addEventListener("load", onLoad);
  el.appendChild(iframe);

  return {
    iframe,
    selfRedirect,
    dispose: () => {
      iframe.removeEventListener("load", onLoad);
    },
  };
}
