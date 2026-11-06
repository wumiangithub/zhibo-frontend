<script setup lang="ts">
import type { WatchSummaryData } from "../api/console";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    /** 是否展示「查看回放」入口（开关开） */
    showReplayEntry?: boolean;
    /** 回放已过期：提示 + 按钮不可点 */
    playbackExpired?: boolean;
    /** 正在拉回放列表 */
    replayLoading?: boolean;
    /** 再开播引导（主页挂 SDK 时才能收到 live_start） */
    showLiveStartPopup?: boolean;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  {
    showReplayEntry: false,
    playbackExpired: false,
    replayLoading: false,
    showLiveStartPopup: false,
    hostPlayer: true,
  },
);

const emit = defineEmits<{
  replay: [];
  enter: [];
}>();
</script>

<template>
  <div class="ended-shell flex flex-col">
    <div class="ended-panel absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-5 text-center">
      <span class="ended-badge">
        <span class="ended-badge-dot" />
        直播已结束
      </span>

      <div class="ended-time-card">
        <p class="ended-time-label">
          直播时间
        </p>
        <p class="ended-time-value">
          {{ data.startTime || "—" }}
        </p>
        <template v-if="data.endTime">
          <p class="ended-time-sep">
            至
          </p>
          <p class="ended-time-value">
            {{ data.endTime }}
          </p>
        </template>
      </div>

      <p
        v-if="showReplayEntry && playbackExpired"
        class="ended-hint is-warn"
      >
        回放已过期，无法继续观看
      </p>
      <p
        v-else
        class="ended-hint"
      >
        本场已结束，名单与数据仍可查看
      </p>

      <button
        v-if="showReplayEntry"
        type="button"
        class="ended-btn"
        :class="{ 'is-disabled': playbackExpired }"
        :disabled="playbackExpired || replayLoading"
        @click="emit('replay')"
      >
        {{ replayLoading ? "加载中…" : "查看回放" }}
      </button>
    </div>

    <div
      v-if="showLiveStartPopup"
      class="ended-popup-mask absolute inset-0 z-20 flex items-center justify-center p-4"
    >
      <div class="ended-popup">
        <span class="ended-live-badge">
          <span class="ended-live-dot" />
          直播已开始
        </span>
        <h3 class="ended-popup-title">
          直播已开始
        </h3>
        <p class="ended-popup-desc">
          点击下方按钮进入直播画面
        </p>
        <button
          type="button"
          class="ended-btn is-block"
          @click="emit('enter')"
        >
          立即观看
        </button>
      </div>
    </div>

    <template v-if="hostPlayer">
      <div
        id="player"
        class="min-h-0 w-full flex-1 opacity-0"
      />
      <div
        id="docWrap"
        class="hidden"
      />
    </template>
  </div>
</template>

<style scoped>
.ended-panel {
  background: var(--color-bg-muted, #fafafa);
}

.ended-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border, #e4e7ed);
  background: var(--color-bg-card, #fff);
  color: var(--color-text-secondary, #666);
  font-size: 12px;
  font-weight: 500;
}

.ended-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-placeholder, #999);
}

.ended-time-card {
  margin-top: 4px;
  min-width: 220px;
  padding: 14px 20px;
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: 8px;
  background: var(--color-bg-card, #fff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.ended-time-label {
  margin: 0;
  color: var(--color-text-placeholder, #999);
  font-size: 12px;
}

.ended-time-value {
  margin: 4px 0 0;
  color: var(--color-text, #333);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ended-time-sep {
  margin: 4px 0 0;
  color: var(--color-text-placeholder, #999);
  font-size: 11px;
}

.ended-hint {
  margin: 0;
  max-width: 280px;
  color: var(--color-text-placeholder, #999);
  font-size: 12px;
  line-height: 1.5;
}

.ended-hint.is-warn {
  color: var(--color-warning, #faad14);
}

.ended-btn {
  min-width: 140px;
  height: 36px;
  margin-top: 4px;
  padding: 0 16px;
  border: 0;
  border-radius: 6px;
  background: var(--color-primary, #2f54eb);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.ended-btn:hover:not(:disabled) {
  background: var(--color-primary-hover, #1d39c4);
}

.ended-btn.is-block {
  width: 100%;
}

.ended-btn.is-disabled,
.ended-btn:disabled {
  background: var(--color-border, #e4e7ed);
  color: var(--color-text-disabled, #bfbfbf);
  cursor: not-allowed;
}

.ended-popup-mask {
  background: rgba(0, 0, 0, 0.35);
}

.ended-popup {
  width: 100%;
  max-width: 320px;
  padding: 20px;
  border-radius: 10px;
  background: var(--color-bg-card, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  text-align: center;
}

.ended-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff1f0;
  color: var(--color-danger, #f5222d);
  font-size: 12px;
  font-weight: 600;
}

.ended-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger, #f5222d);
  animation: ended-pulse 1.2s ease-in-out infinite;
}

.ended-popup-title {
  margin: 0 0 6px;
  color: var(--color-text, #333);
  font-size: 16px;
  font-weight: 600;
}

.ended-popup-desc {
  margin: 0 0 16px;
  color: var(--color-text-secondary, #666);
  font-size: 13px;
}

@keyframes ended-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
