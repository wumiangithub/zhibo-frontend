<script setup lang="ts">
import type { WatchSummaryData } from "../api/console";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    countdown: string;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  { hostPlayer: true },
);
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
</style>
