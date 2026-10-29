import { onBeforeUnmount, unref, type MaybeRefOrGetter } from "vue";
import {
  heartbeatReplayWatch,
  heartbeatReplayWatchKeepalive,
  listWatchRecords,
  startReplayWatch,
} from "@/api/replayWatch";
import { isViewerLoggedIn } from "@/utils/viewerAuth";

const HEARTBEAT_MS = 3 * 60 * 1000;

export interface ReplayWatchOptions {
  activityId: MaybeRefOrGetter<string>;
  /** 结束/回放且本站回放开启时为 true */
  active: () => boolean;
}

function resolveId(id: MaybeRefOrGetter<string>): string {
  return typeof id === "function" ? id() : unref(id);
}

/**
 * 登录观众点回放：start 一行，每 3 分钟与暂停/播完/关页 heartbeat。
 * 游客不调。失败静默（关页那次没送达则停在上次成功心跳）。
 */
export function useReplayWatch(opts: ReplayWatchOptions) {
  let socketId: string | null = null;
  let starting = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function activityId() {
    return resolveId(opts.activityId);
  }

  function stopTimer() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      void sendHeartbeat(false);
    }, HEARTBEAT_MS);
  }

  async function sendHeartbeat(keepalive: boolean) {
    const sid = socketId;
    const id = activityId();
    if (!sid || !id) return;
    if (keepalive) {
      heartbeatReplayWatchKeepalive(id, sid);
      return;
    }
    try {
      await heartbeatReplayWatch(id, sid);
    } catch (e) {
      console.warn("回放心跳失败", e);
    }
  }

  async function onPlay() {
    if (!opts.active()) return;
    if (!isViewerLoggedIn()) return;
    if (socketId) {
      startTimer();
      return;
    }
    if (starting) return;
    starting = true;
    try {
      const records = await listWatchRecords(activityId());
      const recordId = records.list?.find((row) => Number(row.id) > 0)?.id;
      if (recordId == null) {
        console.warn("回放 start 跳过：没有 recordId");
        return;
      }
      const res = await startReplayWatch(activityId(), Number(recordId));
      const sid = res.socketId?.trim() ?? "";
      if (!sid) return;
      socketId = sid;
      startTimer();
    } catch (e) {
      console.warn("回放 start 失败", e);
    } finally {
      starting = false;
    }
  }

  function onPause() {
    if (!socketId) return;
    void sendHeartbeat(false);
  }

  function onEnded() {
    if (!socketId) return;
    void sendHeartbeat(false);
    stopTimer();
    socketId = null;
  }

  function onPageHide() {
    if (!socketId) return;
    void sendHeartbeat(true);
  }

  function reset() {
    stopTimer();
    socketId = null;
    starting = false;
  }

  window.addEventListener("pagehide", onPageHide);

  onBeforeUnmount(() => {
    window.removeEventListener("pagehide", onPageHide);
    if (socketId) void sendHeartbeat(false);
    reset();
  });

  return {
    onPlay,
    onPause,
    onEnded,
    reset,
  };
}
