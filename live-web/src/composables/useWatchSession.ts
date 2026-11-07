import { computed, nextTick, onBeforeUnmount, ref, unref, type MaybeRefOrGetter, type Ref } from "vue";
import {
  getWatchSdk,
  getWatchSummary,
  type WatchSdkSignData,
  type WatchSdkSignParams,
  type WatchSummaryData,
} from "@/api/watch";
import { useCountdown } from "@/composables/useCountdown";
import { useBarrage } from "@/composables/useBarrage";
import { useChat } from "@/composables/useChat";
import { useRoomStats } from "@/composables/useRoomStats";
import { usePlayerControls } from "@/composables/usePlayerControls";
import { useAnnouncement } from "@/composables/useAnnouncement";
import { createWatchAdapter } from "@/live/createWatchAdapter";
import type { WatchAdapter } from "@/live/WatchAdapter";
import { formatSdkError } from "@/utils/sdk";
import { getViewerId } from "@/utils/viewerAuth";
import { isViewerLoginRequiredError } from "@/utils/viewerLogin";
import { useToast } from "@/composables/useToast";

export interface WatchSessionOptions {
  activityId: MaybeRefOrGetter<string>;
  /** SDK 昵称 */
  getNickname: () => string;
  /** SDK 进出推送（名单本地改在线态；admin 中控台对照用）。不写库，落库只走微吼回调。 */
  onPresenceOnline?: (msg: VhallUserPresenceMessage) => void;
  onPresenceOffline?: (msg: VhallUserPresenceMessage) => void;
  /** 观看页：无 viewerId 时点聊天跳登录。 */
  onUnauthenticatedChat?: () => void;
  /**
   * summary / sdk-sign 判定需登录（含「请先登录」业务 400）时回调。
   * 观看页：refresh 或清票跳 /login。
   */
  onViewerAuthRequired?: () => void | Promise<void>;
  /** 实时 customEvent 落券卡片后回调（如刷新券图标列表） */
  onCouponCustomEvent?: () => void;
}

function resolveId(id: MaybeRefOrGetter<string>): string {
  return typeof id === "function" ? id() : unref(id);
}

/**
 * 观看页会话：先 /summary 定页壳，再 /sdk-sign + init（含结束壳，便于听 live_start）。
 * 中控台已迁 admin-web（D110，对照本文件 + console API）。
 * 观众上下线落库不在这里：生产靠微吼回调，本地靠观看页按钮模拟回调。
 */
export function useWatchSession(opts: WatchSessionOptions) {
  const { toast } = useToast();
  const loading = ref(true);
  const error = ref("");
  /** 页壳（D95 summary） */
  const data = ref<WatchSummaryData | null>(null) as Ref<WatchSummaryData | null>;
  /** 最近一次签名（init 时有） */
  const sign = ref<WatchSdkSignData | null>(null) as Ref<WatchSdkSignData | null>;
  const sdkFailed = ref(false);

  let adapter: WatchAdapter | null = null;
  const getSdk = () => adapter?.getSdk() ?? null;
  /**
   * 可重试错误（20005/20006）是否自动 destroy 再拉签名 init。
   * 默认 false：贴官方 demo；刷新时二次 init 易放大 handleRoomInfo。可恢复：改 true。
   */
  const AUTO_RETRY_RETRYABLE_SDK = false;
  let sdkRetryCount = 0;
  const SDK_MAX_RETRIES = 2;
  let sdkRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** 使进行中的 adapter.init（含 loadScript）在重入 load / destroy 后失效 */
  let initEpoch = 0;
  /** 同一 epoch 内 moduleReady 只跑一次侧效（SDK 可能重复推送） */
  let moduleReadyEpoch = -1;
  /**
   * 页壳意图世代：live_over / live_start / 自动进房 各 ++。
   * 用于作废 in-flight 的 switchToEndedFromLive（await summary 后勿再强制 state=3）。
   */
  let roomUiEpoch = 0;
  /** 进房 recreate 进行中：防 live_start 与 summary 兜底并发双进 */
  let enterLiveInFlight = false;
  /** 预告/结束壳轻量 summary 对账（live_start 偶发丢失兜底，D108） */
  const SHELL_SUMMARY_POLL_MS = 20_000;
  let shellSummaryTimer: ReturnType<typeof setInterval> | null = null;
  let shellSummaryInFlight = false;

  const { countdown, start: startCountdown, stop: stopCountdown } = useCountdown();
  let reportSentChat: (text: string) => void = () => {};
  const barrage = useBarrage(getSdk, (text) => reportSentChat(text));
  const chat = useChat({
    getSdk,
    getSender: () => ({
      id: sign.value?.sdk?.account || (getViewerId() != null ? String(getViewerId()) : ""),
      name: opts.getNickname() || sign.value?.nickname || "我",
    }),
    onIncoming: (msg) => {
      const text = msg.msg?.trim();
      if (text) barrage.spawnDanmaku(text);
    },
    getActivityId: () => resolveId(opts.activityId),
    getViewerId: () => getViewerId(),
    onUnauthenticatedChat: opts.onUnauthenticatedChat,
    onCouponCustomEvent: opts.onCouponCustomEvent,
  });
  reportSentChat = chat.reportSentMessage;
  const stats = useRoomStats(getSdk);
  const notice = useAnnouncement(getSdk);
  const player = usePlayerControls({
    getSdk,
    onError: (msg) => {
      error.value = msg;
    },
  });
  const isLive = computed(() => data.value?.state === 1);
  const isPreview = computed(() => data.value?.state === 2);
  const isEnded = computed(() => data.value?.state === 3);
  const isReplay = computed(() => data.value?.state === 4 || data.value?.state === 5);
  const isAudioLive = computed(() => data.value?.type === 1);
  /**
   * D89：回放改走本站 TOS H5 页，观看页不再挂微吼 SDK 播回放。
   * 保留字段名兼容模板；恒为 false。
   */
  const canPlayReplay = computed(() => false);
  const sdkReady = computed(() => !!adapter?.getSdk() && !sdkFailed.value && isLive.value);

  /** 预告、直播、结束类都挂 SDK，才能立刻收到 live_start / live_over */
  function shouldInitSdk(res: WatchSummaryData): boolean {
    return res.state === 1 || res.state === 2 || res.state === 3 || res.state === 4 || res.state === 5;
  }

  function isEndedLikeState(state: number | undefined | null): boolean {
    return state === 3 || state === 4 || state === 5;
  }

  /** 本次 SDK 实例用的观众 id。undefined 表示还没拉过签名 */
  let sdkViewerId: number | null | undefined;
  let accountTimer: ReturnType<typeof setInterval> | null = null;

  function buildWatchParams(): WatchSdkSignParams {
    const params: WatchSdkSignParams = {};
    const nickname = opts.getNickname().trim();
    // 小程序 URL 已带展示昵称；传给 /watch/sdk-sign 作 sdk.username（勿再拉 user-info）
    // viewerId 只靠 Authorization JWT（D96），不进 Query
    if (nickname) params.nickname = nickname;
    return params;
  }

  /**
   * 本地切换账号后 viewerId 变了：旧 VhallSDK 仍是上一个 email，必须拆掉再 new。
   * email 在签名里，所以要重新请求 /sdk-sign，不能只改构造参数。
   */
  function reloadIfViewerChanged() {
    if (sdkViewerId === undefined || loading.value) return;
    if (getViewerId() === sdkViewerId) return;
    void load();
  }

  function onViewerStorage(ev: StorageEvent) {
    if (ev.key != null && ev.key !== "viewerId") return;
    reloadIfViewerChanged();
  }

  function isShellState(): boolean {
    return isPreview.value || isEnded.value || isReplay.value;
  }

  function stopShellSummaryPoll() {
    if (shellSummaryTimer) {
      clearInterval(shellSummaryTimer);
      shellSummaryTimer = null;
    }
  }

  function startShellSummaryPoll() {
    stopShellSummaryPoll();
    if (!isShellState()) return;
    shellSummaryTimer = setInterval(() => {
      void reconcileShellSummary("interval");
    }, SHELL_SUMMARY_POLL_MS);
  }

  function syncShellSummaryPoll() {
    if (isShellState()) startShellSummaryPoll();
    else stopShellSummaryPoll();
  }

  /**
   * 预告/结束壳轻量 summary 对账：仅页可见时；失败不挡 UI。
   * 发现 state===1 则走与 live_start 相同的自动进房（D108）。
   */
  async function reconcileShellSummary(_reason: "interval" | "visibility" | "focus") {
    if (!isShellState() || loading.value || enterLiveInFlight || shellSummaryInFlight) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const epoch = roomUiEpoch;
    const id = resolveId(opts.activityId);
    shellSummaryInFlight = true;
    try {
      const summary = await getWatchSummary(id);
      if (epoch !== roomUiEpoch) return;
      if (resolveId(opts.activityId) !== id) return;
      if (!isShellState()) return;
      if (summary.state !== 1) return;
      await enterLiveFromPreview();
    } catch (e) {
      console.warn("[watch] shell summary 对账失败（忽略）", e);
    } finally {
      shellSummaryInFlight = false;
    }
  }

  function onShellVisibility() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void reconcileShellSummary("visibility");
  }

  function onShellFocus() {
    void reconcileShellSummary("focus");
  }

  window.addEventListener("storage", onViewerStorage);
  window.addEventListener("focus", reloadIfViewerChanged);
  window.addEventListener("focus", onShellFocus);
  document.addEventListener("visibilitychange", onShellVisibility);
  if (import.meta.env.DEV) {
    accountTimer = setInterval(reloadIfViewerChanged, 1000);
  }

  /**
   * SDK live_start：预告/结束壳 → summary 对账 → 直接进房（无弹窗，D108）。
   * 进房走 destroy + 重新 sdk-sign/init（结束保活后 TXLivePlayer 易挂死，勿只 resume）。
   */
  async function handleLiveStart() {
    if (!isShellState() || enterLiveInFlight) return;
    const epoch = ++roomUiEpoch;
    const id = resolveId(opts.activityId);
    try {
      const summary = await getWatchSummary(id);
      if (epoch !== roomUiEpoch) return;
      if (resolveId(opts.activityId) !== id) return;
      // 对账字段写回；进房路径会翻 state=1
      data.value = summary;
    } catch (e) {
      console.warn("[watch] live_start summary 对账失败，仍自动进房", e);
    }
    if (epoch !== roomUiEpoch) return;
    if (!isShellState() && data.value?.state !== 1) return;
    await enterLiveFromPreview();
  }

  function destroySdk() {
    initEpoch += 1;
    chat.cancelHistoryLoad();
    stats.cancelRoomId();
    if (sdkRetryTimer) {
      clearTimeout(sdkRetryTimer);
      sdkRetryTimer = null;
    }
    adapter?.destroy();
    adapter = null;
    sign.value = null;
  }

  /**
   * afterInit：仅安全绑定后工作，不碰房间信息 API。
   * 播放器就绪主路径是官方 playerReady（及次要 vhallplay_LOADED）+ playerServer.isPlaying；
   * 此处不立刻扫 DOM。仅标 waiting；若 ~2.5s 仍无事件推进再启短 burst 兜底（防事件漏发挂死）。
   */
  function beginAfterInitSideEffects(epoch: number) {
    if (epoch !== initEpoch) return;
    chat.resetHistoryLoad();
    player.waitingForMedia = true;
    player.mediaFailed = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    window.setTimeout(() => {
      if (epoch !== initEpoch) return;
      if (!player.waitingForMedia || player.mediaFailed || player.needsTapToPlay) return;
      player.startPlayPoll(16);
    }, 2500);
  }

  /**
   * moduleReady：对齐 demo `isModuleReady`，再拉聊天/公告历史、房间 id、清晰度。
   * scheduleLoadHistory 内部仍可等 interact_token，但调度起点必须在 moduleReady 之后。
   */
  function beginModuleReadySideEffects(epoch: number) {
    if (epoch !== initEpoch) return;
    if (moduleReadyEpoch === epoch) return;
    moduleReadyEpoch = epoch;
    chat.scheduleLoadHistory(() => {
      if (epoch !== initEpoch) return;
      return notice.loadHistory();
    });
    stats.scheduleRoomId();
    player.scheduleQualityLabels();
  }

  async function initSdk(signData: WatchSdkSignData) {
    if (!data.value) return;
    const epoch = ++initEpoch;
    sign.value = signData;
    // 先关 loading，让 WatchView/ConsoleView 挂上 PlayerStage（内含 #player/#docWrap）
    loading.value = false;
    player.resetPlayback();
    await nextTick();
    if (epoch !== initEpoch) return;

    try {
      adapter = createWatchAdapter(signData.provider ?? "vhall");
      await adapter.init(signData, {
        isInitCurrent: () => epoch === initEpoch,
        onError: (msg) => {
          if (epoch !== initEpoch) return;
          player.markMediaFailed(formatSdkError(msg));
          sdkFailed.value = true;
        },
        onRetryableError: (text) => {
          if (epoch !== initEpoch) return;
          // 贴官方 demo：默认可重试错误只打日志，不自动 destroy 重拉。
          // 刷新时二次 init 更易放大 handleRoomInfo / nick_name / marquee（20005）。
          // 可恢复：AUTO_RETRY_RETRYABLE_SDK=true，或用户点遮罩「刷新」。
          console.warn("[vhall-sdk] 可重试错误（已关闭自动 destroy 重拉）:", text);
          if (!AUTO_RETRY_RETRYABLE_SDK) return;
          if (data.value && shouldInitSdk(data.value)) {
            if (sdkRetryTimer) return;
            sdkRetryTimer = setTimeout(() => {
              sdkRetryTimer = null;
              void retrySdkInit(text);
            }, 600);
            return;
          }
          player.markMediaFailed(text);
          sdkFailed.value = true;
        },
        onLiveEnded: () => {
          if (epoch !== initEpoch) return;
          void switchToEndedFromLive();
        },
        onAutoplayFailed: () => {
          if (epoch !== initEpoch) return;
          player.notifyAutoplayFailed();
        },
        onLiveStart: handleLiveStart,
        onChatMsg: chat.handleChatMessage,
        onChatDelete: chat.handleChatDelete,
        onQuestion: chat.handleQuestion,
        onQuestionBackout: chat.handleQuestionBackout,
        onCustomEvent: chat.handleCustomEvent,
        onDisableChat: () => chat.setMuted(true),
        onPermitChat: () => chat.setMuted(false),
        onAnnouncement: notice.handleAnnouncement,
        onOnlinePopulation: stats.handleOnlinePopulation,
        onPraiseTotal: stats.handlePraiseTotal,
        onUserOnline: (msg) => {
          opts.onPresenceOnline?.(msg);
        },
        onUserOffline: (msg) => {
          opts.onPresenceOffline?.(msg);
        },
        afterInit: () => beginAfterInitSideEffects(epoch),
        onModuleReady: () => beginModuleReadySideEffects(epoch),
        onPlayerReady: () => {
          if (epoch !== initEpoch) return;
          player.onPlayerReady();
        },
        onPlayerLoaded: () => {
          if (epoch !== initEpoch) return;
          player.onVhallPlayLoaded();
        },
      });
      if (epoch !== initEpoch) {
        adapter?.destroy();
        adapter = null;
      }
    } catch (e) {
      if (epoch !== initEpoch) return;
      adapter?.destroy();
      adapter = null;
      throw e;
    }
  }

  async function fetchSignAndInit() {
    const signRes = await getWatchSdk(resolveId(opts.activityId), buildWatchParams());
    await initSdk(signRes);
  }

  async function retrySdkInit(reason: string) {
    if (sdkRetryCount >= SDK_MAX_RETRIES) {
      player.markMediaFailed(`${reason}（已自动重试 ${SDK_MAX_RETRIES} 次仍失败）`);
      sdkFailed.value = true;
      return;
    }
    sdkRetryCount += 1;
    console.warn(`SDK 可重试错误，自动重拉签名 ${sdkRetryCount}/${SDK_MAX_RETRIES}:`, reason);
    player.resetPlayback();
    player.waitingForMedia = true;
    destroySdk();
    try {
      const summary = await getWatchSummary(resolveId(opts.activityId));
      data.value = summary;
      if (!shouldInitSdk(summary)) {
        loading.value = false;
        if (isEndedLikeState(summary.state)) stats.markLiveEnded();
        return;
      }
      if (isEndedLikeState(summary.state)) {
        stats.markLiveEnded();
      }
      await fetchSignAndInit();
    } catch (e) {
      player.markMediaFailed(e instanceof Error ? e.message : "重试加载失败");
      sdkFailed.value = true;
    }
  }

  /**
   * live_over / streamOver：只切结束 UI，**绝不** destroySdk。
   * 保留实例才能立刻收到再开播的 live_start（D108）。
   * await summary 返回后若 roomUiEpoch 已前进（已收到 live_start / 已自动进房），勿再盖回 state=3。
   */
  async function switchToEndedFromLive() {
    const epoch = ++roomUiEpoch;
    stats.markLiveEnded();
    player.pausePlayback();
    // 刻意不调用 destroySdk / adapter.destroy
    const id = resolveId(opts.activityId);
    // 先同步出结束壳，便于紧随其后的 live_start / 兜底对账能命中 isShellState
    if (data.value) {
      data.value = { ...data.value, state: 3 };
    } else {
      data.value = { id, state: 3, title: "", type: 2 };
    }
    loading.value = false;
    syncShellSummaryPoll();
    try {
      const summary = await getWatchSummary(id);
      if (epoch !== roomUiEpoch) return;
      // 强制 state=3 出 EndedScreen 壳；云侧 4/5 仍当结束壳，回放走独立路由
      data.value = { ...summary, state: 3 };
      syncShellSummaryPoll();
    } catch {
      if (epoch !== roomUiEpoch) return;
      if (data.value) {
        data.value = { ...data.value, state: 3 };
      } else {
        data.value = { id, state: 3, title: "", type: 2 };
      }
      syncShellSummaryPoll();
    }
  }

  /**
   * 预告/结束壳 → 直播 UI：翻 state=1，并 destroy + 重新 sdk-sign/init。
   * 结束保活后 TXLivePlayer DOM 可能已挂死，仅 resume 易 removeChild/startReport null；
   * live_start / summary 兜底进房均走 recreate，结束时仍不主动拆（D108）。
   */
  async function enterLiveFromPreview() {
    if (enterLiveInFlight) return;
    enterLiveInFlight = true;
    roomUiEpoch += 1;
    stopShellSummaryPoll();
    stats.resetLiveEnded();
    try {
      if (!data.value) {
        void load();
        return;
      }
      data.value = { ...data.value, state: 1 };
      player.resetPlayback();
      player.waitingForMedia = true;
      destroySdk();
      try {
        await fetchSignAndInit();
      } catch (e) {
        if (isViewerLoginRequiredError(e) && opts.onViewerAuthRequired) {
          error.value = "";
          loading.value = false;
          await opts.onViewerAuthRequired();
          return;
        }
        sdkFailed.value = true;
        error.value = e instanceof Error ? e.message : "进入直播失败";
        loading.value = false;
        syncShellSummaryPoll();
      }
    } finally {
      enterLiveInFlight = false;
    }
  }

  async function load() {
    roomUiEpoch += 1;
    enterLiveInFlight = false;
    stopShellSummaryPoll();
    const requestedViewerId = getViewerId();
    sdkViewerId = requestedViewerId;
    loading.value = true;
    error.value = "";
    sdkFailed.value = false;
    sdkRetryCount = 0;
    data.value = null;
    sign.value = null;
    stopCountdown();
    stats.resetLiveEnded();
    destroySdk();
    try {
      const summary = await getWatchSummary(resolveId(opts.activityId));
      if (getViewerId() !== requestedViewerId) {
        await load();
        return;
      }
      data.value = summary;

      if (summary.state === 2 && summary.startTime) {
        startCountdown(summary.startTime);
      }
      if (shouldInitSdk(summary)) {
        if (isEndedLikeState(summary.state)) {
          stats.markLiveEnded();
        }
        try {
          await fetchSignAndInit();
        } catch (e) {
          // 结束类房间偶发无法 init：仍保留结束壳，不挡「查看回放」
          if (isEndedLikeState(summary.state)) {
            console.warn("[watch] ended-like sdk init failed, keep ended shell", e);
            loading.value = false;
            syncShellSummaryPoll();
            return;
          }
          throw e;
        }
      } else {
        loading.value = false;
      }
      syncShellSummaryPoll();
    } catch (e) {
      if (isViewerLoginRequiredError(e) && opts.onViewerAuthRequired) {
        error.value = "";
        loading.value = false;
        await opts.onViewerAuthRequired();
        return;
      }
      sdkFailed.value = true;
      error.value = e instanceof Error ? e.message : "加载失败";
      loading.value = false;
    }
  }

  async function shareWatch() {
    // 复制当前观看 URL（保留已有 `c`/hint；去掉观众登录注入参数）。不手写 ?c=。
    const u = new URL(window.location.href);
    for (const key of ["viewerId", "viewerAccessToken", "accessToken", "token", "nickname"]) {
      u.searchParams.delete(key);
    }
    const url = `${u.origin}${u.pathname}${u.search}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("观看链接已复制");
    } catch {
      toast("复制失败，请手动复制地址栏链接");
    }
  }

  function dispose() {
    window.removeEventListener("storage", onViewerStorage);
    window.removeEventListener("focus", reloadIfViewerChanged);
    window.removeEventListener("focus", onShellFocus);
    document.removeEventListener("visibilitychange", onShellVisibility);
    if (accountTimer) {
      clearInterval(accountTimer);
      accountTimer = null;
    }
    stopShellSummaryPoll();
    stopCountdown();
    destroySdk();
  }

  onBeforeUnmount(dispose);

  return {
    loading,
    error,
    data,
    sign,
    sdkFailed,
    countdown,
    barrage,
    chat,
    stats,
    notice,
    player,
    isLive,
    isPreview,
    isEnded,
    isReplay,
    canPlayReplay,
    isAudioLive,
    sdkReady,
    load,
    enterLiveFromPreview,
    shareWatch,
    dispose,
  };
}
