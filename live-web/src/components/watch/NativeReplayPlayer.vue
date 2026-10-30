<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  src: string;
  title?: string;
  speedAllow?: boolean;
  fastForwardAllow?: boolean;
}>();

const emit = defineEmits<{
  play: [];
  pause: [];
  ended: [];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(0);
const rate = ref(1);
const showRates = ref(false);
const isFullscreen = ref(false);
/** CSS 伪全屏（Fullscreen API 不可用时） */
const pseudoFullscreen = ref(false);
/** 禁止快进时：已观看到的最大进度（秒） */
const maxWatched = ref(0);

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const progressPct = computed(() =>
  duration.value > 0 ? Math.min(100, (current.value / duration.value) * 100) : 0,
);

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function bindVideo(el: HTMLVideoElement | null) {
  if (!el) return;
  el.playbackRate = rate.value;
}

function onTimeUpdate() {
  const el = videoRef.value;
  if (!el) return;
  current.value = el.currentTime;
  if (!props.fastForwardAllow) {
    if (el.currentTime > maxWatched.value + 0.35) {
      el.currentTime = maxWatched.value;
      current.value = maxWatched.value;
      return;
    }
    if (el.currentTime > maxWatched.value) {
      maxWatched.value = el.currentTime;
    }
  }
}

function onLoadedMeta() {
  const el = videoRef.value;
  if (!el) return;
  duration.value = el.duration || 0;
}

function onPlay() {
  playing.value = true;
  emit("play");
}

function onPause() {
  playing.value = false;
  emit("pause");
}

function onEnded() {
  playing.value = false;
  emit("ended");
}

function togglePlay() {
  const el = videoRef.value;
  if (!el) return;
  if (el.paused) void el.play();
  else el.pause();
}

function onSeekInput(e: Event) {
  const el = videoRef.value;
  if (!el || !props.fastForwardAllow) return;
  const t = Number((e.target as HTMLInputElement).value);
  if (!Number.isFinite(t)) return;
  el.currentTime = t;
  current.value = t;
}

function setRate(v: number) {
  if (!props.speedAllow) return;
  rate.value = v;
  const el = videoRef.value;
  if (el) el.playbackRate = v;
  showRates.value = false;
}

function syncFullscreenFlag() {
  const docFs = !!document.fullscreenElement;
  const video = videoRef.value as HTMLVideoElement & {
    webkitDisplayingFullscreen?: boolean;
  } | null;
  const iosFs = !!video?.webkitDisplayingFullscreen;
  isFullscreen.value = docFs || iosFs || pseudoFullscreen.value;
}

function applyPseudoFullscreen(on: boolean) {
  pseudoFullscreen.value = on;
  isFullscreen.value = on || !!document.fullscreenElement;
  if (typeof document !== "undefined") {
    document.body.style.overflow = on ? "hidden" : "";
  }
}

async function enterFullscreen() {
  const video = videoRef.value as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitRequestFullscreen?: () => Promise<void> | void;
  } | null;
  const stage = stageRef.value as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  } | null;

  // iOS Safari / 微信：优先系统 video 全屏
  if (video && typeof video.webkitEnterFullscreen === "function") {
    try {
      video.webkitEnterFullscreen();
      return;
    } catch {
      /* fall through */
    }
  }

  const target = stage || video;
  if (target && typeof target.requestFullscreen === "function") {
    try {
      await target.requestFullscreen();
      return;
    } catch {
      /* fall through */
    }
  }
  if (target && typeof target.webkitRequestFullscreen === "function") {
    try {
      await target.webkitRequestFullscreen();
      return;
    } catch {
      /* fall through */
    }
  }
  applyPseudoFullscreen(true);
}

async function exitFullscreen() {
  const video = videoRef.value as HTMLVideoElement & {
    webkitExitFullscreen?: () => void;
    webkitDisplayingFullscreen?: boolean;
  } | null;
  if (video?.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === "function") {
    try {
      video.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
  }
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }
  applyPseudoFullscreen(false);
}

function toggleFullscreen() {
  if (isFullscreen.value) void exitFullscreen();
  else void enterFullscreen();
}

function onFsKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") applyPseudoFullscreen(false);
}

watch(
  () => props.src,
  () => {
    current.value = 0;
    duration.value = 0;
    maxWatched.value = 0;
    playing.value = false;
    rate.value = 1;
    void exitFullscreen();
  },
);

watch(
  () => props.speedAllow,
  (allow) => {
    if (allow === false) {
      rate.value = 1;
      const el = videoRef.value;
      if (el) el.playbackRate = 1;
    }
  },
);

onMounted(() => {
  bindVideo(videoRef.value);
  document.addEventListener("fullscreenchange", syncFullscreenFlag);
  document.addEventListener("keydown", onFsKeydown);
  const video = videoRef.value;
  if (video) {
    video.addEventListener("webkitbeginfullscreen", syncFullscreenFlag);
    video.addEventListener("webkitendfullscreen", syncFullscreenFlag);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", syncFullscreenFlag);
  document.removeEventListener("keydown", onFsKeydown);
  const video = videoRef.value;
  if (video) {
    video.removeEventListener("webkitbeginfullscreen", syncFullscreenFlag);
    video.removeEventListener("webkitendfullscreen", syncFullscreenFlag);
  }
  if (pseudoFullscreen.value) applyPseudoFullscreen(false);
  const el = videoRef.value;
  if (el && !el.paused) el.pause();
});
</script>

<template>
  <div
    class="relative flex w-full flex-col bg-black"
    :class="{ 'replay-pseudo-fs': pseudoFullscreen }"
  >
    <div
      ref="stageRef"
      class="relative aspect-video w-full overflow-hidden bg-black md:mx-auto md:max-w-5xl"
      :class="{ 'replay-stage-fs': pseudoFullscreen }"
      @click="togglePlay"
    >
      <video
        ref="videoRef"
        class="h-full w-full object-contain"
        :src="src"
        playsinline
        webkit-playsinline
        preload="metadata"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMeta"
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
      />
      <div
        v-if="!playing"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-2xl text-white md:h-16 md:w-16"
        >
          ▶
        </span>
      </div>
    </div>

    <div
      class="flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 px-3 py-2 md:mx-auto md:w-full md:max-w-5xl"
      @click.stop
    >
      <div class="flex items-center gap-2 text-xs text-gray-300">
        <span class="w-12 tabular-nums">{{ formatTime(current) }}</span>
        <input
          class="h-1.5 min-w-0 flex-1 accent-blue-500 disabled:opacity-40"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.1"
          :value="current"
          :disabled="!fastForwardAllow || duration <= 0"
          :style="{ '--p': progressPct + '%' }"
          @input="onSeekInput"
        >
        <span class="w-12 text-right tabular-nums">{{ formatTime(duration) }}</span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          @click="togglePlay"
        >
          {{ playing ? "暂停" : "播放" }}
        </button>

        <div class="flex items-center gap-2">
          <div
            v-if="speedAllow"
            class="relative"
          >
            <button
              type="button"
              class="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
              @click="showRates = !showRates"
            >
              {{ rate === 1 ? "倍速" : `${rate}x` }}
            </button>
            <div
              v-if="showRates"
              class="absolute bottom-full right-0 z-10 mb-1 min-w-[5rem] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-lg"
            >
              <button
                v-for="opt in SPEED_OPTIONS"
                :key="opt"
                type="button"
                class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-800"
                :class="opt === rate ? 'text-blue-400' : 'text-gray-200'"
                @click="setRate(opt)"
              >
                {{ opt }}x
              </button>
            </div>
          </div>
          <span
            v-else
            class="text-xs text-gray-500"
          >倍速已关闭</span>

          <button
            type="button"
            class="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
            :title="isFullscreen ? '退出全屏' : '全屏'"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? "退出全屏" : "全屏" }}
          </button>
        </div>
      </div>

      <p
        v-if="!fastForwardAllow"
        class="text-center text-[11px] text-gray-500"
      >
        已禁止快进，请按进度完整观看
      </p>
    </div>
  </div>
</template>

<style scoped>
.replay-pseudo-fs {
  position: fixed;
  inset: 0;
  z-index: 100;
  justify-content: center;
  background: #000;
}
.replay-stage-fs {
  max-width: none !important;
  width: 100%;
  height: auto;
  flex: 1;
  aspect-ratio: auto;
  display: flex;
  align-items: center;
}
.replay-stage-fs video {
  max-height: calc(100dvh - 5.5rem);
}
</style>
