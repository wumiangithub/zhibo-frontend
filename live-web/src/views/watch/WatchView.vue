<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  getWatchSdk,
  getStoredGuestId,
  storeGuestId,
  getStoredNickname,
  storeNickname,
  type WatchSdkData,
} from "@/api/watch";
import NicknameForm from "@/components/watch/NicknameForm.vue";
import PreviewScreen from "@/components/watch/PreviewScreen.vue";
import EndedScreen from "@/components/watch/EndedScreen.vue";
import PlayerStage from "@/components/watch/PlayerStage.vue";
import ChatPanel from "@/components/watch/ChatPanel.vue";
import BarragePanel from "@/components/watch/BarragePanel.vue";
import { useCountdown } from "@/composables/useCountdown";
import { useBarrage } from "@/composables/useBarrage";
import { useChat } from "@/composables/useChat";
import { useRoomStats } from "@/composables/useRoomStats";
import { usePlayerControls } from "@/composables/usePlayerControls";
import { useAnnouncement } from "@/composables/useAnnouncement";
import { formatSdkError, loadScript } from "@/utils/sdk";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const data = ref<WatchSdkData | null>(null);
const sdkFailed = ref(false);
const useFallback = ref(false);

const showNicknameForm = ref(!getStoredNickname());
const nicknameSaving = ref(false);

const activeTab = ref<"chat" | "intro" | "barrage">("chat");
const showLiveStartPopup = ref(false);

let sdkInstance: VhallSdkInstance | null = null;
const getSdk = () => sdkInstance;

const { countdown, start: startCountdown, stop: stopCountdown } = useCountdown();
const barrage = useBarrage(getSdk);
const chat = useChat({
  getSdk,
  getSender: () => ({ id: data.value?.guestId || "", name: data.value?.nickname || "我" }),
  // 微吼 openBarrage 语义：收到聊天信息也显示为弹幕；重复回声/乐观上屏由 spawnDanmaku 内部去重
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

const isLive = computed(() => data.value?.state === 1);
const isPreview = computed(() => data.value?.state === 2);
const isEnded = computed(() => data.value?.state === 3);
const isReplay = computed(() => data.value?.state === 4 || data.value?.state === 5);
/** type=1 音频直播：浏览器常因自动播放策略把音轨挂起 */
const isAudioLive = computed(() => data.value?.type === 1);

function handleLiveStart() {
  if (isPreview.value) {
    showLiveStartPopup.value = true;
  }
}

function enterLive() {
  showLiveStartPopup.value = false;
  void load();
}

async function shareWatch() {
  const url = `${window.location.origin}/watch/${id}`;
  try {
    await navigator.clipboard.writeText(url);
    alert("观看链接已复制");
  } catch {
    prompt("复制观看链接：", url);
  }
}

function showGiftPlaceholder() {
  alert("礼物功能即将上线");
}

function destroySdk() {
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  sdkInstance = null;
}

async function switchToEndedFromLive() {
  player.resetPlayback();
  destroySdk();
  try {
    const res = await getWatchSdk(id, buildWatchParams());
    // 微吼状态可能略慢一拍；先强制进结束 UI，时间字段用最新接口
    data.value = { ...res, state: res.state === 1 ? 3 : res.state };
  } catch {
    if (data.value) {
      data.value = { ...data.value, state: 3 };
    } else {
      // API 也失败时，给一个最小 data 让结束态 UI 能渲染
      data.value = { id, state: 3, title: "", nickname: "", guestId: "" } as WatchSdkData;
    }
  }
}

async function initSdk() {
  if (!data.value) return;
  const res = data.value;

  loading.value = false;
  player.resetPlayback();
  await nextTick();

  if (res.sdk.jqueryUrl) {
    await loadScript(res.sdk.jqueryUrl);
  }
  await loadScript(res.sdk.scriptUrl);

  if (!window.VhallSDK) {
    throw new Error("SDK 加载异常，未找到 VhallSDK（需 3.9.1）");
  }

  sdkInstance = new window.VhallSDK({
    app_key: res.sdk.appKey,
    signedat: res.sdk.signedAt,
    webinar_id: res.sdk.webinarId,
    email: res.sdk.email,
    username: res.sdk.username,
    sign: res.sdk.sign,
    sign_type: res.sdk.signType ?? 0,
    videoContent: "#player",
    docContent: "#docWrap",
  });

  // SDK 运行时错误（如 20005）可能是临时连接问题，不显示错误页面，只记录日志让 SDK 自行恢复
  sdkInstance.$on("error", (msg: unknown) => {
    console.warn("SDK 运行时错误:", formatSdkError(msg));
  });

  // 官方：H5 活动直播结束 → live_over（见 Apifox 全局事件）；streamOver 为旧 Flash 事件，一并听作兜底
  const onLiveEnded = () => {
    void switchToEndedFromLive();
  };
  sdkInstance.$on("live_over", onLiveEnded);
  sdkInstance.$on("streamOver", onLiveEnded);

  // 自动播放失败时直接出「点击收听/播放」（比轮询更准）
  sdkInstance.$on("vhallplay_AUTOPLAY_FAILED", () => player.notifyAutoplayFailed());

  sdkInstance.$on("chatMsg", chat.handleChatMessage);
  sdkInstance.$on("chatDelete", chat.handleChatDelete);
  sdkInstance.$on("disableChat", () => chat.setMuted(true));
  sdkInstance.$on("permitChat", () => chat.setMuted(false));
  sdkInstance.$on("room_announcement", notice.handleAnnouncement);
  sdkInstance.$on("live_start", handleLiveStart);
  sdkInstance.$on("onlinePopulation", stats.handleOnlinePopulation);
  sdkInstance.$on("EVENT_PRAISE_TOTAL", stats.handlePraiseTotal);

  // SDK 的 JSONP 回调名按毫秒时间戳生成，并发调用会同名互踩，
  // 导致先发起的请求 Promise 永不 settle，必须串行加载
  void chat.loadChatHistory().then(() => notice.loadHistory());

  stats.scheduleRoomId();
  // 控制栏由 SDK 异步生成，等播放器就绪后改写下拉文案并标初始选中态
  player.scheduleQualityLabels();
  // 进房默认不播放：直接出「点击播放」遮罩，等用户点击（手势链内）才 resumePlayback 出声
  player.needsTapToPlay = true;
  player.startPlayPoll();
}

function buildWatchParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const guestId = getStoredGuestId();
  const nickname = getStoredNickname();
  if (guestId) params.guestId = guestId;
  if (nickname) params.nickname = nickname;
  return params;
}

async function load() {
  loading.value = true;
  error.value = "";
  sdkFailed.value = false;
  useFallback.value = false;
  data.value = null;
  stopCountdown();
  destroySdk();
  try {
    const res = await getWatchSdk(id, buildWatchParams());
    storeGuestId(res.guestId);
    data.value = res;

    if (res.state === 2 && res.startTime) {
      startCountdown(res.startTime);
      await initSdk();
    } else if (res.state === 1) {
      await initSdk();
    } else {
      loading.value = false;
    }
  } catch (e) {
    sdkFailed.value = true;
    error.value = e instanceof Error ? e.message : "加载失败";
    loading.value = false;
  }
}

function switchToFallback() {
  useFallback.value = true;
  error.value = "";
}

async function saveNickname(name: string) {
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await load();
}

function skipNickname() {
  showNicknameForm.value = false;
  void load();
}

function changeNickname() {
  showNicknameForm.value = true;
}

watch(
  () => data.value?.state,
  (newState) => {
    if (newState === 2 && data.value?.startTime) {
      startCountdown(data.value.startTime);
    } else {
      stopCountdown();
    }
  },
);

onMounted(() => {
  if (!showNicknameForm.value) {
    void load();
  }
});

onBeforeUnmount(destroySdk);
</script>

<template>
  <div class="flex h-dvh flex-col bg-black text-white">
    <div class="flex min-h-0 flex-1 flex-col">
      <NicknameForm
        v-if="showNicknameForm"
        :saving="nicknameSaving"
        @save="saveNickname"
        @skip="skipNickname"
      />

      <template v-else>
        <div class="flex flex-none items-center justify-between gap-4 border-b border-gray-800 px-4 py-2">
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="truncate text-sm font-semibold text-white">
              {{ data?.title || '直播' }}
            </h1>
            <span
              v-if="data && isLive"
              class="inline-flex flex-none items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
              直播中
            </span>
          </div>
          <div class="flex flex-none items-center gap-3">
            <span class="flex items-center gap-1 text-xs text-gray-300">
              <span class="h-2 w-2 rounded-full bg-green-500"></span>
              {{ stats.onlineCount }}
            </span>
            <p class="text-xs text-gray-400">
              昵称：<span class="text-gray-200">{{ data?.nickname || getStoredNickname() || '观众' }}</span>
            </p>
            <button
              class="bg-transparent text-xs text-gray-500 hover:text-gray-300"
              @click="changeNickname"
            >
              修改
            </button>
          </div>
        </div>

        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          加载中…
        </div>

        <div
          v-else-if="error && !useFallback"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
          <div class="flex gap-3">
            <button
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="load"
            >
              重试
            </button>
            <button
              v-if="sdkFailed && data?.embedUrl"
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="switchToFallback"
            >
              切换嵌入模式
            </button>
          </div>
        </div>

        <div
          v-else-if="data && useFallback"
          class="flex flex-1 items-center justify-center"
        >
          <iframe
            :src="data.embedUrl"
            class="h-full w-full flex-1 border-0"
            allowfullscreen
            allow="fullscreen; microphone; camera; autoplay; display-capture"
          />
        </div>

        <PreviewScreen
          v-else-if="data && isPreview"
          :data="data"
          :countdown="countdown"
          :show-live-start-popup="showLiveStartPopup"
          @enter="enterLive"
        />

        <EndedScreen
          v-else-if="data && (isEnded || isReplay)"
          :data="data"
        />

        <div
          v-else-if="data && isLive"
          class="flex min-h-0 flex-1 flex-col"
        >
          <!-- 公告横幅 -->
          <div
            v-if="notice.text"
            class="flex flex-none items-center gap-2 bg-amber-600/90 px-4 py-2 text-sm text-white"
          >
            <span class="font-medium">公告</span>
            <span class="flex-1 truncate">{{ notice.text }}</span>
            <button
              class="bg-transparent text-white/70 hover:text-white"
              @click="notice.clear"
            >
              ✕
            </button>
          </div>

          <div class="flex min-h-0 flex-1 flex-row">
            <PlayerStage
              :player="player"
              :barrage="barrage"
              :stats="stats"
              :title="data.title"
              :is-audio-live="isAudioLive"
              @share="shareWatch"
              @gift="showGiftPlaceholder"
            />

            <!-- 互动区域（PC） -->
            <div class="flex min-h-0 w-[360px] flex-none flex-col border-l border-gray-800 bg-gray-900">
              <!-- 标签栏 -->
              <div class="flex flex-none border-b border-gray-800">
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'chat' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'chat'"
                >
                  聊天
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'barrage' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'barrage'"
                >
                  弹幕
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'intro' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'intro'"
                >
                  简介
                </button>
              </div>

              <ChatPanel
                v-if="activeTab === 'chat'"
                :chat="chat"
              />
              <BarragePanel
                v-else-if="activeTab === 'barrage'"
                :barrage="barrage"
              />

              <!-- 简介 -->
              <div
                v-else
                class="min-h-0 flex-1 overflow-y-auto p-4"
              >
                <h3 class="mb-3 text-base font-semibold text-white">{{ data.title }}</h3>
                <div class="space-y-2 text-sm text-gray-400">
                  <p>
                    <span class="text-gray-500">开始时间：</span>
                    <span>{{ data.startTime }}</span>
                  </p>
                  <p v-if="data.endTime">
                    <span class="text-gray-500">结束时间：</span>
                    <span>{{ data.endTime }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
