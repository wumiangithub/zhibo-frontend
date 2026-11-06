/**
 * 中控台会话。对照 live-web `useWatchSession`：
 * - summary / sdk-sign 走 admin `/activities/console/*`
 * - 身份用 employeeId（签名回显），无观众 JWT / 登录跳转
 * - 结束壳保活观看 SDK（D108），讨论区历史仍走 SDK `scheduleLoadHistory`
 */
import { computed, nextTick, onBeforeUnmount, ref, unref, type MaybeRefOrGetter, type Ref } from "vue";
import {
  getConsoleSdkSign,
  getConsoleSummary,
  type ConsoleSdkSignData,
  type ConsoleSdkSignParams,
  type ConsoleSummaryData,
} from "../api/console";
import { useCountdown } from "./useCountdown";
import { useBarrage } from "./useBarrage";
import { useChat } from "./useChat";
import { useRoomStats } from "./useRoomStats";
import { usePlayerControls } from "./usePlayerControls";
import { useAnnouncement } from "./useAnnouncement";
import { createWatchAdapter } from "../live/createWatchAdapter";
import type { WatchAdapter } from "../live/WatchAdapter";
import { formatSdkError } from "../utils/sdk";

export interface ConsoleSessionOptions {
  activityId: MaybeRefOrGetter<string>;
  /**
   * 可选覆盖展示昵称。省略或空串时不传 Query nickname，
   * 由 `/console/sdk-sign` 按本场 activity_member → 员工姓名解析（D110）。
   */
  getNickname?: () => string;
  /** SDK 进出推送（名单本地改在线态）。不写库，落库只走微吼回调。 */
  onPresenceOnline?: (msg: VhallUserPresenceMessage) => void;
  onPresenceOffline?: (msg: VhallUserPresenceMessage) => void;
}

function resolveId(id: MaybeRefOrGetter<string>): string {
  return typeof id === "function" ? id() : unref(id);
}

export function useConsoleSession(opts: ConsoleSessionOptions) {
  const loading = ref(true);
  const error = ref("");
  const data = ref<ConsoleSummaryData | null>(null) as Ref<ConsoleSummaryData | null>;
  const sign = ref<ConsoleSdkSignData | null>(null) as Ref<ConsoleSdkSignData | null>;
  const sdkFailed = ref(false);
  const showLiveStartPopup = ref(false);

  let adapter: WatchAdapter | null = null;
  const getSdk = () => adapter?.getSdk() ?? null;
  const AUTO_RETRY_RETRYABLE_SDK = false;
  let sdkRetryCount = 0;
  const SDK_MAX_RETRIES = 2;
  let sdkRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let initEpoch = 0;
  let moduleReadyEpoch = -1;

  const { countdown, start: startCountdown, stop: stopCountdown } = useCountdown();
  let reportSentChat: (text: string) => void = () => {};
  const barrage = useBarrage(getSdk, (text) => reportSentChat(text));
  const chat = useChat({
    getSdk,
    getSender: () => {
      const head = sign.value?.sdk?.head?.trim() || "";
      return {
        id:
          sign.value?.sdk?.account ||
          (sign.value?.employeeId != null ? String(sign.value.employeeId) : ""),
        // 与 SDK init username/head 同源：以签名响应为准（本场成员 → 员工 → 助理）
        name: sign.value?.nickname?.trim() || opts.getNickname?.()?.trim() || "助理",
        avatar: head || undefined,
      };
    },
    onIncoming: (msg) => {
      const text = msg.msg?.trim();
      if (text) barrage.spawnDanmaku(text);
    },
    getActivityId: () => resolveId(opts.activityId),
    /** 无观众 JWT → 评论上报在 useChat 内跳过（soft-fail） */
    getViewerId: () => null,
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
  const canPlayReplay = computed(() => false);
  /** 与 live-web 同：仅直播中标「已进房」；结束壳 SDK 仍在，历史靠 moduleReady */
  const sdkReady = computed(() => !!adapter?.getSdk() && !sdkFailed.value && isLive.value);

  function shouldInitSdk(res: ConsoleSummaryData): boolean {
    return res.state === 1 || res.state === 2 || res.state === 3 || res.state === 4 || res.state === 5;
  }

  function isEndedLikeState(state: number | undefined | null): boolean {
    return state === 3 || state === 4 || state === 5;
  }

  function hasLiveSdk(): boolean {
    return !!adapter?.getSdk() && !sdkFailed.value;
  }

  function buildSignParams(): ConsoleSdkSignParams {
    const params: ConsoleSdkSignParams = {};
    const nickname = opts.getNickname?.()?.trim() ?? "";
    if (nickname) params.nickname = nickname;
    return params;
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
   * afterInit：结束壳只保活听 live_start，不指望出画面；勿轮询后标「长时间未就绪」。
   * 仍 resetHistoryLoad，供随后 moduleReady → scheduleLoadHistory。
   */
  function beginAfterInitSideEffects(epoch: number) {
    if (epoch !== initEpoch) return;
    chat.resetHistoryLoad();
    if (isEndedLikeState(data.value?.state)) {
      player.waitingForMedia = false;
      player.mediaFailed = false;
      player.needsTapToPlay = false;
      player.isPaused = false;
      player.failReason = "";
      return;
    }
    player.waitingForMedia = true;
    player.mediaFailed = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    window.setTimeout(() => {
      if (epoch !== initEpoch) return;
      if (!player.waitingForMedia || player.mediaFailed || player.needsTapToPlay) return;
      if (isEndedLikeState(data.value?.state)) {
        player.waitingForMedia = false;
        player.mediaFailed = false;
        return;
      }
      player.startPlayPoll(16);
    }, 2500);
  }

  /**
   * moduleReady：对齐 demo / live-web，再拉聊天历史（vhall_get_live_history_chat_msg）与公告。
   * 结束壳同样走这条，不另开 admin chat-history API。
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

  async function initSdk(signData: ConsoleSdkSignData) {
    if (!data.value) return;
    const epoch = ++initEpoch;
    sign.value = signData;
    // 先关 loading，让 ConsoleRoomView 挂上 PlayerStage（#player/#docWrap）；结束壳也必须挂
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
          // 结束壳保活 SDK：云侧无画面属预期，勿盖「加载失败」
          if (isEndedLikeState(data.value?.state)) return;
          player.markMediaFailed(formatSdkError(msg));
          sdkFailed.value = true;
        },
        onRetryableError: (text) => {
          if (epoch !== initEpoch) return;
          if (isEndedLikeState(data.value?.state)) return;
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
          if (isEndedLikeState(data.value?.state)) return;
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
          if (isEndedLikeState(data.value?.state)) {
            player.waitingForMedia = false;
            player.mediaFailed = false;
            player.failReason = "";
            return;
          }
          player.onPlayerReady();
        },
        onPlayerLoaded: () => {
          if (epoch !== initEpoch) return;
          if (isEndedLikeState(data.value?.state)) {
            player.waitingForMedia = false;
            player.mediaFailed = false;
            player.failReason = "";
            return;
          }
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
    const signRes = await getConsoleSdkSign(resolveId(opts.activityId), buildSignParams());
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
      const summary = await getConsoleSummary(resolveId(opts.activityId));
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

  async function switchToEndedFromLive() {
    stats.markLiveEnded();
    showLiveStartPopup.value = false;
    player.pausePlayback();
    player.waitingForMedia = false;
    player.mediaFailed = false;
    player.failReason = "";
    player.needsTapToPlay = false;
    const id = resolveId(opts.activityId);
    try {
      const summary = await getConsoleSummary(id);
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
    loading.value = true;
    error.value = "";
    sdkFailed.value = false;
    sdkRetryCount = 0;
    data.value = null;
    sign.value = null;
    showLiveStartPopup.value = false;
    stopCountdown();
    stats.resetLiveEnded();
    chat.chatMessages = [];
    destroySdk();
    try {
      const summary = await getConsoleSummary(resolveId(opts.activityId));
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
          if (isEndedLikeState(summary.state)) {
            console.warn("[console] ended-like sdk init failed, keep ended shell", e);
            loading.value = false;
            return;
          }
          throw e;
        }
      } else {
        loading.value = false;
      }
    } catch (e) {
      sdkFailed.value = true;
      error.value = e instanceof Error ? e.message : "加载失败";
      loading.value = false;
    }
  }

  function dispose() {
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
    dispose,
  };
}
