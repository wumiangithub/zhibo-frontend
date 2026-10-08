import type { LiveProvider } from "@/live/types";
import { enterAttendance, leaveAttendanceBatch, type LeaveAttendanceItem } from "@/api/attendance";
import {
  clientReportEnabled,
  leaveAssistantEnabled,
  leaveLastViewerEnabled,
  leaveThrottleMs,
} from "@/live/attendanceConfig";
import {
  clearOpenAttendance,
  formatShanghaiNow,
  newAttendanceMid,
  newAttendanceMidSync,
  readOpenAttendance,
  sendLeaveKeepalive,
  writeOpenAttendance,
} from "@/live/attendanceSession";
import {
  RoomPresence,
  type LeaveReport,
  type PresenceEffects,
  type SelfIdentity,
} from "@/live/roomPresence";

export type AttendanceRole = "viewer" | "assistant";

export interface AttendanceContext {
  activityId: string;
  provider?: LiveProvider;
  guestId: string;
  /** 随进入接口提交的昵称 */
  nickname: string;
  /** 锁定自己的 sender_id 之前，用这些昵称认出自己的 Join */
  matchNicknames: string[];
  /** viewer=最后一人上报离开；assistant=听到离线都入队 */
  role?: AttendanceRole;
}

const USER_ID_MAX = 128;
const NICKNAME_MAX = 128;
const LEAVE_BATCH = 100;

type PendingLeave = Omit<LeaveAttendanceItem, "mid">;

/**
 * 仅微吼。受 `VITE_ATTENDANCE_CLIENT_REPORT` 总开关（本地默认开）。
 * viewer：自己 Join 调进入；离开仅当「比自己晚进的人里已无仍在线者」（受 LAST_VIEWER 开关）。
 * assistant：自己 Join 调进入；他人 Join 也 enter（本机无回调时名单才能落库）；听到的离线一律入队（受 ASSISTANT 开关）。
 * enter 去重键 = userId（sender_id）：RoomPresence.enteredOnline 已在线则不调 enter；
 * 新 visit/userId（换 Tab/浏览器）可 enter；换 visit 先 leave 旧身份；enter 失败 clearSelfIf 才允许同 id 重试。
 * 关页/刷新：pagehide+beforeunload 用 keepalive/beacon 立刻 leave 自己（不受 last-viewer 限制）；
 * sessionStorage 记未 leave 的 enter，再进同 Tab 若未见 leave 则先 leave 再 enter。
 * 离开进节流队列，按批 `{ items }` 发送；关播后清空并停报。
 * mid：短串 `{activityId}_{userId}_{time到分}`，超 64 用 SHA-256 hex；请求体时间仍带秒。
 */
export function useAttendance(getContext: () => AttendanceContext | null) {
  const presence = new RoomPresence();
  /** userId → 待发离开（同人保留较新 leaveTime）；mid 在 flush 时按 leaveTime 生成 */
  const leaveQueue = new Map<string, PendingLeave>();
  let closed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;
  /** 关页 leave 只发一次（pagehide + beforeunload 可能都触发） */
  let unloadLeaveSent = false;

  function context(): AttendanceContext | null {
    if (closed || !clientReportEnabled()) return null;
    const ctx = getContext();
    if (!ctx?.activityId) return null;
    if ((ctx.provider ?? "vhall") !== "vhall") return null;
    return ctx;
  }

  function identity(ctx: AttendanceContext): SelfIdentity {
    return {
      guestId: ctx.guestId.trim(),
      nicknames: ctx.matchNicknames,
    };
  }

  function roleOf(ctx: AttendanceContext): AttendanceRole {
    return ctx.role ?? "viewer";
  }

  function presenceOpts(ctx: AttendanceContext) {
    return { reportAllLeaves: roleOf(ctx) === "assistant" };
  }

  /** 对应角色的离开开关；关则不入队（关页 self leave / 换 visit 不受此限） */
  function leaveEnabled(ctx: AttendanceContext): boolean {
    return roleOf(ctx) === "assistant" ? leaveAssistantEnabled() : leaveLastViewerEnabled();
  }

  function enqueueLeaves(ctx: AttendanceContext, leaves: LeaveReport[]) {
    if (closed || !leaves.length || !leaveEnabled(ctx)) return;
    for (const item of leaves) {
      if (!validUserId(item.userId)) continue;
      const prev = leaveQueue.get(item.userId);
      if (!prev || item.leaveTime >= prev.leaveTime) {
        leaveQueue.set(item.userId, {
          userId: item.userId,
          enterTime: item.enterTime,
          leaveTime: item.leaveTime,
        });
      }
    }
    scheduleFlush();
  }

  function scheduleFlush() {
    if (closed || flushTimer || flushing) return;
    if (!leaveQueue.size) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushLeaveQueue();
    }, leaveThrottleMs());
  }

  function clearSessionForLeaves(items: Array<{ userId: string; enterTime: string }>) {
    for (const item of items) {
      clearOpenAttendance({ userId: item.userId, enterTime: item.enterTime });
    }
  }

  async function flushLeaveQueue() {
    if (closed || flushing || !clientReportEnabled()) {
      if (!clientReportEnabled()) leaveQueue.clear();
      return;
    }
    const ctx = getContext();
    if (!ctx?.activityId || (ctx.provider ?? "vhall") !== "vhall") {
      leaveQueue.clear();
      return;
    }
    if (!leaveEnabled(ctx)) {
      leaveQueue.clear();
      return;
    }
    if (!leaveQueue.size) return;
    flushing = true;
    const pending = [...leaveQueue.values()];
    leaveQueue.clear();
    try {
      const items: LeaveAttendanceItem[] = await Promise.all(
        pending.map(async (item) => ({
          ...item,
          mid: await newAttendanceMid(ctx.activityId, item.userId, item.leaveTime),
        })),
      );
      const chunks: LeaveAttendanceItem[][] = [];
      for (let i = 0; i < items.length; i += LEAVE_BATCH) {
        chunks.push(items.slice(i, i + LEAVE_BATCH));
      }
      await Promise.all(
        chunks.map((chunk) =>
          leaveAttendanceBatch(ctx.activityId, { items: chunk })
            .then(() => clearSessionForLeaves(chunk))
            .catch((e) => {
              console.warn("[attendance] 批量离开上报失败", e);
            }),
        ),
      );
    } finally {
      flushing = false;
      if (!closed && leaveQueue.size) scheduleFlush();
    }
  }

  /** 换 visit / 再进补 leave：立刻 leave（不走节流、不受角色离开开关影响） */
  async function reportImmediateLeave(ctx: AttendanceContext, leave: LeaveReport) {
    if (closed || !validUserId(leave.userId)) return;
    try {
      await leaveAttendanceBatch(ctx.activityId, {
        items: [
          {
            userId: leave.userId,
            enterTime: leave.enterTime,
            leaveTime: leave.leaveTime,
            mid: await newAttendanceMid(ctx.activityId, leave.userId, leave.leaveTime),
          },
        ],
      });
      clearOpenAttendance({
        activityId: ctx.activityId,
        userId: leave.userId,
        enterTime: leave.enterTime,
      });
    } catch (e) {
      console.warn("[attendance] 立即离开上报失败", e);
    }
  }

  /**
   * 本 Tab sessionStorage 仍记着未 leave 的 enter 时，新 Join 先补 leave 再 enter。
   * 换 Tab 各有独立 sessionStorage，仍允许各自 enter。
   */
  async function leaveStaleSessionIfNeeded(
    ctx: AttendanceContext,
    nextEnter: { userId: string; enterTime: string } | null,
  ) {
    const open = readOpenAttendance();
    if (!open || open.activityId !== ctx.activityId) return;
    if (
      nextEnter &&
      open.userId === nextEnter.userId &&
      open.enterTime === nextEnter.enterTime
    ) {
      return;
    }
    const leaveTime =
      nextEnter && nextEnter.enterTime > open.enterTime
        ? nextEnter.enterTime
        : formatShanghaiNow();
    await reportImmediateLeave(ctx, {
      userId: open.userId,
      enterTime: open.enterTime,
      leaveTime,
    });
  }

  async function postEnter(
    ctx: AttendanceContext,
    report: {
      userId: string;
      enterTime: string;
      avatarUrl?: string;
      nickname?: string;
    },
    nickname: string,
    opts: { persistSession: boolean },
  ): Promise<boolean> {
    if (!validUserId(report.userId)) return false;
    const nick = nickname.trim().slice(0, NICKNAME_MAX);
    try {
      await enterAttendance(ctx.activityId, {
        userId: report.userId,
        enterTime: report.enterTime,
        mid: await newAttendanceMid(ctx.activityId, report.userId, report.enterTime),
        ...(nick ? { nickname: nick } : {}),
        ...(report.avatarUrl ? { avatarUrl: report.avatarUrl } : {}),
      });
      // 只记自己的 enter；助理给他人 enter 不写 session，避免冲掉 self
      if (opts.persistSession) {
        writeOpenAttendance({
          activityId: ctx.activityId,
          userId: report.userId,
          enterTime: report.enterTime,
        });
      }
      return true;
    } catch (e) {
      console.warn("[attendance] 进入上报失败", e);
      return false;
    }
  }

  async function publishEnter(ctx: AttendanceContext, effects: PresenceEffects) {
    if (effects.skippedMissingTime) {
      console.warn("[attendance] 推送没有 yyyy-MM-dd HH:mm:ss，已跳过，不用本地时间");
    }
    if (effects.skippedMissingEnter) {
      console.warn("[attendance] 离开推送对不上此前的进入时间，已跳过");
    }
    if (effects.enter) {
      await leaveStaleSessionIfNeeded(ctx, effects.enter);
      const ok = await postEnter(ctx, effects.enter, ctx.nickname, { persistSession: true });
      if (!ok) presence.clearSelfIf(effects.enter.userId);
    }
    for (const peer of effects.peerEnters) {
      await postEnter(ctx, peer, peer.nickname ?? "", { persistSession: false });
    }
  }

  async function onUserOnline(msg: VhallUserPresenceMessage) {
    const ctx = context();
    if (!ctx) return;
    const effects = presence.onOnline(msg, identity(ctx), presenceOpts(ctx));
    if (effects.replacedSelfLeave) {
      await reportImmediateLeave(ctx, effects.replacedSelfLeave);
    }
    await publishEnter(ctx, effects);
    enqueueLeaves(ctx, effects.leaves);
  }

  async function onUserOffline(msg: VhallUserPresenceMessage) {
    const ctx = context();
    if (!ctx) return;
    const effects = presence.onOffline(msg, presenceOpts(ctx));
    if (effects.skippedMissingTime) {
      console.warn("[attendance] 推送没有 yyyy-MM-dd HH:mm:ss，已跳过，不用本地时间");
    }
    if (effects.skippedMissingEnter) {
      console.warn("[attendance] 离开推送对不上此前的进入时间，已跳过");
    }
    enqueueLeaves(ctx, effects.leaves);
  }

  /** live_over / streamOver：清空待发离开并停止进出上报 */
  function stopOnLiveEnded() {
    closed = true;
    leaveQueue.clear();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * 关页/刷新：同步拼 leave（含队列 + 自己），keepalive/beacon 发出。
   * 不受 viewer「最后一人」限制——刷新时 SDK 常不推 Leave，只靠队列会漏。
   */
  function flushOnUnload() {
    if (closed || unloadLeaveSent || !clientReportEnabled()) return;
    const ctx = getContext();
    if (!ctx?.activityId || (ctx.provider ?? "vhall") !== "vhall") return;

    const byUser = new Map<string, PendingLeave>();
    for (const item of leaveQueue.values()) {
      byUser.set(item.userId, item);
    }
    leaveQueue.clear();

    const self = presence.getSelfOpen();
    const open = readOpenAttendance();
    const selfCandidate =
      self ??
      (open && open.activityId === ctx.activityId
        ? { userId: open.userId, enterTime: open.enterTime }
        : null);
    if (selfCandidate && validUserId(selfCandidate.userId) && !byUser.has(selfCandidate.userId)) {
      byUser.set(selfCandidate.userId, {
        userId: selfCandidate.userId,
        enterTime: selfCandidate.enterTime,
        leaveTime: formatShanghaiNow(),
      });
    }

    if (!byUser.size) return;
    unloadLeaveSent = true;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    const items: LeaveAttendanceItem[] = [...byUser.values()].map((item) => ({
      ...item,
      mid: newAttendanceMidSync(ctx.activityId, item.userId, item.leaveTime),
    }));
    sendLeaveKeepalive(ctx.activityId, items);
    clearSessionForLeaves(items);
    presence.markSelfLeftLocally();
  }

  /** SPA 卸载与关页共用：keepalive 刷队列 + leave 自己（勿依赖可被取消的 XHR） */
  function flushPending() {
    flushOnUnload();
  }

  function reset() {
    presence.reset();
    leaveQueue.clear();
    closed = false;
    unloadingReset();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function unloadingReset() {
    unloadLeaveSent = false;
  }

  function onPageHide() {
    flushOnUnload();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
  }

  return {
    onUserOnline,
    onUserOffline,
    stopOnLiveEnded,
    flushPending,
    flushOnUnload,
    reset,
  };
}

function validUserId(userId: string): boolean {
  return userId.length > 0 && userId.length <= USER_ID_MAX;
}
