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

/** 主持/嘉宾/助理已在开播侧时，微吼拒绝再以观看身份进房 */
const WATCH_ROLE_CONFLICT_RE = /主持|嘉宾|助理/;
const WATCH_ROLE_CONFLICT_VIEW_RE = /观看/;

type SdkErrorPayload = { type?: number; data?: unknown; msg?: unknown };

function parseSdkErrorPayload(msg: unknown): SdkErrorPayload | null {
  if (typeof msg === "string") {
    try {
      return JSON.parse(msg) as SdkErrorPayload;
    } catch {
      return null;
    }
  }
  if (msg && typeof msg === "object") {
    return msg as SdkErrorPayload;
  }
  return null;
}

export function readSdkErrorType(msg: unknown): number | undefined {
  const payload = parseSdkErrorPayload(msg);
  if (payload?.type != null) return payload.type;
  return undefined;
}

/** SDK error 的 data 字段（角色冲突等具体说明常在此，不在 msg） */
export function readSdkErrorData(msg: unknown): string | undefined {
  const payload = parseSdkErrorPayload(msg);
  if (typeof payload?.data === "string" && payload.data.trim()) {
    return payload.data.trim();
  }
  if (typeof msg === "string" && !payload) {
    return msg.trim() || undefined;
  }
  return undefined;
}

function looksLikeWatchRoleConflictText(text: string): boolean {
  return WATCH_ROLE_CONFLICT_RE.test(text) && WATCH_ROLE_CONFLICT_VIEW_RE.test(text);
}

/** 当前账号已是主持/嘉宾/助理，微吼拒绝进入观看端（常见于 20005 + data） */
export function isWatchRoleConflictSdkError(msg: unknown): boolean {
  const data = readSdkErrorData(msg);
  if (data && looksLikeWatchRoleConflictText(data)) return true;
  const payload = parseSdkErrorPayload(msg);
  if (typeof payload?.msg === "string" && looksLikeWatchRoleConflictText(payload.msg)) {
    return true;
  }
  return false;
}

export function isWatchRoleConflictReason(reason: string): boolean {
  return looksLikeWatchRoleConflictText(reason);
}

/** 播放失败遮罩副文案：按原因区分，勿一律说成 20005 抖动 */
export function mediaFailHint(failReason: string): string {
  if (isWatchRoleConflictReason(failReason)) {
    return "当前账号已在直播间担任主持/嘉宾/助理，微吼不允许再以观众身份进入。请结束开播侧角色，或换用观众账号后再进；刷新通常无法绕过。";
  }
  if (failReason.includes("长时间未就绪")) {
    return "播放器未在预期时间内就绪，可点刷新重试。若直播确实在播仍失败，请检查网络或稍后再试。";
  }
  return "可点刷新重试；若仍失败，请检查网络或稍后再试。";
}

/** SDK 的 error 事件既可能给 JSON 字符串也可能给对象，统一成可展示文案 */
export function formatSdkError(msg: unknown): string {
  if (isWatchRoleConflictSdkError(msg)) {
    return readSdkErrorData(msg) || "主持人、嘉宾或助理直播时不能进入观看端";
  }
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

/** 活动侧硬失败（别空转重试）；含角色冲突 */
export function isHardFatalSdkError(msg: unknown): boolean {
  if (isWatchRoleConflictSdkError(msg)) return true;
  const type = readSdkErrorType(msg);
  return type != null && SDK_HARD_FATAL_CODES.has(type);
}

/** 值得自动重拉 /sdk 再 init（角色冲突除外） */
export function isRetryableSdkError(msg: unknown): boolean {
  if (isWatchRoleConflictSdkError(msg)) return false;
  const type = readSdkErrorType(msg);
  return type != null && SDK_RETRYABLE_CODES.has(type);
}

/** @deprecated 用 isHardFatalSdkError / isRetryableSdkError */
export function isFatalSdkError(msg: unknown): boolean {
  return isHardFatalSdkError(msg) || isRetryableSdkError(msg);
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      // 我们标过 loaded → 已完成；标过 loading → 尚在飞，必须等，否则会 new 时找不到 VhallSDK
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      if (existing.dataset.loading === "1") {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error(`脚本加载失败: ${src}`)),
          { once: true },
        );
        return;
      }
      // 无标记：多为已完成的历史节点（或非本函数插入），不能再等 load（永不触发）
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.dataset.loading = "1";
    el.onload = () => {
      delete el.dataset.loading;
      el.dataset.loaded = "1";
      resolve();
    };
    el.onerror = () => {
      delete el.dataset.loading;
      reject(new Error(`脚本加载失败: ${src}`));
    };
    document.head.appendChild(el);
  });
}
