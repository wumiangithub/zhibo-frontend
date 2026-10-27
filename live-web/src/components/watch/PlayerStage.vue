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
  canFallback?: boolean;
  /** 观看页小屏：播放器 16:9 顶置；中控台勿开 */
  mobileAspectVideo?: boolean;
  /** 观看页小屏：点赞改走聊天底栏；中控台勿开 */
  hideMobileBarActions?: boolean;
}>();

const emit = defineEmits<{ retry: []; fallback: [] }>();

/** 纯音频场（type=1）或清晰度选「音频」(code=a) 都走同一套 EQ 遮罩 */
const showAudioVisual = computed(
  () => props.isAudioLive || props.player.currentQualityCode === "a",
);

const stageRef = ref<HTMLElement | null>(null);

function syncStageEl(el: HTMLElement | null) {
  props.player.bindStageEl(el);
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
  >
    <button
      v-if="!player.waitingForMedia && !player.mediaFailed && (player.needsTapToPlay || player.isPaused)"
      type="button"
      class="center-play-hit"
      :aria-label="showAudioVisual ? '点击收听' : '点击播放'"
      @click="player.resumePlayback"
    >
      <span class="center-play-orb" aria-hidden="true">
        <span class="center-play-icon" />
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
      <span class="text-sm text-red-300">{{ player.failReason || '播放器加载失败' }}</span>
      <span class="text-xs text-gray-400">
        若直播确实在播，多半是微吼 SDK 瞬时抖动（20005），可点刷新或改用嵌入页
      </span>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          @click="emit('retry')"
        >
          刷新重试
        </button>
        <button
          v-if="canFallback"
          type="button"
          class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          @click="emit('fallback')"
        >
          切换嵌入模式
        </button>
      </div>
    </div>

    <div
      v-if="showAudioVisual"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6"
    >
      <div class="flex flex-col items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
          <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
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

    <PlayerToolbar
      v-if="!player.mediaFailed && !player.waitingForMedia && !player.needsTapToPlay && !player.isPaused"
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
  background: #000;
}

/*
 * 自建底栏时永久藏微吼原生控制条。
 * hiddneControl 只作用于 .vhallPlayer-container / shadow，不覆盖 .vh-player-controller；
 * 以前靠自建条 z-index 叠盖，暂停卸掉 PlayerToolbar 后原生条会露出来。
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

/* 小屏 orb 60 / PC(md≥768) 80；三角固定 24 / 34 */
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
  width: 24px;
  height: 24px;
  margin-left: calc(var(--orb) * 3 / 64);
  background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAkCAMAAADfNcjQAAAAOVBMVEVHcEz///////////////////////////////////////////////////////////////////////99PJZNAAAAEnRSTlMAKuyQatU8BeL5g1MYqZ2+DsbzwSs0AAAAuUlEQVQ4y4WU2RaEIAxDC7K6IOb/P3ZGxzm4lDavXLGEBCKiOQSSNGQgudhdH3Goi8QMiEhAk58YYMJVq3kBDneVmZ+xybrHIfHS/T/LG0AeL+dZwck3bz14DVEB4M9JUg/4T9IHgG3fxAoA0te1LAEoGmCJoAHyDosypDUycHgl+PBzu2t1CvJdlHpe1sZ/PomBwVBbYIqYFi60+dGfZ+yXWSzOFsTqJa56VSuvWn+K2gOyP0Gmv/gBafkv2boUnyIAAAAASUVORK5CYII=");
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

@media (min-width: 768px) {
  .center-play-icon {
    width: 34px;
    height: 34px;
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
