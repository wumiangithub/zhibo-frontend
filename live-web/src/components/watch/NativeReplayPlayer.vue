<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import SheetOptionList from "@/components/SheetOptionList.vue";
import { useWatchTheme } from "@/composables/useWatchTheme";

const { isLight, toggleTheme } = useWatchTheme();

const props = withDefaults(
  defineProps<{
    src: string;
    title?: string;
    speedAllow?: boolean;
    fastForwardAllow?: boolean;
    /**
     * 嵌入 WatchRoomShell：舞台始终 16:9（小屏 width 100%；PC 短边铺满，对齐 PlayerStage）。
     * 单独全页居中时勿开。
     */
    embedInRoom?: boolean;
  }>(),
  {
    speedAllow: true,
    fastForwardAllow: true,
    embedInRoom: false,
  },
);

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
/** PC 飞出层；小屏用底部 popup */
const showRates = ref(false);
const speedSheetOpen = ref(false);
/** 与 Uno `md` 一致：<768 用 popup */
const isNarrow = ref(false);
let narrowMql: MediaQueryList | null = null;
const isFullscreen = ref(false);
/** CSS 伪全屏（Fullscreen API 不可用时） */
const pseudoFullscreen = ref(false);
/** 禁止快进时：已观看到的最大进度（秒） */
const maxWatched = ref(0);

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const speedSheetOptions = computed(() =>
  SPEED_OPTIONS.map((opt) => ({
    key: opt,
    label: `${opt}x`,
    selected: opt === rate.value,
  })),
);

/** 明显圆角 ▶（24 视口、20px 下肉眼可见钝角，非尖三角） */
const PLAY_ICON_PATH =
  "M8.9 4.95C8.15 4.5 7.2 5.05 7.2 5.95v12.1c0 .9.95 1.45 1.7 1l9.5-5.55c.8-.47.8-1.73 0-2.2L8.9 4.95z";

const progressPct = computed(() =>
  duration.value > 0 ? Math.min(100, (current.value / duration.value) * 100) : 0,
);

/** 暂停态底栏「已揭开」；初始/切 src 默认收起，仅用户从播放→暂停后揭开；5s 无操作后收起 */
const controlsRevealed = ref(false);
const CONTROLS_HIDE_MS = 5000;
let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;

function clearControlsHideTimer() {
  if (controlsHideTimer != null) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
}

/** 暂停态显示底栏并（重新）计 5s；sheet/飞出打开时只显示不计时 */
function revealControls(restartTimer = true) {
  controlsRevealed.value = true;
  clearControlsHideTimer();
  if (!restartTimer) return;
  if (playing.value || speedSheetOpen.value || showRates.value) return;
  controlsHideTimer = setTimeout(() => {
    controlsHideTimer = null;
    controlsRevealed.value = false;
  }, CONTROLS_HIDE_MS);
}

/** 播放中隐藏；暂停且已揭开显示；倍速 sheet/飞出强制显示 */
const controlsVisible = computed(
  () =>
    (!playing.value && controlsRevealed.value) ||
    speedSheetOpen.value ||
    showRates.value,
);

/** 暂停态点操作栏 / 拖进度：重置 5s */
function onControlsInteract() {
  if (!playing.value) revealControls(true);
}

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
  clearControlsHideTimer();
  controlsRevealed.value = false;
  emit("play");
}

function onPause() {
  /** 区分初始暂停（未播过）与用户主动暂停：仅「刚才在播」才揭开底栏 */
  const wasPlaying = playing.value;
  playing.value = false;
  if (wasPlaying) revealControls(true);
  emit("pause");
}

function onEnded() {
  playing.value = false;
  revealControls(true);
  emit("ended");
}

function togglePlay() {
  const el = videoRef.value;
  if (!el) return;
  if (el.paused) void el.play();
  else el.pause();
}

const seekTrackEl = ref<HTMLElement | null>(null);
const seeking = ref(false);

function seekFromClientX(clientX: number) {
  const el = videoRef.value;
  const track = seekTrackEl.value;
  if (!el || !track || !props.fastForwardAllow || duration.value <= 0) return;
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const t = ratio * duration.value;
  el.currentTime = t;
  current.value = t;
}

function onSeekPointerDown(e: PointerEvent) {
  if (!props.fastForwardAllow || duration.value <= 0) return;
  e.preventDefault();
  e.stopPropagation();
  onControlsInteract();
  const track = e.currentTarget as HTMLElement;
  track.setPointerCapture?.(e.pointerId);
  seeking.value = true;
  seekFromClientX(e.clientX);
  window.addEventListener("pointermove", onSeekPointerMove);
  window.addEventListener("pointerup", onSeekPointerUp);
  window.addEventListener("pointercancel", onSeekPointerUp);
}

function onSeekPointerMove(e: PointerEvent) {
  if (!seeking.value) return;
  onControlsInteract();
  seekFromClientX(e.clientX);
}

function onSeekPointerUp() {
  seeking.value = false;
  window.removeEventListener("pointermove", onSeekPointerMove);
  window.removeEventListener("pointerup", onSeekPointerUp);
  window.removeEventListener("pointercancel", onSeekPointerUp);
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target as Element | null;
  if (!t) return;
  if (!t.closest(".speed-menu")) showRates.value = false;
}

function setRate(v: number) {
  if (!props.speedAllow) return;
  rate.value = v;
  const el = videoRef.value;
  if (el) el.playbackRate = v;
  showRates.value = false;
  speedSheetOpen.value = false;
  if (!playing.value) revealControls(true);
}

function syncNarrow() {
  isNarrow.value = !!narrowMql?.matches;
  if (isNarrow.value) showRates.value = false;
  else speedSheetOpen.value = false;
}

function onSpeedClick() {
  onControlsInteract();
  if (isNarrow.value) {
    speedSheetOpen.value = true;
    return;
  }
  showRates.value = !showRates.value;
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
    clearControlsHideTimer();
    controlsRevealed.value = false;
  },
);

/** sheet / PC 飞出打开时强制显示且不计时；关闭后若仍暂停再计 5s */
watch([speedSheetOpen, showRates], ([sheet, flyout]) => {
  if (sheet || flyout) {
    clearControlsHideTimer();
    controlsRevealed.value = true;
    return;
  }
  if (!playing.value) revealControls(true);
});

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
  narrowMql = window.matchMedia("(max-width: 767px)");
  syncNarrow();
  narrowMql.addEventListener("change", syncNarrow);
  document.addEventListener("fullscreenchange", syncFullscreenFlag);
  document.addEventListener("keydown", onFsKeydown);
  document.addEventListener("pointerdown", onDocPointerDown);
  const video = videoRef.value;
  if (video) {
    video.addEventListener("webkitbeginfullscreen", syncFullscreenFlag);
    video.addEventListener("webkitendfullscreen", syncFullscreenFlag);
  }
});

onBeforeUnmount(() => {
  clearControlsHideTimer();
  narrowMql?.removeEventListener("change", syncNarrow);
  narrowMql = null;
  document.removeEventListener("fullscreenchange", syncFullscreenFlag);
  document.removeEventListener("keydown", onFsKeydown);
  document.removeEventListener("pointerdown", onDocPointerDown);
  window.removeEventListener("pointermove", onSeekPointerMove);
  window.removeEventListener("pointerup", onSeekPointerUp);
  window.removeEventListener("pointercancel", onSeekPointerUp);
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
    :class="[
      embedInRoom ? 'replay-embed flex-none' : '',
      { 'replay-pseudo-fs': pseudoFullscreen },
    ]"
  >
    <div
      ref="stageRef"
      class="relative w-full overflow-hidden bg-black aspect-video flex-none"
      :class="[
        embedInRoom ? 'replay-embed-stage' : 'md:mx-auto md:max-w-5xl',
        { 'replay-stage-fs': pseudoFullscreen },
      ]"
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
          class="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white md:h-16 md:w-16"
        >
          <svg
            class="h-7 w-7 translate-x-px md:h-8 md:w-8"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path :d="PLAY_ICON_PATH" />
          </svg>
        </span>
      </div>

      <div
        class="replay-toolbar"
        :class="{ 'is-hidden': !controlsVisible }"
        @click.stop="onControlsInteract"
        @pointerdown.stop="onControlsInteract"
      >
        <div class="seek-row">
          <span class="time-label">{{ formatTime(current) }}</span>
          <div
            ref="seekTrackEl"
            class="seek-track"
            :class="{ 'is-disabled': !fastForwardAllow || duration <= 0 }"
            role="slider"
            tabindex="0"
            :aria-valuenow="Math.floor(current)"
            aria-valuemin="0"
            :aria-valuemax="Math.floor(duration) || 0"
            aria-label="播放进度"
            :aria-disabled="!fastForwardAllow || duration <= 0"
            @pointerdown="onSeekPointerDown"
          >
            <div class="seek-rail" />
            <div class="seek-fill" :style="{ width: progressPct + '%' }" />
            <div class="seek-thumb" :style="{ left: progressPct + '%' }" />
          </div>
          <span class="time-label time-label--end">{{ formatTime(duration) }}</span>
        </div>

        <div class="toolbar-controls">
          <div class="toolbar-left">
            <button
              type="button"
              class="bar-btn"
              :title="playing ? '暂停' : '播放'"
              @click="togglePlay"
            >
              <svg
                v-if="!playing"
                class="bar-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path :d="PLAY_ICON_PATH" />
              </svg>
              <svg
                v-else
                class="bar-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M7 5h2a1 1 0 011 1v12a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1zm8 0h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V6a1 1 0 011-1z"
                />
              </svg>
            </button>
          </div>

          <div class="toolbar-right">
            <div
              v-if="speedAllow"
              class="toolbar-menu speed-menu"
            >
              <button
                type="button"
                class="bar-btn speed-btn"
                title="倍速"
                @click="onSpeedClick"
              >
                {{ rate === 1 ? "倍速" : `${rate}x` }}
              </button>
              <div
                v-show="showRates && !isNarrow"
                class="menu-flyout speed-flyout"
                @click.stop
              >
                <ul class="speed-list">
                  <li
                    v-for="opt in SPEED_OPTIONS"
                    :key="opt"
                    class="speed-item"
                    :class="{ 'is-active': opt === rate }"
                    @click="setRate(opt)"
                  >
                    {{ opt }}x
                  </li>
                </ul>
              </div>
            </div>
            <span
              v-else
              class="speed-closed"
            >倍速已关闭</span>

            <button
              type="button"
              class="bar-btn"
              :title="isLight ? '切换到夜间' : '切换到白天'"
              :aria-label="isLight ? '切换到夜间' : '切换到白天'"
              @click="toggleTheme"
            >
              <svg
                v-if="isLight"
                class="bar-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                />
              </svg>
              <svg
                v-else
                class="bar-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </button>

            <button
              v-if="!isFullscreen"
              type="button"
              class="bar-btn"
              title="全屏"
              @click="toggleFullscreen"
            >
              <svg class="bar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
              </svg>
            </button>
            <button
              v-else
              type="button"
              class="bar-btn"
              title="退出全屏"
              @click="toggleFullscreen"
            >
              <svg class="bar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
              </svg>
            </button>
          </div>
        </div>

        <p
          v-if="!fastForwardAllow"
          class="seek-tip"
        >
          已禁止快进，请按进度完整观看
        </p>
      </div>
    </div>

    <UiBottomSheet
      :open="speedSheetOpen"
      title="倍速"
      show-handle
      @close="speedSheetOpen = false"
    >
      <SheetOptionList
        :options="speedSheetOptions"
        @select="(key) => setRate(Number(key))"
      />
    </UiBottomSheet>
  </div>
</template>

<style scoped>
/*
 * 嵌入房间 PC：在 WatchRoomShell `.media-well` 内短边铺满，舞台 16:9。
 * 小屏走 width:100% + aspect-video（与 PlayerStage 一致）。
 */
@media (min-width: 768px) {
  .replay-embed:not(.replay-pseudo-fs) {
    width: min(100cqw, calc(100cqh * 16 / 9));
    max-width: 100%;
    flex: none;
  }

  .replay-embed:not(.replay-pseudo-fs) .replay-embed-stage {
    width: 100%;
    height: auto;
    max-height: 100%;
    aspect-ratio: 16 / 9;
  }
}

.replay-pseudo-fs {
  position: fixed;
  inset: 0;
  z-index: 100;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none;
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
  /* 底栏已 overlay，无需再为文档流底栏预留高度 */
  max-height: 100dvh;
}

/* 叠在舞台底部：对齐直播 PlayerToolbar 的 absolute，渐变底保证白字可读 */
.replay-toolbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 12px 10px;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.45) 55%,
    transparent 100%
  );
  color: #fff;
  overflow: visible;
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.replay-toolbar.is-hidden {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
}

.seek-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 18px;
}

.time-label {
  flex: none;
  min-width: 2.75em;
  font-size: 12px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
  user-select: none;
}

.time-label--end {
  text-align: right;
}

.seek-track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 18px;
  cursor: pointer;
  touch-action: none;
  outline: none;
}

.seek-track.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  pointer-events: none;
}

.seek-rail,
.seek-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 3px;
  transform: translateY(-50%);
  border-radius: 2px;
  pointer-events: none;
}

.seek-rail {
  right: 0;
  background: #6b7280;
}

.seek-fill {
  background: var(--lw-color-brand);
}

.seek-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  margin-top: -6px;
  border-radius: 50%;
  background: var(--lw-color-brand);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.toolbar-controls {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

.bar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: #fff;
  border: 0;
  padding: 0;
  cursor: pointer;
  line-height: 1;
}

.bar-btn:hover {
  color: #fff;
}

.bar-icon {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  flex: none;
}

.speed-btn {
  font-size: 14px;
  min-width: 2.5em;
  justify-content: center;
}

.speed-closed {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  user-select: none;
}

.toolbar-menu {
  position: relative;
  overflow: visible;
}

.speed-menu {
  padding: 8px 10px;
  margin: -8px -10px;
}

.menu-flyout {
  position: absolute;
  bottom: calc(100% - 18px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0 16px 18px;
  box-sizing: border-box;
  z-index: 2;
  pointer-events: auto;
}

.speed-flyout {
  min-width: 72px;
}

.speed-list {
  width: 72px;
  margin: 0 auto;
  padding: 4px 0;
  list-style: none;
  background: var(--lw-bg-bubble);
  border-radius: 4px;
  overflow: hidden;
}

.speed-item {
  height: 44px;
  line-height: 44px;
  text-align: center;
  font-size: 14px;
  color: var(--lw-text-secondary);
  cursor: pointer;
}

.speed-item:hover,
.speed-item.is-active {
  color: var(--lw-text-primary);
  font-weight: 500;
}

.seek-tip {
  margin: 0;
  padding-bottom: 2px;
  text-align: center;
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.45);
}
</style>
