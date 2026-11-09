import { get, post } from "./http";
import { getViewerAccessToken } from "@/utils/viewerAuth";

export interface ViewerAuthUser {
  id: number;
  hasPhone?: boolean;
  phoneMasked?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarObjectKey?: string;
}

export interface ViewerAuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: ViewerAuthUser;
}

/**
 * 仅后端 spring profile=`local`：明文手机号登录 / 自动注册。
 * test/prod 业务 404。
 */
export function devPhoneLogin(phone: string) {
  return post<ViewerAuthSession>("/viewer/auth/dev-phone-login", {
    phone,
    agreed: true,
  });
}

/** 当前观众。成功 data 即 user。 */
export function getViewerUserInfo() {
  const token = getViewerAccessToken();
  return get<ViewerAuthUser>("/viewer/auth/user-info", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** 双票刷新；过期 access 也要原样带上（白名单，不靠 Authorization）。 */
export function refreshViewerSession(accessToken: string, refreshToken: string) {
  return post<ViewerAuthSession>(
    "/viewer/auth/refresh",
    {
      accessToken: accessToken || "",
      refreshToken,
    },
    { skipAuthRefresh: true },
  );
}
