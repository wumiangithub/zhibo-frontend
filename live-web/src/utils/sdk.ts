/** 微吼 JSSDK 的错误码与文案对照（见 opendocs 全局事件） */
const SDK_ERROR_MAP: Record<number, string> = {
  20001: "房间不存在",
  20002: "房间未开始",
  20003: "房间已结束",
  20004: "房间已关闭",
  20005: "活动不存在或已结束",
  20006: "签名验证失败",
  20007: "参数错误",
};

/** SDK 的 error 事件既可能给 JSON 字符串也可能给对象，统一成可展示文案 */
export function formatSdkError(msg: unknown): string {
  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { type?: number; msg?: string };
      if (parsed.type && SDK_ERROR_MAP[parsed.type]) return SDK_ERROR_MAP[parsed.type];
      return parsed.msg || msg;
    } catch {
      return msg;
    }
  }
  if (msg && typeof msg === "object") {
    const obj = msg as { type?: number; msg?: string };
    if (obj.type && SDK_ERROR_MAP[obj.type]) return SDK_ERROR_MAP[obj.type];
    if (obj.msg) return obj.msg;
  }
  if (msg != null) {
    return JSON.stringify(msg);
  }
  return "SDK 错误";
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(el);
  });
}
