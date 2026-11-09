<script setup lang="ts">
import { useRouter } from "vue-router";
import { useWatchTheme } from "@/composables/useWatchTheme";
import type { WatchSummaryData } from "@/api/watch";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    countdown: string;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  { hostPlayer: true },
);

const router = useRouter();
const { isLight } = useWatchTheme();

/** 展示到分：去掉末尾秒（如 2026-12-01 00:00:00 → 00:00） */
function formatToMinute(raw?: string): string {
  if (!raw) return "";
  const t = raw.trim();
  return t.replace(/:\d{2}(?:\.\d+)?$/, "");
}

function goHome() {
  void router.push({ name: "news-home" });
}
</script>

<template>
  <!-- 盖住播放器/侧栏内容区；不 Teleport，避免挡住 UiPageHeader / PC 顶栏 -->
  <div
    class="preview-root"
    :class="{ 'is-light': isLight }"
    role="status"
    aria-label="距离开播倒计时"
  >
    <div class="preview-panel">
      <div class="preview-stack">
        <h2 class="preview-title">
          {{ data.title }}
        </h2>

        <span class="preview-badge">
          未开播
        </span>

        <div class="preview-card">
          <p class="preview-label">
            距离开播还有
          </p>
          <p class="preview-countdown">
            {{ countdown || "—" }}
          </p>
          <p
            v-if="data.startTime"
            class="preview-start"
          >
            开始时间：{{ formatToMinute(data.startTime) }}
          </p>
        </div>
      </div>

      <div class="preview-actions">
        <button
          type="button"
          class="preview-home"
          @click="goHome"
        >
          返回首页
        </button>
      </div>
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
</template>

<style scoped>
/* 色板与 EndedScreen 对齐（live-结束页.md）；默认暗色，.is-light 切白天 */
.preview-root {
  /* 盖住 PlayerStage / 微吼 video 层；仍挂在内容区内，不挡 UiPageHeader / 本地开发条 */
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: auto;
  isolation: isolate;
}

.preview-panel {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px calc(32px + env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  background: linear-gradient(180deg, #0b1220 0%, #111827 48%, #0b1220 100%);
  color: #ffffff;
}

.preview-stack {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 340px;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.preview-title {
  margin: 0;
  max-width: 100%;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.preview-card {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  text-align: center;
  box-shadow: none;
}

.preview-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}

.preview-countdown {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}

.preview-start {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}

.preview-actions {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 280px;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}

.preview-home {
  border: 0;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;
}

.preview-home:hover {
  color: #93c5fd;
}

/* —— 白天 —— */
.preview-root.is-light .preview-panel {
  background: #f5f7fb;
  color: #0f172a;
}

.preview-root.is-light .preview-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 80% 50% at 50% 20%,
    rgba(37, 99, 235, 0.06),
    transparent 70%
  );
}

.preview-root.is-light .preview-title {
  color: #0f172a;
}

.preview-root.is-light .preview-badge {
  border-color: #e2e8f0;
  background: #ffffff;
  color: #64748b;
}

.preview-root.is-light .preview-card {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.preview-root.is-light .preview-label {
  color: #64748b;
}

.preview-root.is-light .preview-countdown {
  color: #0f172a;
}

.preview-root.is-light .preview-start {
  color: #64748b;
}

.preview-root.is-light .preview-home {
  color: #64748b;
}

.preview-root.is-light .preview-home:hover {
  color: #2563eb;
}
</style>
