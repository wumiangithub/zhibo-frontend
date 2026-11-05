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
  /** SDK 进出推送（中控台名单本地改在线态）。不写库，落库只走微吼回调。 */
  onPresenceOnline?: (msg: VhallUserPresenceMessage) => void;
  onPresenceOffline?: (msg: VhallUserPresenceMessage) => void;
  /**
   * 观看页：无 viewerId 时点聊天跳登录。
   * 中控台不传，继续假验证弹窗。
   */
  onUnauthenticatedChat?: () => void;
  /**
   * summary / sdk-sign 判定需登录（含「请先登录」业务 400）时回调。
   * 观看页：refresh 或清票跳 /login；中控台不传则仍展示 error。
   */
  onViewerAuthRequired?: () => void | Promise<void>;
}

function resolveId(id: MaybeRefOrGetter<string>): string {
  return typeof id === "function" ? id() : unref(id);
}

/**
 * 观看页与中控台共用：先 /summary 定页壳，再 /sdk-sign + init（含结束壳，便于听 live_start）。
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
  const showLiveStartPopup = ref(false);

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

  /** 主观看页 / 中控台：预告、直播、结束类都挂 SDK，才能立刻收到 live_start / live_over */
  function shouldInitSdk(res: WatchSummaryData): boolean {
    return res.state === 1 || res.state === 2 || res.state === 3 || res.state === 4 || res.state === 5;
  }

  function isEndedLikeState(state: number | undefined | null): boolean {
    return state === 3 || state === 4 || state === 5;
  }

  function hasLiveSdk(): boolean {
    return !!adapter?.getSdk() && !sdkFailed.value;
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

  window.addEventListener("storage", onViewerStorage);
  window.addEventListener("focus", reloadIfViewerChanged);
  if (import.meta.env.DEV) {
    accountTimer = setInterval(reloadIfViewerChanged, 1000);
  }

  function handleLiveStart() {
    if (isPreview.value || isEnded.value || isReplay.value) {
      showLiveStartPopup.value = true;
    }
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
   * 播放器就绪主路径是官方 playerReady（及次要 vhallplay_LOADED）；此处不再立刻狂扫 DOM。
   * 仅标 waiting；若 ~2.5s 仍无事件推进再启短轮询兜底（防事件漏发挂死）。
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
   * live_over / streamOver：只切结束 UI，不 destroySdk。
   * 保留实例才能立刻收到再开播的 live_start（D108）。
   */
  async function switchToEndedFromLive() {
    stats.markLiveEnded();
    showLiveStartPopup.value = false;
    player.pausePlayback();
    const id = resolveId(opts.activityId);
    try {
      const summary = await getWatchSummary(id);
      // 强制 state=3 出 EndedScreen 壳；云侧 4/5 仍当结束壳，回放走独立路由
      data.value = { ...summary, state: 3 };
    } catch {
      if (data.value) {
        data.value = { ...data.value, state: 3 };
      } else {
        data.value = { id, state: 3, title: "", type: 2 };
      }
    }
    loading.value = false;
  }

  /**
   * 预告/结束壳上点「立即观看」：SDK 已在则只翻 state + 起播，避免 destroy+recreate。
   */
  function enterLiveFromPreview() {
    showLiveStartPopup.value = false;
    if (hasLiveSdk() && data.value) {
      stats.resetLiveEnded();
      data.value = { ...data.value, state: 1 };
      player.resetPlayback();
      player.waitingForMedia = true;
      player.startPlayPoll();
      void player.resumePlayback();
      return;
    }
    void load();
  }

  async function load() {
    const requestedViewerId = getViewerId();
    sdkViewerId = requestedViewerId;
    loading.value = true;
    error.value = "";
    sdkFailed.value = false;
    sdkRetryCount = 0;
    data.value = null;
    sign.value = null;
    showLiveStartPopup.value = false;
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
            return;
          }
          throw e;
        }
      } else {
        loading.value = false;
      }
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
    if (accountTimer) {
      clearInterval(accountTimer);
      accountTimer = null;
    }
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
    showLiveStartPopup,
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
