/** 与小程序 utils/auth.js 同键，便于 H5 登录或 web-view 注入共用。 */
const ACCESS_KEY = "viewerAccessToken";
const REFRESH_KEY = "viewerRefreshToken";
const VIEWER_ID_KEY = "viewerId";
const PHONE_KEY = "viewerPhoneMasked";
const NICK_KEY = "viewerNickname";
const AVATAR_KEY = "viewerAvatarUrl";

/** 观众 JWT；无则空串。 */
export function getViewerAccessToken(): string {
  try {
    return localStorage.getItem(ACCESS_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

/** 写入观众 access（小程序 web-view URL 注入后落本地）。 */
export function setViewerAccessToken(token: string): void {
  const t = token.trim();
  if (!t) return;
  try {
    localStorage.setItem(ACCESS_KEY, t);
  } catch {
    /* ignore */
  }
}

export function getViewerRefreshToken(): string {
  try {
    return localStorage.getItem(REFRESH_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function setViewerRefreshToken(token: string): void {
  const t = token.trim();
  if (!t) return;
  try {
    localStorage.setItem(REFRESH_KEY, t);
  } catch {
    /* ignore */
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

/** 写入观众数字 id（小程序 web-view URL `viewerId` 同步进 localStorage）。 */
export function setViewerId(viewerId: number): void {
  if (!Number.isInteger(viewerId) || viewerId <= 0) return;
  try {
    localStorage.setItem(VIEWER_ID_KEY, String(viewerId));
  } catch {
    /* ignore */
  }
}

/** 登录 / 刷新成功后写入本地会话（与小程序 saveSession 对齐）。 */
export function saveViewerSession(data: {
  accessToken?: string;
  refreshToken?: string;
  user?: { id?: number; phoneMasked?: string; nickname?: string } | null;
}): void {
  if (!data) return;
  if (data.accessToken) setViewerAccessToken(data.accessToken);
  if (data.refreshToken) setViewerRefreshToken(data.refreshToken);
  const user = data.user;
  if (!user || typeof user !== "object") return;
  if (user.id != null) {
    const id = Number(user.id);
    if (Number.isInteger(id) && id > 0) setViewerId(id);
  }
  if (Object.prototype.hasOwnProperty.call(user, "phoneMasked")) {
    try {
      const masked = user.phoneMasked?.trim();
      if (masked) localStorage.setItem(PHONE_KEY, masked);
      else localStorage.removeItem(PHONE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function queryParam(
  query: Record<string, unknown> | { [key: string]: unknown } | undefined,
  key: string,
): string {
  const fromQuery = query?.[key];
  if (fromQuery != null && fromQuery !== "") {
    const raw = Array.isArray(fromQuery) ? String(fromQuery[0] ?? "") : String(fromQuery);
    return raw.trim();
  }
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get(key)?.trim() || "";
  }
  return "";
}

/**
 * 从路由 query / location.search 读 `viewerId`（正整数）。
 * 小程序打开观看页时以此为准，优先于旧 localStorage。
 */
export function readViewerIdFromSearch(
  query?: Record<string, unknown> | { [key: string]: unknown },
): number | null {
  const raw = queryParam(query, "viewerId");
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 小程序 web-view 附带的展示昵称（已按通则算好）。 */
export function readNicknameFromSearch(
  query?: Record<string, unknown> | { [key: string]: unknown },
): string {
  return queryParam(query, "nickname");
}

/**
 * URL 有 `viewerId` 时写入 localStorage 并返回；否则退回已有 localStorage。
 * URL 是小程序身份来源，覆盖过期的本地 id。
 */
export function syncViewerIdFromUrl(
  query?: Record<string, unknown> | { [key: string]: unknown },
): number | null {
  const fromUrl = readViewerIdFromSearch(query);
  if (fromUrl != null) {
    setViewerId(fromUrl);
    return fromUrl;
  }
  return getViewerId();
}

/**
 * 小程序 web-view 须带 `viewerAccessToken`（观众 JWT），H5 写入 localStorage 后
 * 才能调需鉴权接口（如 `replay/start`）。读到后从地址栏去掉该参数，降低残留。
 * 兼容别名 `accessToken`。
 */
export function syncViewerAccessTokenFromUrl(
  query?: Record<string, unknown> | { [key: string]: unknown },
): string {
  const fromUrl =
    queryParam(query, "viewerAccessToken") || queryParam(query, "accessToken");
  if (fromUrl) {
    setViewerAccessToken(fromUrl);
    stripAccessTokenFromLocation();
    return fromUrl;
  }
  return getViewerAccessToken();
}

/** 是否应从路由转发中排除（避免 SPA 跳转把 JWT 再写进 query）。 */
export function isViewerAuthQueryKey(key: string): boolean {
  return key === "viewerAccessToken" || key === "accessToken";
}

function stripAccessTokenFromLocation(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    let dirty = false;
    for (const key of ["viewerAccessToken", "accessToken"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        dirty = true;
      }
    }
    if (!dirty) return;
    const next = url.pathname + (url.search || "") + url.hash;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* ignore */
  }
}

export function isViewerLoggedIn(): boolean {
  return !!getViewerAccessToken();
}

/** 上次登录记下的脱敏手机号；没有则空串。 */
export function getViewerPhoneMasked(): string {
  try {
    return localStorage.getItem(PHONE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

/** 绑定手机号页（本地样式）写入脱敏号。空串则清掉。 */
export function setViewerPhoneMasked(phoneMasked: string): void {
  try {
    const masked = phoneMasked.trim();
    if (masked) localStorage.setItem(PHONE_KEY, masked);
    else localStorage.removeItem(PHONE_KEY);
  } catch {
    /* ignore */
  }
}

/** 资料展示缓存。与观看页 `zhibo.nickname` 分开。 */
export function getViewerProfile(): { nickname: string; avatarUrl: string } {
  try {
    return {
      nickname: localStorage.getItem(NICK_KEY)?.trim() || "",
      avatarUrl: localStorage.getItem(AVATAR_KEY)?.trim() || "",
    };
  } catch {
    return { nickname: "", avatarUrl: "" };
  }
}

export function saveViewerProfile(data: {
  nickname?: string;
  avatarUrl?: string;
}): void {
  try {
    if (typeof data.nickname === "string") {
      localStorage.setItem(NICK_KEY, data.nickname);
    }
    if (typeof data.avatarUrl === "string" && data.avatarUrl) {
      localStorage.setItem(AVATAR_KEY, data.avatarUrl);
    }
  } catch {
    /* ignore */
  }
}

export function clearViewerProfile(): void {
  try {
    localStorage.removeItem(NICK_KEY);
    localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

/** 清本地观众会话（access / refresh / id / 脱敏手机号）。 */
export function clearViewerSession(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(VIEWER_ID_KEY);
    localStorage.removeItem(PHONE_KEY);
  } catch {
    /* ignore */
  }
}
