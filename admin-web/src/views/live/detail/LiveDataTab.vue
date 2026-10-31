<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElDatePicker, ElMessage, ElTabPane, ElTabs, ElTooltip } from "element-plus";
import {
  getActivityPresenceTrend,
  getActivityUserData,
  type ActivityId,
  type ActivityUserData,
  type PresenceTrendPoint,
  type UserDataRowType,
} from "@/api/activity";
import { loadEcharts, type EChartsInstance } from "@/utils/loadEcharts";

const props = defineProps<{ activityId: ActivityId }>();

const POLL_MS = 120_000;
/** ElTabs 必须绑 v-model，否则页签内容区不展开（只剩标题线） */
const innerTab = ref("user");

const userData = ref<ActivityUserData | null>(null);
const overviewError = ref("");
const overviewLoading = ref(false);

const range = ref<[Date, Date] | null>(null);
const points = ref<PresenceTrendPoint[]>([]);
const trendError = ref("");
const trendLoading = ref(false);

const chartEl = ref<HTMLDivElement | null>(null);
let chart: EChartsInstance | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let resizeObserver: ResizeObserver | null = null;

const ROW_LABEL: Record<UserDataRowType, string> = {
  live_replay: "直播+回放",
  live: "直播",
  replay: "回放",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatApiTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseApiTime(s: string): Date | null {
  if (!s) return null;
  const normalized = s.trim().replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDurationSec(sec: number) {
  const n = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function clampRangeToOneDay(start: Date, end: Date): [Date, Date] {
  let s = start;
  let e = end;
  if (e.getTime() < s.getTime()) {
    e = new Date(s.getTime() + 60_000);
  }
  if (e.getTime() - s.getTime() > 86_400_000) {
    e = new Date(s.getTime() + 86_400_000);
  }
  return [s, e];
}

async function fetchUserData(resetRange: boolean) {
  overviewLoading.value = true;
  overviewError.value = "";
  try {
    const data = await getActivityUserData(props.activityId);
    userData.value = data;
    if (resetRange || !range.value) {
      const start = parseApiTime(data.trendDefault.startTime);
      const end = parseApiTime(data.trendDefault.endTime);
      if (start && end) {
        range.value = clampRangeToOneDay(start, end);
      }
    }
  } catch (e) {
    overviewError.value = e instanceof Error ? e.message : "加载用户数据失败";
  } finally {
    overviewLoading.value = false;
  }
}

async function fetchTrend() {
  if (!range.value) {
    trendError.value = "请选择起止时间";
    points.value = [];
    renderChart();
    return;
  }
  const [rawStart, rawEnd] = clampRangeToOneDay(range.value[0], range.value[1]);
  range.value = [rawStart, rawEnd];
  trendLoading.value = true;
  trendError.value = "";
  try {
    const data = await getActivityPresenceTrend(
      props.activityId,
      formatApiTime(rawStart),
      formatApiTime(rawEnd),
      60,
    );
    points.value = data.points ?? [];
  } catch (e) {
    points.value = [];
    trendError.value = e instanceof Error ? e.message : "加载趋势失败";
  } finally {
    trendLoading.value = false;
    await nextTick();
    renderChart();
  }
}

async function ensureChart() {
  if (chart || !chartEl.value) return;
  try {
    const echarts = await loadEcharts();
    if (!chartEl.value) return;
    chart = echarts.init(chartEl.value);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "ECharts 加载失败");
  }
}

function renderChart() {
  void (async () => {
    await ensureChart();
    if (!chart) return;
    if (points.value.length === 0) {
      chart.clear();
      return;
    }
    const times = points.value.map((p) => p.time);
    const online = points.value.map((p) => p.online ?? 0);
    chart.setOption(
      {
        color: ["#409eff"],
        grid: { left: 48, right: 24, top: 24, bottom: 72 },
        tooltip: {
          trigger: "axis",
          formatter: (params: unknown) => {
            const list = Array.isArray(params) ? params : [params];
            const first = list[0] as { axisValue?: string; data?: number };
            const time = first?.axisValue ?? "";
            const val = first?.data ?? 0;
            return `${time}<br/>在线人数：${val}`;
          },
        },
        dataZoom: [
          { type: "inside", xAxisIndex: 0 },
          {
            type: "slider",
            xAxisIndex: 0,
            height: 18,
            bottom: 12,
          },
        ],
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: times,
          axisLabel: {
            formatter: (v: string) => (v.length >= 19 ? v.slice(11) : v),
          },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          splitLine: { lineStyle: { color: "#f0f0f0" } },
        },
        series: [
          {
            name: "在线人数",
            type: "line",
            smooth: false,
            showSymbol: true,
            symbolSize: 6,
            areaStyle: { opacity: 0.25 },
            data: online,
          },
        ],
      },
      true,
    );
  })();
}

function onRangeChange(val: [Date, Date] | null) {
  if (!val) {
    range.value = null;
    return;
  }
  range.value = clampRangeToOneDay(val[0], val[1]);
  void fetchTrend();
}

async function refreshAll(resetRange: boolean) {
  await fetchUserData(resetRange);
  await fetchTrend();
}

function startPoll() {
  void refreshAll(true);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void refreshAll(false), POLL_MS);
}

const EMPTY_ROWS: ActivityUserData["rows"] = [
  { type: "live_replay", viewerCount: 0, viewCount: 0, avgWatchDurationSec: 0 },
  { type: "live", viewerCount: 0, viewCount: 0, avgWatchDurationSec: 0 },
  { type: "replay", viewerCount: 0, viewCount: 0, avgWatchDurationSec: 0 },
];

const summary = computed(() => userData.value?.summary ?? null);
const displayRows = computed(() =>
  userData.value?.rows?.length ? userData.value.rows : EMPTY_ROWS,
);

onMounted(() => {
  startPoll();
  void nextTick(() => {
    if (chartEl.value && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => chart?.resize());
      resizeObserver.observe(chartEl.value);
    }
  });
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});

watch(
  () => props.activityId,
  () => startPoll(),
);
</script>

<template>
  <div class="data-tab">
    <ElTabs
      v-model="innerTab"
      class="data-tabs"
    >
      <ElTabPane
        label="用户数据"
        name="user"
      >
        <p
          v-if="overviewError"
          class="err"
        >
          {{ overviewError }}
        </p>
        <p
          v-else-if="overviewLoading && !userData"
          class="empty"
        >
          加载中…
        </p>

        <template v-else>
          <section class="block traffic">
            <div class="block-head">
              <h3 class="block-title">流量观看</h3>
            </div>
            <div class="summary-bar">
              <span class="summary-label">全时段数据</span>
              <div class="summary-metrics">
                <div class="summary-item">
                  <span class="k">直播间访客数</span>
                  <span class="v">{{ summary?.visitorCount ?? 0 }}</span>
                </div>
                <div class="summary-item">
                  <span class="k">直播间浏览量</span>
                  <span class="v">{{ summary?.viewCount ?? 0 }}</span>
                </div>
                <div class="summary-item">
                  <span class="k">直播间人均停留时长</span>
                  <span class="v">{{ formatDurationSec(summary?.avgStayDurationSec ?? 0) }}</span>
                </div>
              </div>
            </div>

            <table class="watch-table">
              <thead>
                <tr>
                  <th>观看类型</th>
                  <th>观看人数</th>
                  <th>观看人次</th>
                  <th>人均观看时长</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in displayRows"
                  :key="row.type"
                >
                  <td>{{ ROW_LABEL[row.type] ?? row.type }}</td>
                  <td>{{ row.viewerCount }}</td>
                  <td>{{ row.viewCount }}</td>
                  <td>{{ formatDurationSec(row.avgWatchDurationSec) }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="block trend">
            <div class="trend-head">
              <div class="trend-title-wrap">
                <h3 class="block-title">在线人数趋势图</h3>
                <ElTooltip
                  content="数据每2分钟更新1次"
                  placement="top"
                >
                  <span
                    class="info-i"
                    aria-label="数据更新说明"
                  >i</span>
                </ElTooltip>
              </div>
              <ElDatePicker
                v-model="range"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                format="YYYY-MM-DD HH:mm:ss"
                :clearable="false"
                @change="onRangeChange"
              />
            </div>

            <p
              v-if="trendError"
              class="err"
            >
              {{ trendError }}
            </p>
            <p
              v-else-if="trendLoading && points.length === 0"
              class="empty"
            >
              加载中…
            </p>
            <p
              v-else-if="!trendLoading && points.length === 0"
              class="empty"
            >
              该时段暂无在线数据
            </p>
            <div
              ref="chartEl"
              class="chart"
              :class="{ 'is-hidden': points.length === 0 }"
            />
          </section>
        </template>
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<style scoped>
.data-tab {
  padding: 4px 0 24px;
}
.data-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
.err {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff1f0;
  color: var(--color-danger);
  font-size: 13px;
}
.empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-placeholder);
}
.block {
  margin-bottom: 28px;
}
.block-head {
  margin-bottom: 12px;
}
.block-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--color-border-light, #ebeef5);
  border-radius: 4px;
  background: #fafbfc;
}
.summary-label {
  font-size: 13px;
  color: var(--color-text-secondary, #606266);
  white-space: nowrap;
}
.summary-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 36px;
}
.summary-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.summary-item .k {
  font-size: 13px;
  color: var(--color-text-placeholder, #909399);
}
.summary-item .v {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}
.watch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.watch-table th,
.watch-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
  text-align: left;
}
.watch-table th {
  color: var(--color-text-secondary, #606266);
  font-weight: 500;
  background: #fafbfc;
}
.trend-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.trend-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.info-i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #c0c4cc;
  color: #909399;
  font-size: 11px;
  font-style: normal;
  line-height: 1;
  cursor: default;
  user-select: none;
}
.chart {
  width: 100%;
  height: 360px;
}
.chart.is-hidden {
  display: none;
}
</style>
