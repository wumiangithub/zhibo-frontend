<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PlayerController } from "@/composables/usePlayerControls";
import type { BarrageController } from "@/composables/useBarrage";
import type { RoomStatsController } from "@/composables/useRoomStats";
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import SheetOptionList from "@/components/SheetOptionList.vue";
import { useWatchTheme } from "@/composables/useWatchTheme";

const { isLight, toggleTheme } = useWatchTheme();

const props = defineProps<{
  player: PlayerController;
  barrage: BarrageController;
  stats: RoomStatsController;
  /** 观看页小屏：点赞改走聊天底栏 */
  hideMobileBarActions?: boolean;
}>();

/** 明显圆角 ▶（与 NativeReplayPlayer 同源；24 视口、20px 下钝角，非尖三角） */
const PLAY_ICON_PATH =
  "M8.9 4.95C8.15 4.5 7.2 5.05 7.2 5.95v12.1c0 .9.95 1.45 1.7 1l9.5-5.55c.8-.47.8-1.73 0-2.2L8.9 4.95z";

/** 与观看页 Uno `md` 一致：<768 小屏（无 hover 滑条，清晰度用底部 popup） */
const isNarrow = ref(false);
let narrowMql: MediaQueryList | null = null;

/** PC 悬停 / 点击 pin；小屏改走 qualitySheetOpen */
const qualityHover = ref(false);
const qualityPinned = ref(false);
const qualitySheetOpen = ref(false);
const volumeHover = ref(false);

/** 短暂离开不立刻关，避免斜移/缝隙闪关（仅 PC） */
const HOVER_HIDE_MS = 120;
let qualityLeaveTimer: ReturnType<typeof setTimeout> | null = null;
let volumeLeaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 对齐 NativeReplayPlayer：默认收起；仅「播放→暂停」揭开；5s 无操作收起；
 * sheet/飞出打开时强制显示且不计时。
 */
const controlsRevealed = ref(false);
const CONTROLS_HIDE_MS = 5000;
let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;

function clearControlsHideTimer() {
  if (controlsHideTimer != null) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
}

function anyOverlayOpen() {
  return (
    qualitySheetOpen.value ||
    (!isNarrow.value && (qualityHover.value || qualityPinned.value)) ||
    (!isNarrow.value && volumeHover.value)
  );
}

/** 暂停态显示底栏并（重新）计 5s；sheet/飞出打开时只显示不计时 */
function revealControls(restartTimer = true) {
  controlsRevealed.value = true;
  clearControlsHideTimer();
  if (!restartTimer) return;
  if (!props.player.isPaused || anyOverlayOpen()) return;
  controlsHideTimer = setTimeout(() => {
    controlsHideTimer = null;
    controlsRevealed.value = false;
  }, CONTROLS_HIDE_MS);
}

/** 播放中隐藏；暂停且已揭开显示；清晰度 sheet/飞出、音量飞出强制显示 */
const controlsVisible = computed(
  () =>
    (props.player.isPaused && controlsRevealed.value) || anyOverlayOpen(),
);

/** 暂停态点操作栏：重置 5s */
function onControlsInteract() {
  if (props.player.isPaused) revealControls(true);
}

const currentQualityLabel = computed(() => {
  const code = props.player.currentQualityCode;
  const hit = props.player.qualityOptions.find((q) => q.code === code);
  return hit?.label || "清晰度";
});

const qualitySheetOptions = computed(() =>
  props.player.qualityOptions.map((q) => ({
    key: q.code,
    label: q.label,
    selected: q.code === props.player.currentQualityCode,
  })),
);

/** 仅 PC 飞出层；小屏用 UiBottomSheet */
const qualityPanelOpen = computed(
  () => !isNarrow.value && (qualityHover.value || qualityPinned.value),
);

const volumePct = computed(() =>
  props.player.muted || props.player.volume === 0 ? 0 : props.player.volume,
);

/** 小屏永不展示音量飞出层 */
const volumePanelOpen = computed(() => !isNarrow.value && volumeHover.value);

function syncNarrow() {
  isNarrow.value = !!narrowMql?.matches;
  if (isNarrow.value) {
    volumeHover.value = false;
    qualityHover.value = false;
    qualityPinned.value = false;
    clearVolumeLeaveTimer();
    clearQualityLeaveTimer();
  } else {
    qualitySheetOpen.value = false;
  }
}

function clearQualityLeaveTimer() {
  if (qualityLeaveTimer) {
    clearTimeout(qualityLeaveTimer);
    qualityLeaveTimer = null;
  }
}

function clearVolumeLeaveTimer() {
  if (volumeLeaveTimer) {
    clearTimeout(volumeLeaveTimer);
    volumeLeaveTimer = null;
  }
}

function onQualityEnter() {
  if (isNarrow.value) return;
  clearQualityLeaveTimer();
  qualityHover.value = true;
}

function onQualityLeave() {
  if (isNarrow.value) return;
  clearQualityLeaveTimer();
  qualityLeaveTimer = setTimeout(() => {
    qualityHover.value = false;
    qualityLeaveTimer = null;
  }, HOVER_HIDE_MS);
}

function onVolumeEnter() {
  if (isNarrow.value) return;
  clearVolumeLeaveTimer();
  volumeHover.value = true;
}

function onVolumeLeave() {
  if (isNarrow.value) return;
  clearVolumeLeaveTimer();
  volumeLeaveTimer = setTimeout(() => {
    volumeHover.value = false;
    volumeLeaveTimer = null;
  }, HOVER_HIDE_MS);
}

function pickQuality(code: string) {
  props.player.setQuality(code);
  qualityPinned.value = false;
  qualityHover.value = false;
  qualitySheetOpen.value = false;
  clearQualityLeaveTimer();
  if (props.player.isPaused) revealControls(true);
}

/** 小屏：底部 popup；PC：点击 pin 飞出层 */
function onQualityLabelClick() {
  onControlsInteract();
  volumeHover.value = false;
  clearVolumeLeaveTimer();
  if (isNarrow.value) {
    qualitySheetOpen.value = true;
    return;
  }
  qualityPinned.value = !qualityPinned.value;
}

function onVolumeIconClick() {
  onControlsInteract();
  qualityPinned.value = false;
  clearQualityLeaveTimer();
  qualityHover.value = false;
  // 小屏 / PC：点击喇叭只静音；PC 靠悬停出滑条，不 pin 飞出层
  props.player.toggleMute();
}

const volumeTrackEl = ref<HTMLElement | null>(null);

/** 轨道底=0、顶=100；不用原生 vertical range（writing-mode 映射不稳会弹到顶） */
function volumeFromClientY(clientY: number): number {
  const el = volumeTrackEl.value;
  if (!el) return props.player.volume;
  const rect = el.getBoundingClientRect();
  if (rect.height <= 0) return props.player.volume;
  const ratio = (rect.bottom - clientY) / rect.height;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function onVolumeTrackPointerDown(e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  onControlsInteract();
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture?.(e.pointerId);
  props.player.beginVolumeDrag();
  props.player.setVolume(volumeFromClientY(e.clientY));
  window.addEventListener("pointermove", onVolumePointerMove);
  window.addEventListener("pointerup", onVolumePointerUp);
  window.addEventListener("pointercancel", onVolumePointerUp);
}

function onVolumePointerMove(e: PointerEvent) {
  onControlsInteract();
  props.player.setVolume(volumeFromClientY(e.clientY));
}

function onVolumePointerUp() {
  window.removeEventListener("pointermove", onVolumePointerMove);
  window.removeEventListener("pointerup", onVolumePointerUp);
  window.removeEventListener("pointercancel", onVolumePointerUp);
  props.player.endVolumeDrag();
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target as Element | null;
  if (!t) return;
  if (!t.closest(".quality-menu")) qualityPinned.value = false;
}

function onVolumeTrackPointerDownGuarded(e: PointerEvent) {
  if (isNarrow.value) return;
  onVolumeTrackPointerDown(e);
}

/** 仅 wasPlaying→暂停才揭开；起播立即收起（进房默认暂停不揭） */
watch(
  () => props.player.isPaused,
  (paused, wasPaused) => {
    if (!paused) {
      clearControlsHideTimer();
      controlsRevealed.value = false;
      return;
    }
    if (wasPaused === false) revealControls(true);
  },
);

/** sheet / PC 飞出打开时强制显示且不计时；从打开→关闭后若仍暂停再计 5s（勿在 isNarrow 初同步时误揭） */
watch(anyOverlayOpen, (open, wasOpen) => {
  if (open) {
    clearControlsHideTimer();
    controlsRevealed.value = true;
    return;
  }
  if (wasOpen && props.player.isPaused) revealControls(true);
});

/** 切主题时收起清晰度 sheet，避免 mask 残留 */
watch(isLight, () => {
  qualitySheetOpen.value = false;
  qualityPinned.value = false;
});

onMounted(() => {
  narrowMql = window.matchMedia("(max-width: 767px)");
  syncNarrow();
  narrowMql.addEventListener("change", syncNarrow);
  document.addEventListener("pointerdown", onDocPointerDown);
});
onBeforeUnmount(() => {
  clearControlsHideTimer();
  narrowMql?.removeEventListener("change", syncNarrow);
  narrowMql = null;
  document.removeEventListener("pointerdown", onDocPointerDown);
  window.removeEventListener("pointermove", onVolumePointerMove);
  window.removeEventListener("pointerup", onVolumePointerUp);
  window.removeEventListener("pointercancel", onVolumePointerUp);
  clearQualityLeaveTimer();
  clearVolumeLeaveTimer();
  props.player.endVolumeDrag();
});
</script>

<template>
  <div
    class="player-toolbar"
    :class="{ 'is-hidden': !controlsVisible }"
    @click.stop="onControlsInteract"
    @pointerdown.stop="onControlsInteract"
  >
    <div class="toolbar-left">
      <button
        type="button"
        class="bar-btn"
        :title="player.isPaused || player.needsTapToPlay ? '播放' : '暂停'"
        @click="player.togglePlayback"
      >
        <!-- 暂停中：圆角播放三角 -->
        <svg
          v-if="player.isPaused || player.needsTapToPlay"
          class="bar-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path :d="PLAY_ICON_PATH" />
        </svg>
        <!-- 播放中：圆角暂停双竖线 -->
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
      <!-- 清晰度：PC 悬停；小屏点击开/关 -->
      <div
        v-if="player.qualityOptions.length"
        class="toolbar-menu quality-menu"
        @mouseenter="onQualityEnter"
        @mouseleave="onQualityLeave"
      >
        <button
          type="button"
          class="bar-btn quality-btn"
          title="清晰度"
          @click="onQualityLabelClick"
        >
          {{ currentQualityLabel }}
        </button>
        <div v-show="qualityPanelOpen" class="menu-flyout quality-flyout" @click.stop>
          <ul class="quality-list">
            <li
              v-for="q in player.qualityOptions"
              :key="q.code"
              class="quality-item"
              :class="{ 'is-active': q.code === player.currentQualityCode }"
              @click="pickQuality(q.code)"
            >
              {{ q.label }}
            </li>
          </ul>
        </div>
      </div>

      <!-- 音量：PC 悬停出竖条；小屏仅点击静音、无滑条 -->
      <div
        class="toolbar-menu volume-menu"
        @mouseenter="onVolumeEnter"
        @mouseleave="onVolumeLeave"
      >
        <button
          type="button"
          class="bar-btn"
          :title="player.muted || player.volume === 0 ? '取消静音' : '静音'"
          @click="onVolumeIconClick"
        >
          <svg
            v-if="player.muted || player.volume === 0"
            class="bar-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9l4 4m0-4l-4 4" />
          </svg>
          <svg
            v-else
            class="bar-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
          </svg>
        </button>
        <div
          v-if="volumePanelOpen"
          class="menu-flyout volume-flyout max-md:hidden"
          @click.stop
        >
          <div class="volume-panel">
            <div class="volume-value" aria-hidden="true">{{ volumePct }}</div>
            <div
              ref="volumeTrackEl"
              class="volume-track"
              role="slider"
              tabindex="0"
              :aria-valuenow="volumePct"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="音量"
              @pointerdown.stop="onVolumeTrackPointerDownGuarded"
            >
              <div class="volume-track-rail" />
              <div class="volume-track-fill" :style="{ height: `${volumePct}%` }" />
              <div class="volume-track-thumb" :style="{ bottom: `${volumePct}%` }" />
            </div>
          </div>
        </div>
      </div>

      <!-- 弹幕：白「弹」；关态仅加斜线（不加红/品牌色） -->
      <button
        type="button"
        class="bar-btn barrage-btn"
        :title="barrage.barrageOn ? '关弹幕' : '开弹幕'"
        :aria-pressed="barrage.barrageOn"
        @click="barrage.toggleBarrage"
      >
        <svg
          class="bar-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect
            x="3.25"
            y="4.5"
            width="17.5"
            height="15"
            rx="2.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
          />
          <text
            x="12"
            y="15"
            text-anchor="middle"
            fill="currentColor"
            font-size="9"
            font-weight="700"
            font-family="system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif"
          >弹</text>
          <line
            v-if="!barrage.barrageOn"
            x1="5.5"
            y1="18"
            x2="18.5"
            y2="6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- 观看页小屏：点赞走聊天底栏；v-if+isNarrow，避免 scoped .bar-btn 压过 max-md:hidden -->
      <button
        v-if="!hideMobileBarActions || !isNarrow"
        type="button"
        class="bar-btn"
        title="点赞"
        @click="stats.handleLike"
      >
        <svg class="bar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        <span class="text-xs">{{ stats.likeCount }}</span>
      </button>

      <button
        type="button"
        class="bar-btn"
        :title="isLight ? '切换到夜间' : '切换到白天'"
        :aria-label="isLight ? '切换到夜间' : '切换到白天'"
        @click="toggleTheme"
      >
        <!-- light：月亮（切夜间）；dark：太阳（切白天） -->
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
        v-if="!player.isFullscreen"
        type="button"
        class="bar-btn"
        title="全屏"
        @click="player.enterFullscreen"
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
        @click="player.exitFullscreen"
      >
        <svg class="bar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
        </svg>
      </button>
    </div>

    <UiBottomSheet
      :open="qualitySheetOpen"
      title="清晰度"
      show-handle
      @close="qualitySheetOpen = false"
    >
      <SheetOptionList
        :options="qualitySheetOptions"
        @select="(key) => pickQuality(String(key))"
      />
    </UiBottomSheet>
  </div>
</template>

<style scoped>
.player-toolbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  /* 高于舞台 center-play-hit(z50)，否则飞出层在底栏上方被挡、移入即 mouseleave */
  z-index: 60;
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  /* 半透明深底，视频可透出；轻 blur 保白字可读 */
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--lw-text-primary);
  overflow: visible;
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.player-toolbar.is-hidden {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
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

/* 工具栏悬停保持白字；不用品牌橙（清晰度选中等同理） */
.bar-btn:hover {
  color: #fff;
}

/* 弹幕开关：开/关都保持白色，关态只靠斜线区分，不用红/品牌色 */
.barrage-btn,
.barrage-btn:hover {
  color: #fff;
}

.bar-icon {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  flex: none;
}

.quality-btn {
  font-size: 14px;
  min-width: 2.5em;
  justify-content: center;
}

.toolbar-menu {
  position: relative;
  overflow: visible;
}

/* 扩大悬停根，斜移不易离开 */
.quality-menu,
.volume-menu {
  padding: 8px 10px;
  margin: -8px -10px;
}

/*
 * 飞出层：下沉重叠触发器（bottom 不是贴边 100%），透明 padding 可点；
 * 宽于图标，避免斜移漏出热区。须为悬停根的 DOM 子节点。
 */
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

.quality-flyout {
  min-width: 88px;
}

.volume-flyout {
  min-width: 48px;
}

.quality-list {
  width: 72px;
  margin: 0 auto;
  padding: 4px 0;
  list-style: none;
  background: var(--lw-bg-bubble);
  border-radius: 4px;
  overflow: hidden;
}

.quality-item {
  height: 44px;
  line-height: 44px;
  text-align: center;
  font-size: 14px;
  color: var(--lw-text-secondary);
  cursor: pointer;
}

.quality-item:hover,
.quality-item.is-active {
  color: var(--lw-text-primary);
  font-weight: 500;
}

/* 竖条音量：深色圆角胶囊；自定义轨道（底=0 顶=100） */
.volume-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  width: 36px;
  height: 140px;
  padding: 10px 0 12px;
  box-sizing: border-box;
  background: rgba(30, 30, 30, 0.92);
  border-radius: 16px;
}

.volume-value {
  flex-shrink: 0;
  min-height: 16px;
  line-height: 16px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  user-select: none;
  pointer-events: none;
}

.volume-track {
  position: relative;
  width: 24px;
  height: 92px;
  cursor: pointer;
  touch-action: none;
  outline: none;
}

.volume-track-rail,
.volume-track-fill {
  position: absolute;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  pointer-events: none;
}

.volume-track-rail {
  top: 0;
  bottom: 0;
  background: #6b7280;
}

.volume-track-fill {
  bottom: 0;
  /* 音量用中性白，不用品牌橙（易被看成危险/错误） */
  background: #fff;
}

.volume-track-thumb {
  position: absolute;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  margin-bottom: -6px;
  border-radius: 50%;
  background: #fff;
  pointer-events: none;
}
</style>
