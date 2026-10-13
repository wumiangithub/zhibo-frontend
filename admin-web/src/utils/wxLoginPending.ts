/** 微信扫码：顶层跳转 callback 后再回 /login 时，靠 sessionStorage 续轮询 */

const KEY = "admin_wx_login_pending";

export type WxLoginPending = {
  state: string;
  /** epoch ms */
  expiresAt: number;
};

export function saveWxLoginPending(state: string, expiresInSec: number) {
  const payload: WxLoginPending = {
    state,
    expiresAt: Date.now() + Math.max(30, expiresInSec) * 1000,
  };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadWxLoginPending(): WxLoginPending | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as WxLoginPending;
    if (!data?.state || typeof data.expiresAt !== "number") {
      clearWxLoginPending();
      return null;
    }
    if (Date.now() >= data.expiresAt) {
      clearWxLoginPending();
      return null;
    }
    return data;
  } catch {
    clearWxLoginPending();
    return null;
  }
}

export function clearWxLoginPending() {
  sessionStorage.removeItem(KEY);
}

export function remainingExpiresInSec(pending: WxLoginPending): number {
  return Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1000));
}
