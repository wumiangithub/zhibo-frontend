import { ref } from "vue";
import {
  getWatchAccess,
  verifyWatchPassword,
  type WatchAccessState,
} from "@/api/watchAccess";
import { setActivityAccessToken } from "@/utils/activityAccess";
import { clearViewerSession } from "@/utils/viewerAuth";
import {
  goViewerLogin,
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

/**
 * 观看页 / 回放页共用：先查 access，再决定弹密码、跳登录或拦截。
 */
export function useWatchAccessGate(activityId: () => string) {
  /** 仅 ensureAccess 进行中为 true；勿默认 true，否则未进房就卡住「校验观看权限…」 */
  const checking = ref(false);
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

  async function applyAccessResult(res: { accessState: WatchAccessState }): Promise<boolean> {
    accessState.value = res.accessState;
    if (res.accessState === "ok") return true;
    if (res.accessState === "need_password") {
      passwordOpen.value = true;
      return false;
    }
    if (res.accessState === "need_login") return false;
    applyBlocked(res.accessState);
    return false;
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
      let res = await getWatchAccess(id);
      let ok = await applyAccessResult(res);
      if (ok) return true;
      if (res.accessState !== "need_login") return false;

      // JWT 缺失/无效：先 refresh；失败则清票跳登录
      const outcome = await recoverViewerAuth();
      if (outcome !== "refreshed") return false;
      res = await getWatchAccess(id);
      ok = await applyAccessResult(res);
      if (ok) return true;
      if (res.accessState === "need_login") {
        clearViewerSession();
        await goViewerLogin();
      }
      return false;
    } catch (e) {
      if (isViewerLoginRequiredError(e)) {
        const outcome = await recoverViewerAuth();
        if (outcome === "refreshed") {
          try {
            const res = await getWatchAccess(activityId());
            const passed = await applyAccessResult(res);
            if (passed) return true;
            if (res.accessState === "need_login") {
              clearViewerSession();
              await goViewerLogin();
            }
            return false;
          } catch (e2) {
            if (isViewerLoginRequiredError(e2)) {
              clearViewerSession();
              await goViewerLogin();
              return false;
            }
            blockedTitle.value = "无法进入";
            blockedMessage.value =
              e2 instanceof Error ? e2.message : "门禁校验失败";
            return false;
          }
        }
        return false;
      }
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
