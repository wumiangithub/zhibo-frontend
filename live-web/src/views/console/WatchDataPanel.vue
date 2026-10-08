<script setup lang="ts">
import { Refresh } from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import type { ChatController } from "@/composables/useChat";
import PresenceTrendPanel from "./PresenceTrendPanel.vue";

const props = defineProps<{
  activityId: string;
  startTime?: string;
  endTime?: string;
  state?: number;
  onlineCount?: number | string;
  chat: ChatController;
}>();

const emit = defineEmits<{
  /** 刷新整块数据模块（左侧指标 + 右侧走势） */
  refresh: [];
}>();

type DataTab = "watch" | "trade";
const tab = ref<DataTab>("watch");
const trendRef = ref<{
  reload: () => Promise<void>;
  resetAndReload: () => Promise<void>;
} | null>(null);
const refreshing = ref(false);

const commentCount = computed(() => props.chat.chatMessages.length);
const commentUsers = computed(() => {
  const ids = new Set<string>();
  for (const m of props.chat.chatMessages) {
    const id = m.sender_id?.trim();
    if (id) ids.add(id);
  }
  return ids.size;
});

const onlineText = computed(() => {
  const n = props.onlineCount;
  if (n === undefined || n === null || n === "" || n === "—") return "0";
  return String(n);
});

const subMetrics = computed(() => [
  { label: "评论数", value: commentCount.value },
  { label: "评论人数", value: commentUsers.value },
  { label: "直播间成交金额", value: 0 },
  { label: "成交人数", value: 0 },
  { label: "成交商品数", value: 0 },
]);

/**
 * 刷新整块数据：emit 左侧指标；走势默认保持当前选中范围重拉（见 PresenceTrendPanel.reload）。
 * resetRange=true 时与顶部「数据」一致：重置默认时间后再拉。
 */
async function refreshAll(opts?: { resetRange?: boolean }) {
  if (refreshing.value) return;
  refreshing.value = true;
  emit("refresh");
  try {
    if (opts?.resetRange) {
      await trendRef.value?.resetAndReload?.();
    } else {
      await trendRef.value?.reload?.();
    }
  } finally {
    refreshing.value = false;
  }
}

/** 顶栏 ↻：不重置时间范围，只重拉 */
function onClickRefresh() {
  void refreshAll();
}

/** 重复点「数据」：刷新并重置走势时间范围为默认 */
async function refreshAndResetRange() {
  await refreshAll({ resetRange: true });
}

defineExpose({ refreshAll, refreshAndResetRange });
</script>

<template>
  <section
    class="watch-data"
    aria-label="数据"
  >
    <header class="data-head">
      <div class="tabs">
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': tab === 'watch' }"
          @click="tab = 'watch'"
        >
          观看数据
        </button>
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': tab === 'trade' }"
          @click="tab = 'trade'"
        >
          交易数据
        </button>
      </div>
      <span class="dim">统计维度：本场直播场次</span>
      <button
        type="button"
        class="refresh"
        title="刷新数据"
        aria-label="刷新数据"
        :disabled="refreshing"
        @click="onClickRefresh"
      >
        <el-icon :size="16"><Refresh /></el-icon>
      </button>
    </header>

    <div
      v-if="tab === 'watch'"
      class="data-body"
    >
      <section class="summary">
        <div class="online-block">
          <div class="online-label">实时在线人数</div>
          <div class="online-value">{{ onlineText }}</div>
        </div>
        <div class="metric-grid">
          <div
            v-for="item in subMetrics"
            :key="item.label"
            class="sub-metric"
          >
            <div class="sub-value">{{ item.value }}</div>
            <div class="sub-label">{{ item.label }}</div>
          </div>
        </div>
      </section>

      <PresenceTrendPanel
        ref="trendRef"
        :activity-id="activityId"
        :start-time="startTime"
        :end-time="endTime"
        :state="state"
      />
    </div>

    <div
      v-else
      class="trade-empty"
    >
      交易数据暂未开放
    </div>
  </section>
</template>

<style scoped>
.watch-data {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 0 16px 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}

.data-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.tabs {
  display: flex;
}

.tab {
  height: 44px;
  padding: 0 4px;
  margin-right: 24px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #333;
  font-size: 14px;
  cursor: pointer;
}

.tab.is-active {
  color: #1677ff;
  border-bottom-color: #1677ff;
  font-weight: 600;
}

.dim {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.refresh {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #1677ff;
  cursor: pointer;
}

.refresh:hover:not(:disabled) {
  background: #e6f4ff;
}

.refresh:disabled {
  opacity: 0.5;
  cursor: default;
}

.data-body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  overflow: auto;
  background: #fafafa;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}

.online-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.online-label {
  color: #666;
  font-size: 13px;
}

.online-value {
  color: #1677ff;
  font-size: 44px;
  font-weight: 600;
  line-height: 1.1;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 8px;
}

.sub-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sub-metric:last-child {
  grid-column: 1 / -1;
}

.sub-value {
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.sub-label {
  color: #999;
  font-size: 12px;
}

.trade-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
  background: #fafafa;
}
</style>
