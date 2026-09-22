/** 微吼 JSSDK 的错误码与文案对照（见 opendocs 全局事件） */
const SDK_ERROR_MAP: Record<number, string> = {
  20001: "房间不存在",
  20002: "房间未开始",
  20003: "房间已结束",
  20004: "房间已关闭",
  // Apifox 写「活动不存在或已结束」；联调里直播未结束也会偶发，常与请求失败/抖动重叠
  20005: "活动异常（微吼 20005，不一定是已结束）",
  20006: "签名验证失败",
  20007: "参数错误",
};

/** 基本可认定活动没了，不必空重试 */
const SDK_HARD_FATAL_CODES = new Set([20001, 20003, 20004, 20007]);

/** 可自动重拉签名再 init：20005 联调常为瞬时；20006 签名约 5 分钟过期 */
const SDK_RETRYABLE_CODES = new Set([20005, 20006]);

export function readSdkErrorType(msg: unknown): number | undefined {
  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { type?: number };
      return parsed.type;
    } catch {
      return undefined;
    }
  }
  if (msg && typeof msg === "object") {
    return (msg as { type?: number }).type;
  }
  return undefined;
}

/** SDK 的 error 事件既可能给 JSON 字符串也可能给对象，统一成可展示文案 */
export function formatSdkError(msg: unknown): string {
  const type = readSdkErrorType(msg);
  if (type && SDK_ERROR_MAP[type]) return SDK_ERROR_MAP[type];
  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { msg?: string };
      return parsed.msg || msg;
    } catch {
      return msg;
    }
  }
  if (msg && typeof msg === "object") {
    const obj = msg as { msg?: string };
    if (obj.msg) return obj.msg;
  }
  if (msg != null) {
    return JSON.stringify(msg);
  }
  return "SDK 错误";
}

/** 活动侧硬失败（别空转重试） */
export function isHardFatalSdkError(msg: unknown): boolean {
  const type = readSdkErrorType(msg);
  return type != null && SDK_HARD_FATAL_CODES.has(type);
}

/** 值得自动重拉 /sdk 再 init */
export function isRetryableSdkError(msg: unknown): boolean {
  const type = readSdkErrorType(msg);
  return type != null && SDK_RETRYABLE_CODES.has(type);
}

/** @deprecated 用 isHardFatalSdkError / isRetryableSdkError */
export function isFatalSdkError(msg: unknown): boolean {
  return isHardFatalSdkError(msg) || isRetryableSdkError(msg);
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
