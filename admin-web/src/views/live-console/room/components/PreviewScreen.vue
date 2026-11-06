<script setup lang="ts">
import type { WatchSummaryData } from "../api/console";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    countdown: string;
    showLiveStartPopup: boolean;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  { hostPlayer: true },
);

const emit = defineEmits<{ enter: [] }>();
</script>

<template>
  <div class="preview-shell relative flex flex-1 flex-col">
    <div class="preview-panel absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-5 text-center">
      <span class="preview-badge">预告中</span>
      <p class="preview-label">
        距离开播还有
      </p>
      <p class="preview-countdown">
        {{ countdown || "—" }}
      </p>
      <p class="preview-start">
        开始时间：{{ data.startTime || "—" }}
      </p>
    </div>

    <div
      v-if="showLiveStartPopup"
      class="preview-popup-mask absolute inset-0 z-20 flex items-center justify-center p-4"
    >
      <div class="preview-popup">
        <span class="preview-live-badge">
          <span class="preview-live-dot" />
          直播已开始
        </span>
        <h3 class="preview-popup-title">
          直播已开始
        </h3>
        <p class="preview-popup-desc">
          点击下方按钮进入直播画面
        </p>
        <button
          type="button"
          class="preview-btn"
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
.preview-panel {
  background: var(--color-bg-muted, #fafafa);
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-primary-border, #d6e0ff);
  background: var(--color-primary-bg, #f0f5ff);
  color: var(--color-primary, #2f54eb);
  font-size: 12px;
  font-weight: 600;
}

.preview-label {
  margin: 4px 0 0;
  color: var(--color-text-secondary, #666);
  font-size: 13px;
}

.preview-countdown {
  margin: 0;
  color: var(--color-text, #333);
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.preview-start {
  margin: 0;
  color: var(--color-text-placeholder, #999);
  font-size: 12px;
}

.preview-popup-mask {
  background: rgba(0, 0, 0, 0.35);
}

.preview-popup {
  width: 100%;
  max-width: 320px;
  padding: 20px;
  border-radius: 10px;
  background: var(--color-bg-card, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  text-align: center;
}

.preview-live-badge {
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

.preview-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger, #f5222d);
  animation: preview-pulse 1.2s ease-in-out infinite;
}

.preview-popup-title {
  margin: 0 0 6px;
  color: var(--color-text, #333);
  font-size: 16px;
  font-weight: 600;
}

.preview-popup-desc {
  margin: 0 0 16px;
  color: var(--color-text-secondary, #666);
  font-size: 13px;
}

.preview-btn {
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 6px;
  background: var(--color-primary, #2f54eb);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.preview-btn:hover {
  background: var(--color-primary-hover, #1d39c4);
}

@keyframes preview-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
