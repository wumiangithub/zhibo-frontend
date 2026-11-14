<script setup lang="ts">
import { useRouter } from "vue-router";
import { useWatchTheme } from "@/composables/useWatchTheme";
import type { WatchSummaryData } from "@/api/watch";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    /** 是否展示「查看回放」入口（开关开） */
    showReplayEntry?: boolean;
    /** 回放已过期：提示 + 按钮不可点 */
    playbackExpired?: boolean;
    /** 正在拉回放列表 */
    replayLoading?: boolean;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  {
    showReplayEntry: false,
    playbackExpired: false,
    replayLoading: false,
    hostPlayer: true,
  },
);

const emit = defineEmits<{
  replay: [];
}>();

const router = useRouter();
const { isLight } = useWatchTheme();

/** 展示到分：去掉末尾秒（如 2026-11-05 12:04:00 → 12:04） */
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
  <!-- 盖住播放器/侧栏内容区；不 Teleport，避免挡住 UiPageHeader / PC 顶栏在线操作 -->
  <div
    class="ended-root"
    :class="{ 'is-light': isLight }"
    role="status"
    aria-label="直播已结束"
  >
    <div class="ended-panel">
      <div class="ended-stack">
        <div
          v-if="data.coverUrl"
          class="ended-cover"
        >
          <img
            class="ended-cover-img"
            :src="data.coverUrl"
            :alt="data.title || '直播封面'"
            loading="lazy"
            decoding="async"
          >
        </div>

        <!-- 2026-11-09：标题在上、状态胶囊在下（见 live-结束页.md） -->
        <h2 class="ended-title">
          {{ data.title }}
        </h2>

        <span class="ended-badge">
          直播已结束
        </span>

        <div
          v-if="data.startTime || data.endTime"
          class="ended-card"
        >
          <!-- 标签单独上行，金轴只覆盖开始/至/结束 -->
          <p class="ended-label">
            直播时间
          </p>

          <div class="ended-card-body">
            <div
              class="ended-timeline"
              aria-hidden="true"
            >
              <span class="ended-node" />
              <span
                v-if="data.endTime"
                class="ended-rail"
              />
              <span
                v-if="data.endTime"
                class="ended-node"
              />
            </div>

            <div class="ended-times">
              <p
                v-if="data.startTime"
                class="ended-time"
              >
                {{ formatToMinute(data.startTime) }}
              </p>
              <template v-if="data.endTime">
                <p class="ended-sep">
                  至
                </p>
                <p class="ended-time">
                  {{ formatToMinute(data.endTime) }}
                </p>
              </template>
            </div>
          </div>
        </div>

        <p
          v-if="showReplayEntry && playbackExpired"
          class="ended-expired"
        >
          回放已过期，无法继续观看
        </p>
        <p
          v-else
          class="ended-thanks"
        >
          感谢观看
        </p>
      </div>

      <div class="ended-actions">
        <button
          v-if="showReplayEntry"
          type="button"
          class="ended-replay"
          :class="{ 'is-disabled': playbackExpired }"
          :disabled="playbackExpired || replayLoading"
          @click="emit('replay')"
        >
          <svg
            v-if="!replayLoading"
            class="ended-replay-icon"
            width="14"
            height="16"
            viewBox="0 0 14 16"
            aria-hidden="true"
          >
            <path
              d="M0 0v16l14-8z"
              fill="currentColor"
            />
          </svg>
          <span>{{ replayLoading ? "加载中…" : "查看回放" }}</span>
        </button>

        <button
          type="button"
          class="ended-home"
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
/* 色板对照 zhibo-shared/docs/设计/live-结束页.md
 * 默认暗色；.lw-theme[data-lw-theme="light"] 切白天
 */
.ended-root {
  /* 盖住 PlayerStage / 微吼 video 层；仍挂在内容区内，不挡 UiPageHeader */
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: auto;
  isolation: isolate;
}

.ended-panel {
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

.ended-stack {
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

.ended-cover {
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  aspect-ratio: 16 / 9;
  box-shadow: none;
}

.ended-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ended-title {
  margin: 0;
  max-width: 100%;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.ended-badge {
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

.ended-card {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  text-align: left;
  box-shadow: none;
}

.ended-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}

/* 左连续金轴 + 右时间三行；轴不跨「直播时间」标签 */
.ended-card-body {
  display: flex;
  width: 100%;
  align-items: stretch;
  gap: 14px;
  font-variant-numeric: tabular-nums;
}

.ended-timeline {
  display: flex;
  width: 10px;
  flex: none;
  flex-direction: column;
  align-items: center;
  /* 16px * 1.35 行高，8px 圆点垂直居中约需上下各 ~7px */
  padding: 7px 0;
}

.ended-node {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: #f5b942;
}

.ended-rail {
  width: 2px;
  flex: 1 1 auto;
  min-height: 8px;
  margin: 0;
  border-radius: 1px;
  background: #f5b942;
}

.ended-times {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
}

.ended-time {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.ended-sep {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.35;
  color: #6b7280;
}

.ended-thanks {
  position: relative;
  margin: 0;
  padding-bottom: 10px;
  font-size: 14px;
  font-weight: 400;
  color: #9ca3af;
}

.ended-thanks::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 52%;
  height: 1px;
  transform: translateX(-50%);
  background: #f5b942;
}

.ended-expired {
  margin: 0;
  font-size: 14px;
  color: #fbbf24;
}

.ended-actions {
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

.ended-replay {
  display: inline-flex;
  width: 100%;
  max-width: 280px;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 12px;
  /* 方案 A：实心蓝，无渐变 / 强外发光 */
  background: #2563eb;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.22);
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.ended-replay-icon {
  flex: none;
  display: block;
}

.ended-replay:not(:disabled):hover {
  background: #1d4ed8;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
}

.ended-replay:not(:disabled):active {
  transform: scale(0.985);
}

.ended-replay:disabled,
.ended-replay.is-disabled {
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.08);
  color: #6b7280;
  box-shadow: none;
}

.ended-home {
  border: 0;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;
}

.ended-home:hover {
  color: #93c5fd;
}

/* —— 白天 —— */
.ended-root.is-light .ended-panel {
  background: #f5f7fb;
  color: #0f172a;
}

.ended-root.is-light .ended-panel::before {
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

.ended-root.is-light .ended-cover {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.ended-root.is-light .ended-title {
  color: #0f172a;
}

.ended-root.is-light .ended-badge {
  border-color: #e2e8f0;
  background: #ffffff;
  color: #64748b;
}

.ended-root.is-light .ended-card {
  border-color: #e2e8f0;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.ended-root.is-light .ended-label {
  color: #64748b;
}

.ended-root.is-light .ended-time {
  font-size: 17px;
  font-weight: 500;
  color: #0f172a;
}

.ended-root.is-light .ended-sep {
  color: #94a3b8;
}

.ended-root.is-light .ended-thanks {
  color: #64748b;
}

.ended-root.is-light .ended-expired {
  color: #d97706;
}

.ended-root.is-light .ended-replay:disabled,
.ended-root.is-light .ended-replay.is-disabled {
  background: #e2e8f0;
  color: #94a3b8;
}

.ended-root.is-light .ended-home {
  color: #64748b;
}

.ended-root.is-light .ended-home:hover {
  color: #2563eb;
}
</style>
