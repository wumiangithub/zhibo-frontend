<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BarrageLayer from "@/components/watch/BarrageLayer.vue";
import PlayerToolbar from "@/components/watch/PlayerToolbar.vue";
import type { PlayerController } from "@/composables/usePlayerControls";
import type { BarrageController } from "@/composables/useBarrage";
import type { RoomStatsController } from "@/composables/useRoomStats";

const props = defineProps<{
  player: PlayerController;
  barrage: BarrageController;
  stats: RoomStatsController;
  title: string;
  /** type=1 音频直播：浏览器常因自动播放策略把音轨挂起 */
  isAudioLive: boolean;
  /** 观看页小屏：播放器 16:9 顶置；中控台勿开 */
  mobileAspectVideo?: boolean;
  /** 观看页小屏：点赞改走聊天底栏；中控台勿开 */
  hideMobileBarActions?: boolean;
}>();

const emit = defineEmits<{ retry: [] }>();

/** 纯音频场（type=1）或清晰度选「音频」(code=a) 都走同一套 EQ 遮罩 */
const showAudioVisual = computed(
  () => props.isAudioLive || props.player.currentQualityCode === "a",
);

const stageRef = ref<HTMLElement | null>(null);

function syncStageEl(el: HTMLElement | null) {
  props.player.bindStageEl(el);
}

/** 播放中点舞台空白暂停（底栏播放中隐藏，对齐回放 stage click）；暂停态由居中钮 .stop 起播 */
function onStageClick() {
  if (props.player.mediaFailed || props.player.waitingForMedia) return;
  if (props.player.isPaused || props.player.needsTapToPlay) return;
  props.player.pausePlayback();
}

onMounted(() => syncStageEl(stageRef.value));
watch(stageRef, (el) => syncStageEl(el));
onBeforeUnmount(() => syncStageEl(null));
</script>

<template>
  <div
    ref="stageRef"
    class="player-stage relative w-full bg-black"
    :class="[
      mobileAspectVideo
        ? 'aspect-video flex-none md:aspect-auto md:min-h-0 md:min-w-0 md:flex-1'
        : 'min-h-0 min-w-0 flex-1',
      { 'player-stage-fullscreen': player.pseudoFullscreen },
    ]"
    @click="onStageClick"
  >
    <button
      v-if="!player.waitingForMedia && !player.mediaFailed && (player.needsTapToPlay || player.isPaused)"
      type="button"
      class="center-play-hit"
      :aria-label="showAudioVisual ? '点击收听' : '点击播放'"
      @click.stop="player.resumePlayback"
    >
      <span class="center-play-orb" aria-hidden="true">
        <!-- SVG 矢量，避免 PNG 缩放重影/发糊；圆角三角与底栏同源 -->
        <svg
          class="center-play-icon"
          viewBox="0 0 24 24"
          fill="#fff"
          aria-hidden="true"
        >
          <path
            d="M8.9 4.95C8.15 4.5 7.2 5.05 7.2 5.95v12.1c0 .9.95 1.45 1.7 1l9.5-5.55c.8-.47.8-1.73 0-2.2L8.9 4.95z"
          />
        </svg>
      </span>
    </button>

    <div
      v-else-if="player.waitingForMedia"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center"
    >
      <span class="text-sm text-gray-200">播放器加载中…</span>
    </div>

    <div
      v-else-if="player.mediaFailed"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center"
    >
      <span class="text-sm text-[var(--lw-color-danger)]">{{ player.failReason || '播放器加载失败' }}</span>
      <span class="text-xs text-gray-400">
        若直播确实在播，多半是微吼 SDK 瞬时抖动（20005），可点刷新重试
      </span>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          @click="emit('retry')"
        >
          刷新重试
        </button>
      </div>
    </div>

    <div
      v-if="showAudioVisual"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6"
    >
      <div class="flex flex-col items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full bg-[var(--lw-color-danger-muted)] px-3 py-1 text-xs font-medium text-[var(--lw-color-live)]">
          <span class="h-2 w-2 animate-pulse rounded-full bg-[var(--lw-color-live)]"></span>
          直播中
        </span>
        <h2 class="mt-2 text-xl font-semibold text-white">{{ title }}</h2>
      </div>

      <div class="audio-eq" :class="{ 'is-paused': player.isPaused }" aria-hidden="true">
        <span
          v-for="i in 5"
          :key="i"
          class="audio-eq__bar"
          :style="{ animationDelay: `${(i - 1) * 0.12}s` }"
        />
      </div>

      <p v-if="!player.isPaused" class="text-sm text-gray-400">
        正在播放音频直播
      </p>
    </div>

    <div
      id="player"
      class="h-full w-full"
      :class="{ 'opacity-0': showAudioVisual }"
    />
    <div id="docWrap" class="hidden" />

    <BarrageLayer :barrage="barrage" />

    <!-- 媒体就绪即挂载；显隐由 PlayerToolbar controlsRevealed（默认藏，播放→暂停揭 5s） -->
    <PlayerToolbar
      v-if="!player.mediaFailed && !player.waitingForMedia"
      :player="player"
      :barrage="barrage"
      :stats="stats"
      :hide-mobile-bar-actions="hideMobileBarActions"
    />
  </div>
</template>

<style scoped>
/* 伪全屏作用在舞台根，自建底栏一起铺满 */
.player-stage.player-stage-fullscreen {
  position: fixed !important;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100dvh;
  background: var(--lw-bg-player);
}

/*
 * 轻量 CSS 兜底：playerReady 前原生条可能闪一下。
 * 主路径：VhallWatchAdapter 在 playerReady 后 removeChild（对齐 demo）；无 MutationObserver。
 */
#player :deep(.vh-player-controller),
#player :deep(.vh-player-record-control) {
  display: none !important;
}

/* 暂停居中播放：半透明黑圆 + 白三角；底栏隐藏时铺满舞台 */
.center-play-hit {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

/* 小屏 orb 60 / PC(md≥768) 80；三角 32 / 44（相对圆约 +30%，不溢出） */
.center-play-orb {
  --orb: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--orb);
  height: var(--orb);
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.4);
}

@media (min-width: 768px) {
  .center-play-orb {
    --orb: 80px;
  }
}

.center-play-icon {
  display: block;
  width: 32px;
  height: 32px;
  /* 三角视觉重心偏左，略右移居中 */
  margin-left: calc(var(--orb) * 3 / 64);
  flex: none;
}

@media (min-width: 768px) {
  .center-play-icon {
    width: 44px;
    height: 44px;
  }
}

@keyframes audioWave {
  0%,
  100% {
    transform: scaleY(0.35);
  }
  50% {
    transform: scaleY(1);
  }
}

.audio-eq {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  height: 56px;
}

.audio-eq__bar {
  display: block;
  width: 6px;
  height: 48px;
  border-radius: 999px;
  background: #22c55e;
  transform-origin: bottom center;
  animation: audioWave 0.9s ease-in-out infinite;
}

.audio-eq__bar:nth-child(1) {
  height: 28px;
  animation-duration: 0.75s;
}
.audio-eq__bar:nth-child(2) {
  height: 48px;
  animation-duration: 1.05s;
}
.audio-eq__bar:nth-child(3) {
  height: 36px;
  animation-duration: 0.85s;
}
.audio-eq__bar:nth-child(4) {
  height: 52px;
  animation-duration: 1.15s;
}
.audio-eq__bar:nth-child(5) {
  height: 32px;
  animation-duration: 0.95s;
}

.audio-eq.is-paused .audio-eq__bar {
  animation-play-state: paused;
  opacity: 0.45;
}
</style>
