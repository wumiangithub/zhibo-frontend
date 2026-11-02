import { post } from "./http";

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
