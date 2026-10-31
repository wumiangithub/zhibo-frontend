import { ref } from "vue";
import {
  getWatchAccess,
  verifyWatchPassword,
  type WatchAccessState,
} from "@/api/watchAccess";
import { setActivityAccessToken } from "@/utils/activityAccess";
import { navigateToViewerLogin } from "@/utils/miniProgram";

/**
 * 观看页 / 回放页共用：先查 access，再决定弹密码、跳登录或拦截。
 */
export function useWatchAccessGate(activityId: () => string) {
  const checking = ref(true);
  const accessState = ref<WatchAccessState | "">("");
  const passwordOpen = ref(false);
  const passwordSubmitting = ref(false);
  const passwordError = ref("");
  const blockedTitle = ref("");
  const blockedMessage = ref("");

  function resetBlocked() {
    blockedTitle.value = "";
    blockedMessage.value = "";
  }

  function applyBlocked(state: WatchAccessState) {
    passwordOpen.value = false;
    if (state === "forbidden") {
      blockedTitle.value = "无观看权限";
      blockedMessage.value = "您不在本场指定用户名单中，或观看权限已取消";
      return;
    }
    if (state === "expired") {
      blockedTitle.value = "访问已过期";
      blockedMessage.value = "本场观看有效期已结束，无法继续观看直播或回放";
      return;
    }
    resetBlocked();
  }

  /**
   * @returns true 已放行，可继续拉 sdk / records
   */
  async function ensureAccess(): Promise<boolean> {
    checking.value = true;
    passwordError.value = "";
    resetBlocked();
    passwordOpen.value = false;
    accessState.value = "";
    try {
      const id = activityId();
      const res = await getWatchAccess(id);
      accessState.value = res.accessState;
      if (res.accessState === "ok") {
        return true;
      }
      if (res.accessState === "need_password") {
        passwordOpen.value = true;
        return false;
      }
      if (res.accessState === "need_login") {
        const ok = await navigateToViewerLogin();
        if (!ok) {
          blockedTitle.value = "请先登录";
          blockedMessage.value = "本场仅指定用户可观看，请先登录后再试";
        }
        return false;
      }
      applyBlocked(res.accessState);
      return false;
    } catch (e) {
      blockedTitle.value = "无法进入";
      blockedMessage.value = e instanceof Error ? e.message : "门禁校验失败";
      return false;
    } finally {
      checking.value = false;
    }
  }

  async function submitPassword(password: string): Promise<boolean> {
    passwordSubmitting.value = true;
    passwordError.value = "";
    try {
      const id = activityId();
      const res = await verifyWatchPassword(id, password);
      setActivityAccessToken(id, res.accessToken);
      passwordOpen.value = false;
      accessState.value = "ok";
      return true;
    } catch (e) {
      passwordError.value = e instanceof Error ? e.message : "密码错误";
      return false;
    } finally {
      passwordSubmitting.value = false;
    }
  }

  return {
    checking,
    accessState,
    passwordOpen,
    passwordSubmitting,
    passwordError,
    blockedTitle,
    blockedMessage,
    ensureAccess,
    submitPassword,
  };
}
