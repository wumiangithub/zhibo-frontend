/** 与小程序 utils/auth.js 同键，便于日后 H5 登录或 web-view 注入共用。 */
const ACCESS_KEY = "viewerAccessToken";
const VIEWER_ID_KEY = "viewerId";

/** 观众 JWT；无则空串。 */
export function getViewerAccessToken(): string {
  try {
    return localStorage.getItem(ACCESS_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function getViewerId(): number | null {
  try {
    const raw = localStorage.getItem(VIEWER_ID_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function isViewerLoggedIn(): boolean {
  return !!getViewerAccessToken();
}
