<script setup lang="ts">
import { Refresh } from "@element-plus/icons-vue";
import { computed, onMounted, ref, watch } from "vue";
import type { ChatController } from "./composables/useChat";
import DataKpiPanel from "./DataKpiPanel.vue";
import PresenceTrendPanel from "./PresenceTrendPanel.vue";
import TradeTrendPanel from "./TradeTrendPanel.vue";
import { getConsoleTradeStats, getConsoleWatchTrade } from "./api/console";

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
const tradeTrendRef = ref<{
  reload: () => Promise<void>;
  resetAndReload: () => Promise<void>;
} | null>(null);
const refreshing = ref(false);

const dealAmount = ref("0.00");
const dealUserCount = ref(0);
const dealProductCount = ref(0);
let watchTradeSeq = 0;

const tradeDealUserCount = ref(0);
const tradeDealProductCount = ref(0);
const productClickUserCount = ref(0);
const dealConversionRate = ref("0.0");
const avgOrderAmount = ref("0.00");
const unpaidUserCount = ref(0);
let tradeStatsSeq = 0;

const chatComments = computed(() =>
  props.chat.chatMessages.filter((m) => m.kind !== "question"),
);
const commentCount = computed(() => chatComments.value.length);
const commentUsers = computed(() => {
  const ids = new Set<string>();
  for (const m of chatComments.value) {
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

/** 观看：2×2 + 底栏居中（与 DataKpiPanel 节奏一致） */
const watchMetrics = computed(() => [
  { label: "评论数", value: commentCount.value },
  { label: "评论人数", value: commentUsers.value },
  { label: "直播间成交金额", value: dealAmount.value },
  { label: "成交人数", value: dealUserCount.value },
  { label: "成交商品数", value: dealProductCount.value },
]);

/** 交易：同结构 — 顶栏成交人数；中 2×2；底未付款人数 */
const tradeMetrics = computed(() => [
  { label: "成交商品数", value: tradeDealProductCount.value },
  { label: "商品点击人数", value: productClickUserCount.value },
  { label: "成交转化率", value: `${dealConversionRate.value}%` },
  { label: "平均客单价", value: avgOrderAmount.value },
  { label: "未付款人数", value: unpaidUserCount.value },
]);

async function loadWatchTrade() {
  const activityId = props.activityId?.trim();
  if (!activityId) {
    dealAmount.value = "0.00";
    dealUserCount.value = 0;
    dealProductCount.value = 0;
    return;
  }
  const seq = ++watchTradeSeq;
  try {
    const data = await getConsoleWatchTrade(activityId);
    if (seq !== watchTradeSeq) return;
    dealAmount.value = data.dealAmount?.trim() || "0.00";
    dealUserCount.value = Number(data.dealUserCount) || 0;
    dealProductCount.value = Number(data.dealProductCount) || 0;
  } catch {
    if (seq !== watchTradeSeq) return;
    /** 失败保留上次值；首拉失败则仍为 0 */
  }
}

async function loadTradeStats() {
  const activityId = props.activityId?.trim();
  if (!activityId) {
    tradeDealUserCount.value = 0;
    tradeDealProductCount.value = 0;
    productClickUserCount.value = 0;
    dealConversionRate.value = "0.0";
    avgOrderAmount.value = "0.00";
    unpaidUserCount.value = 0;
    return;
  }
  const seq = ++tradeStatsSeq;
  try {
    const data = await getConsoleTradeStats(activityId);
    if (seq !== tradeStatsSeq) return;
    tradeDealUserCount.value = Number(data.dealUserCount) || 0;
    tradeDealProductCount.value = Number(data.dealProductCount) || 0;
    productClickUserCount.value = Number(data.productClickUserCount) || 0;
    dealConversionRate.value = data.dealConversionRate?.trim() || "0.0";
    avgOrderAmount.value = data.avgOrderAmount?.trim() || "0.00";
    unpaidUserCount.value = Number(data.unpaidUserCount) || 0;
  } catch {
    if (seq !== tradeStatsSeq) return;
  }
}

/**
 * 刷新整块数据：emit 左侧指标；走势默认保持当前选中范围重拉。
 * resetRange=true 时与顶部「数据」一致：重置默认时间后再拉。
 */
async function refreshAll(opts?: { resetRange?: boolean }) {
  if (refreshing.value) return;
  refreshing.value = true;
  emit("refresh");
  try {
    const trend =
      tab.value === "trade" ? tradeTrendRef.value : trendRef.value;
    await Promise.all([
      loadWatchTrade(),
      loadTradeStats(),
      opts?.resetRange ? trend?.resetAndReload?.() : trend?.reload?.(),
    ]);
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

watch(
  () => props.activityId,
  () => {
    void loadWatchTrade();
    void loadTradeStats();
  },
);

watch(tab, (next) => {
  if (next === "trade") {
    void loadTradeStats();
  }
});

onMounted(() => {
  void loadWatchTrade();
  void loadTradeStats();
});

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
      class="data-body hover-scrollbar"
    >
      <DataKpiPanel
        primary-label="实时在线人数"
        :primary-value="onlineText"
        :metrics="watchMetrics"
      />

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
      class="data-body hover-scrollbar"
    >
      <DataKpiPanel
        primary-label="成交人数"
        :primary-value="tradeDealUserCount"
        :metrics="tradeMetrics"
      />

      <TradeTrendPanel
        ref="tradeTrendRef"
        :activity-id="activityId"
        :start-time="startTime"
        :end-time="endTime"
        :state="state"
      />
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
  /* 中栏宽随侧栏折叠变化，用容器查询而不是 viewport */
  container-type: inline-size;
  container-name: watch-data;
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
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
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
  color: var(--color-primary);
  cursor: pointer;
}

.refresh:hover:not(:disabled) {
  background: var(--color-primary-bg);
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
  /* 双列：左右同高，底边框对齐；KPI 白底填满（内容仍顶对齐，见 DataKpiPanel） */
  align-items: stretch;
  gap: 12px;
  padding: 12px;
  overflow: auto;
  background: #fff;
}

/* 防止走势卡被日期选择器固有宽度撑破栅格 */
.data-body > * {
  min-width: 0;
  max-width: 100%;
  min-height: 0;
}

/**
 * 窄中栏：KPI 在上、走势在下。
 * 第一行 auto → KPI 自然高度；第二行 1fr → 走势吃剩余，互不强行等高。
 */
@container watch-data (max-width: 780px) {
  .data-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: stretch;
    align-content: start;
  }
}
</style>
