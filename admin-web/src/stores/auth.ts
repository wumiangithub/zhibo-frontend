import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { fetchMe, type AuthUser } from "@/api/auth";
import {
  clearSession,
  getAccessToken,
  getAuthUser,
  setSession,
} from "@/utils/authSession";
import { onAccessTokenUpdated } from "@/utils/authRefresh";

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(getAccessToken());
  const user = ref<AuthUser | null>(getAuthUser());

  const isLoggedIn = computed(() => Boolean(accessToken.value));
  const displayName = computed(
    () => user.value?.userName || user.value?.userAccount || "管理员",
  );

  onAccessTokenUpdated((token) => {
    accessToken.value = token;
  });

  function applySession(
    token: string,
    nextUser: AuthUser | null,
    options?: { persist?: boolean; refreshToken?: string | null },
  ) {
    setSession(token, nextUser, options);
    accessToken.value = token;
    user.value = nextUser;
  }

  /** 默认只清会话（须重新登录）；记住账号密文仅取消勾选时清 */
  function logout(options?: { clearRemember?: boolean }) {
    clearSession({ clearRemember: options?.clearRemember ?? false });
    accessToken.value = null;
    user.value = null;
  }

  async function refreshMe() {
    if (!accessToken.value) return null;
    const me = await fetchMe();
    user.value = me;
    // 不传 persist / refreshToken：沿用当前 storage 与 refresh
    setSession(accessToken.value, me);
    return me;
  }

  return {
    accessToken,
    user,
    isLoggedIn,
    displayName,
    applySession,
    logout,
    refreshMe,
  };
});
