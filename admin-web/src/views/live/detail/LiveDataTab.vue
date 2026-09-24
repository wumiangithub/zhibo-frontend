<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  getStats,
  getOnlineTrend,
  STATE_LABEL,
  type StatsOverview,
  type TrendPoint,
} from "@/api/activity";

const props = defineProps<{ activityId: number }>();

const overview = ref<StatsOverview | null>(null);
const overviewError = ref("");
const points = ref<TrendPoint[]>([]);
const trendError = ref("");
const trendLoading = ref(false);

type Preset = "1h" | "today" | "yesterday" | "custom";
const activePreset = ref<Preset>("today");
const customStart = ref("");
const customEnd = ref("");

const POLL_INTERVAL = 60_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getPresetRange(preset: Preset): [string, string] {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  if (preset === "1h") {
    start = new Date(now.getTime() - 3600_000);
  } else if (preset === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
    end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
  }
  return [formatTime(start), formatTime(end)];
}

async function fetchOverview() {
  try {
    overview.value = await getStats(props.activityId);
    overviewError.value = "";
  } catch (e) {
    overviewError.value = e instanceof Error ? e.message : "加载概览失败";
  }
}

async function fetchTrend() {
  trendLoading.value = true;
  trendError.value = "";
  points.value = [];
  try {
    let start: string;
    let end: string;
    if (activePreset.value === "custom") {
      if (!customStart.value || !customEnd.value) {
        trendError.value = "请选择起止时间";
        trendLoading.value = false;
        return;
      }
      start = customStart.value.replace("T", " ") + ":00";
      end = customEnd.value.replace("T", " ") + ":00";
    } else {
      [start, end] = getPresetRange(activePreset.value);
    }
    const data = await getOnlineTrend(props.activityId, start, end);
    points.value = data.points ?? [];
  } catch (e) {
    trendError.value = e instanceof Error ? e.message : "加载趋势失败";
  } finally {
    trendLoading.value = false;
  }
}

function selectPreset(p: Preset) {
  activePreset.value = p;
  void fetchTrend();
}

function useCustomRange() {
  activePreset.value = "custom";
  void fetchTrend();
}

const chartWidth = 720;
const chartHeight = 240;
const chartPad = { top: 20, right: 20, bottom: 40, left: 50 };
const innerW = chartWidth - chartPad.left - chartPad.right;
const innerH = chartHeight - chartPad.top - chartPad.bottom;

const maxCount = computed(() => {
  if (points.value.length === 0) return 1;
  return Math.max(1, ...points.value.map((p) => p.count));
});

const polylinePoints = computed(() => {
  if (points.value.length === 0) return "";
  const n = points.value.length;
  return points.value
    .map((p, i) => {
      const x = chartPad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = chartPad.top + innerH - (p.count / maxCount.value) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
});

const yTicks = computed(() => {
  const max = maxCount.value;
  const ticks: { y: number; label: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((max / 4) * i);
    const y = chartPad.top + innerH - (val / max) * innerH;
    ticks.push({ y, label: String(val) });
  }
  return ticks;
});

const xLabels = computed(() => {
  if (points.value.length === 0) return [];
  const n = points.value.length;
  const step = Math.max(1, Math.floor(n / 6));
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < n; i += step) {
    const x = chartPad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const t = points.value[i].time;
    labels.push({ x, text: t.slice(11, 16) || t.slice(5, 10) });
  }
  return labels;
});

function startPoll() {
  void fetchOverview();
  void fetchTrend();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void fetchOverview(), POLL_INTERVAL);
}

onMounted(startPoll);
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
watch(() => props.activityId, startPoll);
</script>

<template>
  <div class="data-tab">
    <p
      v-if="overviewError && !overview"
      class="err"
    >
      {{ overviewError }}
    </p>

    <template v-if="overview">
      <div class="overview">
        <div class="overview-head">
          <div>
            <h3 class="overview-title">{{ overview.title }}</h3>
            <p class="overview-id">ID: {{ overview.id }}</p>
          </div>
          <span class="state-badge">{{ STATE_LABEL[overview.state] ?? overview.state }}</span>
        </div>
        <div class="metrics">
          <div class="metric">
            <p class="metric-label">热度 (PV)</p>
            <p class="metric-value">{{ overview.pv ?? 0 }}</p>
          </div>
          <div class="metric">
            <p class="metric-label">当前在线</p>
            <p class="metric-value is-online">{{ overview.onlineCount ?? 0 }}</p>
          </div>
        </div>
        <p class="hint">概览每 60 秒自动刷新</p>
      </div>

      <div class="trend">
        <h3 class="trend-title">在线趋势</h3>
        <div class="presets">
          <button
            type="button"
            class="preset"
            :class="{ 'is-active': activePreset === '1h' }"
            @click="selectPreset('1h')"
          >
            近 1 小时
          </button>
          <button
            type="button"
            class="preset"
            :class="{ 'is-active': activePreset === 'today' }"
            @click="selectPreset('today')"
          >
            今天
          </button>
          <button
            type="button"
            class="preset"
            :class="{ 'is-active': activePreset === 'yesterday' }"
            @click="selectPreset('yesterday')"
          >
            昨天
          </button>
          <span class="sep">|</span>
          <input
            v-model="customStart"
            type="datetime-local"
            class="dt"
          />
          <span class="to">至</span>
          <input
            v-model="customEnd"
            type="datetime-local"
            class="dt"
          />
          <button
            type="button"
            class="preset"
            @click="useCustomRange"
          >
            查询
          </button>
        </div>

        <p
          v-if="trendError"
          class="err"
        >
          {{ trendError }}
        </p>
        <p
          v-else-if="trendLoading"
          class="empty"
        >
          加载中…
        </p>
        <p
          v-else-if="points.length === 0"
          class="empty"
        >
          该时段暂无在线数据
        </p>
        <div
          v-else
          class="chart-wrap"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="chart"
            preserveAspectRatio="xMidYMid meet"
          >
            <line
              :x1="chartPad.left"
              :y1="chartPad.top + innerH"
              :x2="chartPad.left + innerW"
              :y2="chartPad.top + innerH"
              stroke="#e5e7eb"
              stroke-width="1"
            />
            <line
              :x1="chartPad.left"
              :y1="chartPad.top"
              :x2="chartPad.left"
              :y2="chartPad.top + innerH"
              stroke="#e5e7eb"
              stroke-width="1"
            />
            <line
              v-for="(tick, i) in yTicks"
              :key="i"
              :x1="chartPad.left"
              :y1="tick.y"
              :x2="chartPad.left + innerW"
              :y2="tick.y"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <text
              v-for="(tick, i) in yTicks"
              :key="'l' + i"
              :x="chartPad.left - 8"
              :y="tick.y + 4"
              text-anchor="end"
              class="tick-text"
            >
              {{ tick.label }}
            </text>
            <polyline
              :points="polylinePoints"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <circle
              v-for="(p, i) in points"
              :key="i"
              :cx="chartPad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)"
              :cy="chartPad.top + innerH - (p.count / maxCount) * innerH"
              r="3"
              fill="var(--color-primary)"
            />
            <text
              v-for="(label, i) in xLabels"
              :key="'x' + i"
              :x="label.x"
              :y="chartPad.top + innerH + 24"
              text-anchor="middle"
              class="tick-text"
            >
              {{ label.text }}
            </text>
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.err {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff1f0;
  color: var(--color-danger);
  font-size: 13px;
}
.overview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.overview-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.overview-id {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.state-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  max-width: 420px;
}
.metric {
  padding: 14px;
  border-radius: 6px;
  background: #fafbfc;
}
.metric-label {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.metric-value {
  margin: 6px 0 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
}
.metric-value.is-online {
  color: var(--color-success);
}
.hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.trend {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light);
}
.trend-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.preset {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  outline: none;
}
.preset.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
.sep,
.to {
  color: var(--color-text-placeholder);
  font-size: 13px;
}
.dt {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
}
.empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-placeholder);
}
.chart-wrap {
  overflow-x: auto;
}
.chart {
  width: 100%;
  max-width: 48rem;
}
.tick-text {
  fill: #9ca3af;
  font-size: 11px;
}
</style>
