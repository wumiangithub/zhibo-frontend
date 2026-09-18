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

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const data = ref<WatchSdkData | null>(null);
const sdkReady = ref(false);
const sdkFailed = ref(false);
const useFallback = ref(false);

const nicknameInput = ref(getStoredNickname());
const showNicknameForm = ref(!getStoredNickname());
const nicknameSaving = ref(false);

const countdown = ref("");
let countdownTimer: ReturnType<typeof setInterval> | null = null;

let sdkInstance: VhallSdkInstance | null = null;

async function switchToEndedFromLive() {
  stopPlayPoll();
  needsTapToPlay.value = false;
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
    sdkInstance = null;
  }
  sdkReady.value = false;
  try {
    const guestId = getStoredGuestId();
    const nickname = getStoredNickname() || undefined;
    const params: Record<string, string> = {};
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    const res = await getWatchSdk(id, params);
    // 微吼状态可能略慢一拍；先强制进结束 UI，时间字段用最新接口
    data.value = {
      ...res,
      state: res.state === 1 ? 3 : res.state,
    };
  } catch {
    if (data.value) {
      data.value = { ...data.value, state: 3 };
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(el);
  });
}

function formatSdkError(msg: unknown): string {
  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { msg?: string };
      return parsed.msg || msg;
    } catch {
      return msg;
    }
  }
  if (msg && typeof msg === "object" && "msg" in msg) {
    return String((msg as { msg?: string }).msg || JSON.stringify(msg));
  }
  if (msg != null) {
    return JSON.stringify(msg);
  }
  return "SDK 错误";
}

function startCountdown(startTime: string) {
  stopCountdown();
  const target = new Date(startTime.replace(" ", "T")).getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) {
      countdown.value = "即将开播";
      stopCountdown();
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (hours > 0) {
      countdown.value = `${hours}时${minutes}分${seconds}秒`;
    } else if (minutes > 0) {
      countdown.value = `${minutes}分${seconds}秒`;
    } else {
      countdown.value = `${seconds}秒`;
    }
  }

  update();
  countdownTimer = setInterval(update, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

const isLive = computed(() => data.value?.state === 1);
const isPreview = computed(() => data.value?.state === 2);
const isEnded = computed(() => data.value?.state === 3);
const isReplay = computed(() => data.value?.state === 4 || data.value?.state === 5);
/** type=1 音频直播：浏览器常因自动播放策略把音轨挂起 */
const isAudioLive = computed(() => data.value?.type === 1);

const needsTapToPlay = ref(false);
let playPollTimer: ReturnType<typeof setInterval> | null = null;

function findPlayerMedia(): HTMLMediaElement | null {
  return (
    document.querySelector<HTMLMediaElement>("#player video") ||
    document.querySelector<HTMLMediaElement>("#player audio") ||
    document.querySelector<HTMLMediaElement>("#player-vhall-video")
  );
}

function stopPlayPoll() {
  if (playPollTimer) {
    clearInterval(playPollTimer);
    playPollTimer = null;
  }
}

function startPlayPoll() {
  stopPlayPoll();
  let tries = 0;
  playPollTimer = setInterval(() => {
    tries += 1;
    const media = findPlayerMedia();
    if (media) {
      // readyState>=2 有数据但仍 paused → 多半被自动播放策略拦住
      if (media.paused && media.readyState >= 2) {
        needsTapToPlay.value = true;
        stopPlayPoll();
        return;
      }
      if (!media.paused) {
        needsTapToPlay.value = false;
        stopPlayPoll();
        return;
      }
    }
    if (tries >= 40) {
      // 约 20s 仍无播放，仍提示点击（语音直播尤其需要）
      needsTapToPlay.value = true;
      stopPlayPoll();
    }
  }, 500);
}

async function resumePlayback() {
  const media = findPlayerMedia();
  if (!media) {
    needsTapToPlay.value = true;
    return;
  }
  try {
    media.muted = false;
    media.volume = Math.max(media.volume, 0.5);
    await media.play();
    needsTapToPlay.value = false;
  } catch (e) {
    needsTapToPlay.value = true;
    error.value = e instanceof Error ? e.message : "无法自动播放，请再点一次「点击收听」";
  }
}

async function initSdk() {
  if (!data.value) return;
  const res = data.value;

  loading.value = false;
  needsTapToPlay.value = false;
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

  sdkInstance.$on("error", (msg: unknown) => {
    sdkFailed.value = true;
    error.value = formatSdkError(msg);
  });

  // 官方：H5 活动直播结束 → live_over（见 Apifox 全局事件）
  // streamOver 为旧 Flash 事件，一并听作兜底
  const onLiveEnded = () => {
    void switchToEndedFromLive();
  };
  sdkInstance.$on("live_over", onLiveEnded);
  sdkInstance.$on("streamOver", onLiveEnded);

  // 自动播放失败时直接出「点击收听/播放」（比轮询更准）
  sdkInstance.$on("vhallplay_AUTOPLAY_FAILED", () => {
    needsTapToPlay.value = true;
  });

  sdkReady.value = true;
  // 脚本加载异步，进房后 media.play 往往不在用户手势链上 → 语音直播会静音/暂停
  startPlayPoll();
  // 尽早尝试一次（部分浏览器仍可能允许）
  setTimeout(() => {
    void resumePlayback().catch(() => {
      needsTapToPlay.value = true;
    });
  }, 800);
}

async function load() {
  loading.value = true;
  error.value = "";
  sdkReady.value = false;
  sdkFailed.value = false;
  useFallback.value = false;
  data.value = null;
  stopCountdown();
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
    sdkInstance = null;
  }
  try {
    const guestId = getStoredGuestId();
    const nickname = getStoredNickname() || undefined;
    const params: Record<string, string> = {};
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    const res = await getWatchSdk(id, params);
    storeGuestId(res.guestId);
    data.value = res;

    if (res.state === 2 && res.startTime) {
      startCountdown(res.startTime);
      loading.value = false;
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

async function saveNickname() {
  const name = nicknameInput.value.trim();
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await load();
}

function changeNickname() {
  nicknameInput.value = getStoredNickname();
  showNicknameForm.value = true;
}

watch(() => data.value?.state, (newState) => {
  if (newState === 2 && data.value?.startTime) {
    startCountdown(data.value.startTime);
  } else {
    stopCountdown();
  }
});

onMounted(() => {
  if (!showNicknameForm.value) {
    load();
  }
});

onBeforeUnmount(() => {
  stopCountdown();
  stopPlayPoll();
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  sdkInstance = null;
});
</script>

<template>
  <div class="min-h-dvh bg-black text-white md:flex md:items-center md:justify-center md:bg-gray-900">
    <div
      class="flex min-h-dvh flex-col md:min-h-0 md:aspect-video md:w-[960px] md:max-w-full md:overflow-hidden md:rounded-lg"
    >
      <div
        v-if="showNicknameForm"
        class="flex flex-1 flex-col items-center justify-center gap-4 p-6"
      >
        <h2 class="text-lg font-semibold text-green-400">进入观看</h2>
        <p class="text-sm text-gray-400">设置你的昵称（可选，默认「观众」）</p>
        <div class="flex items-center gap-2">
          <input
            v-model="nicknameInput"
            type="text"
            maxlength="50"
            placeholder="观众"
            class="w-48 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            @keyup.enter="saveNickname"
          />
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            :disabled="nicknameSaving"
            @click="saveNickname"
          >
            进入
          </button>
        </div>
        <button
          class="text-sm text-gray-500 hover:text-gray-300"
          @click="() => { showNicknameForm = false; load(); }"
        >
          跳过，使用默认昵称
        </button>
      </div>

      <template v-else>
        <div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
          <p class="text-sm text-gray-400">
            昵称：<span class="text-gray-200">{{ data?.nickname || getStoredNickname() || '观众' }}</span>
          </p>
          <button
            class="text-xs text-gray-500 hover:text-gray-300"
            @click="changeNickname"
          >
            修改
          </button>
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
              class="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              @click="load"
            >
              重试
            </button>
            <button
              v-if="sdkFailed && data?.embedUrl"
              class="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
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

        <div
          v-else-if="data && isPreview"
          class="relative flex flex-1 flex-col"
        >
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center">
            <p class="text-lg font-semibold text-amber-400">距离开播还有</p>
            <p class="text-3xl font-mono font-bold text-white">{{ countdown }}</p>
            <p class="text-sm text-gray-400">
              开始时间：{{ data.startTime }}
            </p>
          </div>

          <div
            id="player"
            class="min-h-0 w-full flex-1 opacity-0"
          />
          <div
            id="docWrap"
            class="hidden"
          />
        </div>

        <div
          v-else-if="data && (isEnded || isReplay)"
          class="relative flex flex-1 flex-col"
        >
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center">
            <div class="flex flex-col items-center gap-2">
              <span class="inline-flex items-center gap-2 rounded-full bg-gray-700/50 px-3 py-1 text-xs font-medium text-gray-400">
                <span class="h-2 w-2 rounded-full bg-gray-500"></span>
                直播已结束
              </span>
              <h2 class="mt-2 text-xl font-semibold text-white">{{ data.title }}</h2>
            </div>

            <div class="mt-4 rounded-lg bg-gray-800/50 px-6 py-4">
              <p class="text-sm text-gray-400">
                直播时间
              </p>
              <p class="mt-1 text-base font-medium text-gray-200">
                {{ data.startTime }}
              </p>
              <template v-if="data.endTime">
                <p class="text-xs text-gray-500">至</p>
                <p class="text-base font-medium text-gray-200">
                  {{ data.endTime }}
                </p>
              </template>
            </div>

            <p class="text-xs text-gray-500">
              感谢观看
            </p>
          </div>

          <div
            id="player"
            class="min-h-0 w-full flex-1 opacity-0"
          />
          <div
            id="docWrap"
            class="hidden"
          />
        </div>

        <div
          v-else-if="data && isLive"
          class="relative flex flex-1 flex-col"
        >
          <button
            v-if="needsTapToPlay"
            type="button"
            class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center"
            @click="resumePlayback"
          >
            <span class="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium hover:bg-green-700">
              {{ isAudioLive ? '点击收听' : '点击播放' }}
            </span>
            <span class="text-xs text-gray-300">
              {{ isAudioLive ? '浏览器限制自动出声，点一下即可听见直播' : '浏览器限制自动播放，点一下开始观看' }}
            </span>
          </button>

          <div
            v-if="isAudioLive"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6"
          >
            <div class="flex flex-col items-center gap-2">
              <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
                <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                直播中
              </span>
              <h2 class="mt-2 text-xl font-semibold text-white">{{ data.title }}</h2>
            </div>

            <div class="flex items-end gap-1">
              <span v-for="i in 5" :key="i" class="w-1.5 rounded-full bg-green-500" :style="{ height: `${20 + Math.random() * 40}px`, animation: `audioWave 1s ease-in-out ${i * 0.1}s infinite alternate` }"></span>
            </div>

            <p class="text-sm text-gray-400">
              正在播放音频直播
            </p>
          </div>

          <div
            id="player"
            class="min-h-0 w-full flex-1"
            :class="{ 'opacity-0': isAudioLive }"
          />
          <div
            id="docWrap"
            class="hidden"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@keyframes audioWave {
  0% {
    transform: scaleY(0.5);
  }
  100% {
    transform: scaleY(1);
  }
}
</style>
