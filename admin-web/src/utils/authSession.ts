import type { AuthUser } from "@/api/auth";
import {
  decryptRememberPassword,
  encryptRememberPassword,
} from "@/utils/passwordAes";

const TOKEN_KEY = "admin_access_token";
const REFRESH_KEY = "admin_refresh_token";
const USER_KEY = "admin_auth_user";
const REMEMBER_ACCOUNT_KEY = "admin_remember_account";
const REMEMBER_PASSWORD_KEY = "admin_remember_password_cipher";

function readStorageItem(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

/** 当前会话落在哪：有 local token 视为持久；否则 session（刷新保留、关浏览器丢） */
function resolvePersist(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  if (localStorage.getItem(TOKEN_KEY)) return true;
  if (sessionStorage.getItem(TOKEN_KEY)) return false;
  return true;
}

function writeSession(
  storage: Storage,
  token: string,
  user: AuthUser | null,
  refreshToken: string | null,
) {
  storage.setItem(TOKEN_KEY, token);
  if (refreshToken) {
    storage.setItem(REFRESH_KEY, refreshToken);
  } else {
    storage.removeItem(REFRESH_KEY);
  }
  if (user) {
    storage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(USER_KEY);
  }
}

function clearStorageSession(storage: Storage) {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(REFRESH_KEY);
  storage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return readStorageItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readStorageItem(REFRESH_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = readStorageItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * 写入会话。
 * - `persist: true`（勾选记住）→ localStorage，关浏览器仍登录
 * - `persist: false` → sessionStorage，关标签/浏览器需重登
 * - 省略 persist：保持当前所在 storage（如 refreshMe）
 * - `refreshToken`：传入则覆盖；省略则保留已有 refresh（换 storage 时一并迁移）
 */
export function setSession(
  token: string,
  user: AuthUser | null,
  options?: { persist?: boolean; refreshToken?: string | null },
) {
  const persist = resolvePersist(options?.persist);
  const primary = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  const nextRefresh =
    options && "refreshToken" in options
      ? (options.refreshToken ?? null)
      : getRefreshToken();
  clearStorageSession(other);
  writeSession(primary, token, user, nextRefresh);
}

/** 仅更新两张票（静默换票）；user / persist 不动 */
export function setTokens(accessToken: string, refreshToken: string) {
  const persist = resolvePersist();
  const primary = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  const user = getAuthUser();
  clearStorageSession(other);
  writeSession(primary, accessToken, user, refreshToken);
}

/** 清会话；默认保留「记住密码」密文（仅取消勾选时清） */
export function clearSession(options?: { clearRemember?: boolean }) {
  clearStorageSession(localStorage);
  clearStorageSession(sessionStorage);
  if (options?.clearRemember) {
    clearRememberedCredentials();
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}

export async function saveRememberedCredentials(
  userAccount: string,
  password: string,
) {
  const cipher = await encryptRememberPassword(password);
  localStorage.setItem(REMEMBER_ACCOUNT_KEY, userAccount);
  localStorage.setItem(REMEMBER_PASSWORD_KEY, cipher);
}

export function clearRememberedCredentials() {
  localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
  localStorage.removeItem(REMEMBER_PASSWORD_KEY);
}

export async function loadRememberedCredentials(): Promise<{
  userAccount: string;
  password: string;
} | null> {
  const userAccount = localStorage.getItem(REMEMBER_ACCOUNT_KEY);
  const cipher = localStorage.getItem(REMEMBER_PASSWORD_KEY);
  if (!userAccount || !cipher) return null;
  try {
    const password = await decryptRememberPassword(cipher);
    return { userAccount, password };
  } catch {
    clearRememberedCredentials();
    return null;
  }
}

export function hasRememberedAccount(): boolean {
  return Boolean(localStorage.getItem(REMEMBER_ACCOUNT_KEY));
}
