import { onBeforeUnmount, onMounted, ref } from "vue";
import { getViewerPayResult } from "@/api/orderCenter";
import {
  clearViewerPendingPaySession,
  loadViewerPendingPaySession,
  type ViewerPendingPaySession,
} from "@/utils/viewerPendingPaySession";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;
/** 「我已支付」短查：约 3 次 / 6 秒 */
const CONFIRM_TRIES = 3;
const CONFIRM_INTERVAL_MS = 2000;

export type PayResultWaitStatus =
  | "idle"
  | "polling"
  | "timeout"
  | "confirming"
  | "paid"
  | "cancelled";

export function usePayResultWait(opts: {
  activityId: string;
  onPaid: (session: ViewerPendingPaySession) => void;
  onStillUnpaid?: () => void;
}) {
  const status = ref<PayResultWaitStatus>("idle");
  const timeoutDialogOpen = ref(false);
  const confirming = ref(false);

  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pollStartedAt = 0;
  let activeChargeId = "";
  let stopped = false;
  let inFlight = false;

  function clearPollTimer() {
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  }

  function stopAll() {
    stopped = true;
    clearPollTimer();
    inFlight = false;
    confirming.value = false;
  }

  function scheduleNext(delayMs: number, tick: () => void) {
    clearPollTimer();
    pollTimer = setTimeout(tick, delayMs);
  }

  async function queryPaid(chargeId: string): Promise<boolean> {
    const result = await getViewerPayResult(chargeId);
    return result.paid === true;
  }

  function finishPaid(session: ViewerPendingPaySession) {
    clearPollTimer();
    timeoutDialogOpen.value = false;
    confirming.value = false;
    status.value = "paid";
    clearViewerPendingPaySession(opts.activityId);
    opts.onPaid(session);
  }

  async function pollTick() {
    if (stopped || status.value !== "polling") return;
    const session = loadViewerPendingPaySession(opts.activityId);
    if (!session || session.chargeId !== activeChargeId) {
      status.value = "idle";
      return;
    }

    const elapsed = Date.now() - pollStartedAt;
    if (elapsed >= MAX_POLL_MS) {
      status.value = "timeout";
      timeoutDialogOpen.value = true;
      clearPollTimer();
      return;
    }

    if (inFlight) {
      scheduleNext(POLL_INTERVAL_MS, () => void pollTick());
      return;
    }

    inFlight = true;
    try {
      const paid = await queryPaid(session.chargeId);
      if (stopped || status.value !== "polling") return;
      if (paid) {
        finishPaid(session);
        return;
      }
    } catch {
      /* 网络抖动继续轮询，直到超时 */
    } finally {
      inFlight = false;
    }

    if (stopped || status.value !== "polling") return;
    if (Date.now() - pollStartedAt >= MAX_POLL_MS) {
      status.value = "timeout";
      timeoutDialogOpen.value = true;
      return;
    }
    scheduleNext(POLL_INTERVAL_MS, () => void pollTick());
  }

  /** 页面重新 show：有 pending charge 则开始/继续轮询（最长 10 分钟）。 */
  function startOrResumeFromPending() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    const session = loadViewerPendingPaySession(opts.activityId);
    if (!session) return;
    if (status.value === "paid" || status.value === "cancelled") return;
    if (status.value === "timeout" && timeoutDialogOpen.value) return;
    if (status.value === "confirming") return;

    stopped = false;
    activeChargeId = session.chargeId;
    if (status.value !== "polling") {
      pollStartedAt = Date.now();
      status.value = "polling";
    }
    void pollTick();
  }

  function onVisibilityOrShow() {
    if (document.visibilityState === "visible") {
      startOrResumeFromPending();
    }
  }

  function onPageShow(ev: PageTransitionEvent) {
    if (ev.persisted || document.visibilityState === "visible") {
      startOrResumeFromPending();
    }
  }

  async function onConfirmPaid() {
    if (confirming.value) return;
    const session = loadViewerPendingPaySession(opts.activityId);
    if (!session) {
      timeoutDialogOpen.value = false;
      status.value = "idle";
      return;
    }

    confirming.value = true;
    status.value = "confirming";
    stopped = false;

    try {
      for (let i = 0; i < CONFIRM_TRIES; i++) {
        try {
          const paid = await queryPaid(session.chargeId);
          if (paid) {
            finishPaid(session);
            return;
          }
        } catch {
          /* 再试 */
        }
        if (i < CONFIRM_TRIES - 1) {
          await new Promise((r) => setTimeout(r, CONFIRM_INTERVAL_MS));
        }
      }
      opts.onStillUnpaid?.();
      status.value = "timeout";
    } finally {
      confirming.value = false;
    }
  }

  function onCancelPay() {
    stopAll();
    timeoutDialogOpen.value = false;
    status.value = "cancelled";
    clearViewerPendingPaySession(opts.activityId);
  }

  function markAwaitingAfterInvoke() {
    /* 跳转收银台前已写 pending；回页后由 show 触发轮询。
       支付宝复制链接未离页时也立刻开始轮询。 */
    startOrResumeFromPending();
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibilityOrShow);
    window.addEventListener("pageshow", onPageShow);
    startOrResumeFromPending();
  });

  onBeforeUnmount(() => {
    stopAll();
    document.removeEventListener("visibilitychange", onVisibilityOrShow);
    window.removeEventListener("pageshow", onPageShow);
  });

  return {
    status,
    timeoutDialogOpen,
    confirming,
    startOrResumeFromPending,
    markAwaitingAfterInvoke,
    onConfirmPaid,
    onCancelPay,
  };
}
