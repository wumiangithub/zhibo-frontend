<script setup lang="ts">
import type { WatchSummaryData } from "../api/console";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    countdown: string;
    /**
     * false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做预告壳。
     * 左封面（contain，不撑满）/ 右文案；高度封顶同直播井。
     */
    hostPlayer?: boolean;
  }>(),
  { hostPlayer: true },
);
</script>

<template>
  <div
    class="preview-shell"
    role="status"
    aria-label="距离开播倒计时"
  >
    <div class="preview-cover-pane">
      <img
        v-if="data.coverUrl"
        class="preview-cover"
        :src="data.coverUrl"
        :alt="data.title || '直播封面'"
        loading="lazy"
        decoding="async"
      >
      <div
        v-else
        class="preview-cover-empty"
        aria-hidden="true"
      />
    </div>

    <div class="preview-meta">
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
        class="preview-host-player"
      />
      <div
        id="docWrap"
        class="hidden"
      />
    </template>
  </div>
</template>

<style scoped>
.preview-shell {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 28px;
  box-sizing: border-box;
  padding: 20px 28px;
  overflow: hidden;
  background: var(--color-bg-muted, #fafafa);
}

.preview-cover-pane {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  max-width: min(52%, 420px);
  max-height: 100%;
  min-width: 0;
}

.preview-cover {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  object-position: center;
  border-radius: 8px;
  background: var(--color-bg-card, #fff);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.preview-cover-empty {
  width: min(100%, 280px);
  aspect-ratio: 16 / 9;
  max-height: 100%;
  border-radius: 8px;
  background: var(--color-bg-card, #fff);
  border: 1px dashed var(--color-border, #e4e7ed);
}

.preview-meta {
  display: flex;
  flex: 0 1 280px;
  min-width: 160px;
  max-width: 320px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  text-align: left;
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
  margin: 0;
  color: var(--color-text-secondary, #666);
  font-size: 13px;
}

.preview-countdown {
  margin: 0;
  color: var(--color-text, #333);
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.preview-start {
  margin: 0;
  color: var(--color-text-placeholder, #999);
  font-size: 12px;
}

.preview-host-player {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>
