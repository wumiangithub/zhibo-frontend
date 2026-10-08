import { computed, nextTick, onBeforeUnmount, ref, unref, type MaybeRefOrGetter, type Ref } from "vue";
import {
  getWatchSdk,
  getStoredGuestId,
  storeGuestId,
  type WatchSdkData,
} from "@/api/watch";
import { useCountdown } from "@/composables/useCountdown";
import { useBarrage } from "@/composables/useBarrage";
import { useChat } from "@/composables/useChat";
import { useRoomStats } from "@/composables/useRoomStats";
import { usePlayerControls } from "@/composables/usePlayerControls";
import { useAnnouncement } from "@/composables/useAnnouncement";
import { useAttendance, type AttendanceRole } from "@/composables/useAttendance";
import { createWatchAdapter } from "@/live/createWatchAdapter";
import type { WatchAdapter } from "@/live/WatchAdapter";
import { formatSdkError } from "@/utils/sdk";
import { useToast } from "@/composables/useToast";

export interface WatchSessionOptions {
  activityId: MaybeRefOrGetter<string>;
  role: AttendanceRole;
  /** SDK / 进入上报用昵称 */
  getNickname: () => string;
  /** 认出自己 Join 的候选昵称 */
  getMatchNicknames: () => string[];
  /** 进出推送额外回调（如中控台名单本地改在线态） */
  onPresenceOnline?: (msg: VhallUserPresenceMessage) => void;
  onPresenceOffline?: (msg: VhallUserPresenceMessage) => void;
}

function resolveId(id: MaybeRefOrGetter<string>): string {
  return typeof id === "function" ? id() : unref(id);
}

/**
 * 观看页与中控台共用：拉 /sdk、init 适配器、播放/聊天/弹幕/点赞/公告/进出上报。
 * 页面只负责布局壳与角色差异（viewer / assistant）。
 */
export function useWatchSession(opts: WatchSessionOptions) {
  const { toast } = useToast();
  const loading = ref(true);
  const error = ref("");
  const data = ref<WatchSdkData | null>(null) as Ref<WatchSdkData | null>;
  const sdkFailed = ref(false);
  const useFallback = ref(false);
  const showLiveStartPopup = ref(false);

  let adapter: WatchAdapter | null = null;
  const getSdk = () => adapter?.getSdk() ?? null;
  let sdkRetryCount = 0;
  const SDK_MAX_RETRIES = 2;
  let sdkRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const { countdown, start: startCountdown, stop: stopCountdown } = useCountdown();
  const barrage = useBarrage(getSdk);
  const chat = useChat({
    getSdk,
    getSender: () => ({
      id: data.value?.guestId || "",
      name: opts.getNickname() || data.value?.nickname || "我",
    }),
    onIncoming: (msg) => barrage.spawnDanmaku(msg.msg),
  });
  const stats = useRoomStats(getSdk);
  const notice = useAnnouncement(getSdk);
  const player = usePlayerControls({
    getSdk,
    onError: (msg) => {
      error.value = msg;
    },
  });
  const attendance = useAttendance(() => {
    if (!data.value) return null;
    // 进出推送里的 sender_id 常为 visit_v*，对不上本站 guestId；主要靠昵称认自己。
    // 跳过填昵称时 SDK username 默认为「观众」，必须纳入匹配，否则永远不上报 enter。
    const storedNick = opts.getNickname().trim();
    const sdkNick = data.value.nickname?.trim() || data.value.sdk?.username?.trim() || "";
    const matchNicknames = [
      ...opts.getMatchNicknames(),
      storedNick,
      sdkNick,
      "观众",
    ].filter((n, i, arr) => !!n && arr.indexOf(n) === i);
    return {
      activityId: resolveId(opts.activityId),
      provider: data.value.provider,
      guestId: data.value.guestId || getStoredGuestId(),
      nickname: storedNick || sdkNick || "观众",
      matchNicknames,
      role: opts.role,
    };
  });

  const isLive = computed(() => data.value?.state === 1);
  const isPreview = computed(() => data.value?.state === 2);
  const isEnded = computed(() => data.value?.state === 3);
  const isReplay = computed(() => data.value?.state === 4 || data.value?.state === 5);
  const isAudioLive = computed(() => data.value?.type === 1);
  const sdkReady = computed(() => !!adapter?.getSdk() && !sdkFailed.value && isLive.value);

  function buildWatchParams(): { guestId?: string; nickname?: string } {
    const params: { guestId?: string; nickname?: string } = {};
    const guestId = getStoredGuestId();
    const nickname = opts.getNickname().trim();
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    return params;
  }

  function handleLiveStart() {
    if (isPreview.value) showLiveStartPopup.value = true;
  }

  function destroySdk() {
    chat.cancelHistoryLoad();
    stats.cancelRoomId?.();
    if (sdkRetryTimer) {
      clearTimeout(sdkRetryTimer);
      sdkRetryTimer = null;
    }
    adapter?.destroy();
    adapter = null;
  }

  async function initSdk() {
    if (!data.value) return;
    loading.value = false;
    player.resetPlayback();
    await nextTick();

    try {
      adapter = createWatchAdapter(data.value.provider ?? "vhall");
      await adapter.init(data.value, {
        onError: (msg) => {
          player.markMediaFailed(formatSdkError(msg));
          sdkFailed.value = true;
        },
        onRetryableError: (text) => {
          if (data.value?.state === 1 || data.value?.state === 2) {
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
          void switchToEndedFromLive();
        },
        onAutoplayFailed: () => player.notifyAutoplayFailed(),
        onLiveStart: handleLiveStart,
        onChatMsg: chat.handleChatMessage,
        onChatDelete: chat.handleChatDelete,
        onDisableChat: () => chat.setMuted(true),
        onPermitChat: () => chat.setMuted(false),
        onAnnouncement: notice.handleAnnouncement,
        onOnlinePopulation: stats.handleOnlinePopulation,
        onPraiseTotal: stats.handlePraiseTotal,
        onUserOnline: (msg) => {
          void attendance.onUserOnline(msg);
          opts.onPresenceOnline?.(msg);
        },
        onUserOffline: (msg) => {
          void attendance.onUserOffline(msg);
          opts.onPresenceOffline?.(msg);
        },
        afterInit: () => {
          void chat.loadChatHistory().then(() => notice.loadHistory());
          stats.scheduleRoomId();
          player.scheduleQualityLabels();
          player.startPlayPoll();
        },
      });
    } catch (e) {
      adapter?.destroy();
      adapter = null;
      throw e;
    }
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
      const res = await getWatchSdk(resolveId(opts.activityId), buildWatchParams());
      storeGuestId(res.guestId);
      data.value = res;
      if (res.state === 3 || res.state === 4 || res.state === 5) {
        loading.value = false;
        attendance.stopOnLiveEnded();
        stats.markLiveEnded();
        return;
      }
      await initSdk();
    } catch (e) {
      player.markMediaFailed(e instanceof Error ? e.message : "重试加载失败");
      sdkFailed.value = true;
    }
  }

  async function switchToEndedFromLive() {
    attendance.stopOnLiveEnded();
    stats.markLiveEnded();
    player.resetPlayback();
    destroySdk();
    const id = resolveId(opts.activityId);
    try {
      const res = await getWatchSdk(id, buildWatchParams());
      data.value = { ...res, state: res.state === 1 ? 3 : res.state };
    } catch {
      if (data.value) {
        data.value = { ...data.value, state: 3 };
      } else {
        data.value = { id, state: 3, title: "", nickname: "", guestId: "" } as WatchSdkData;
      }
    }
  }

  async function load() {
    loading.value = true;
    error.value = "";
    sdkFailed.value = false;
    useFallback.value = false;
    sdkRetryCount = 0;
    data.value = null;
    stopCountdown();
    attendance.reset();
    stats.resetLiveEnded();
    destroySdk();
    try {
      const res = await getWatchSdk(resolveId(opts.activityId), buildWatchParams());
      storeGuestId(res.guestId);
      data.value = res;

      if (res.state === 2 && res.startTime) {
        startCountdown(res.startTime);
        await initSdk();
      } else if (res.state === 1) {
        await initSdk();
      } else {
        // 结束/回放：名单仍可看，进出停报；实时在线强制 0
        attendance.stopOnLiveEnded();
        stats.markLiveEnded();
        loading.value = false;
      }
    } catch (e) {
      sdkFailed.value = true;
      error.value = e instanceof Error ? e.message : "加载失败";
      loading.value = false;
    }
  }

  function enterLiveFromPreview() {
    showLiveStartPopup.value = false;
    void load();
  }

  function switchToFallback() {
    useFallback.value = true;
    error.value = "";
  }

  async function shareWatch() {
    const url = `${window.location.origin}/watch/${resolveId(opts.activityId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("观看链接已复制");
    } catch {
      toast("复制失败，请手动复制地址栏链接");
    }
  }

  function showGiftPlaceholder() {
    toast("礼物功能即将上线");
  }

  function dispose() {
    // SPA 卸载：刷 leave 队列并 leave 自己；整页刷新另有 pagehide keepalive
    attendance.flushPending();
    stopCountdown();
    destroySdk();
  }

  onBeforeUnmount(dispose);

  return {
    loading,
    error,
    data,
    sdkFailed,
    useFallback,
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
    isAudioLive,
    sdkReady,
    load,
    enterLiveFromPreview,
    switchToFallback,
    shareWatch,
    showGiftPlaceholder,
    dispose,
  };
}
