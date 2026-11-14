<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElDatePicker, ElMessage } from "element-plus";
import { fetchTradeTrend, type ConsoleTradeTrendPoint } from "./api/console";
import {
  clampPresenceTrendRange,
  formatPresenceTime,
  resolvePresenceTrendRange,
} from "./presenceTrendRange";

const props = defineProps<{
  activityId: string;
  startTime?: string;
  endTime?: string;
  state?: number;
}>();

const loading = ref(false);
const error = ref("");
const points = ref<ConsoleTradeTrendPoint[]>([]);
const rangeModel = ref<[string, string] | null>(null);
const hoverIndex = ref<number | null>(null);

let seq = 0;
let rangeInited = false;
let sessionRangeSynced = false;
let userAdjustedRange = false;

function isSessionEnded(state?: number): boolean {
  return state === 3 || state === 4 || state === 5;
}

function initRangeFromProps() {
  const range = resolvePresenceTrendRange({
    startTime: props.startTime,
    endTime: props.endTime,
    state: props.state,
  });
  rangeModel.value = [range.startTime, range.endTime];
  rangeInited = true;
  userAdjustedRange = false;
}

async function reload() {
  if (
    !userAdjustedRange &&
    !isSessionEnded(props.state) &&
    rangeModel.value
  ) {
    const start = rangeModel.value[0];
    const clamped = clampPresenceTrendRange(
      start,
      formatPresenceTime(new Date()),
    );
    rangeModel.value = [clamped.startTime, clamped.endTime];
  }
  await load();
}

async function resetAndReload() {
  initRangeFromProps();
  await load();
}

const chartWidth = 560;
const chartHeight = 280;
const pad = { top: 20, right: 16, bottom: 36, left: 44 };
const innerW = chartWidth - pad.left - pad.right;
const innerH = chartHeight - pad.top - pad.bottom;

const SERIES = [
  { key: "dealAmount" as const, label: "成交金额", color: "#FA8C16" },
  { key: "soldCount" as const, label: "销量", color: "#722ED1" },
];

function amountNum(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const maxY = computed(() => {
  if (!points.value.length) return 1;
  let max = 1;
  for (const p of points.value) {
    max = Math.max(max, amountNum(p.dealAmount), p.soldCount);
  }
  return max;
});

const hasSeriesData = computed(() =>
  points.value.some((p) => amountNum(p.dealAmount) > 0 || p.soldCount > 0),
);

function xAt(i: number, n: number): number {
  return pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
}

function yAt(val: number): number {
  return pad.top + innerH - (val / maxY.value) * innerH;
}

function seriesPath(key: "dealAmount" | "soldCount"): string {
  const list = points.value;
  if (!list.length) return "";
  const n = list.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const val = key === "dealAmount" ? amountNum(list[i].dealAmount) : list[i].soldCount;
    const cmd = i === 0 ? "M" : "L";
    d += `${cmd}${xAt(i, n)} ${yAt(val)} `;
  }
  return d.trim();
}

const amountPath = computed(() => seriesPath("dealAmount"));
const soldPath = computed(() => seriesPath("soldCount"));

const yTicks = computed(() => {
  const max = maxY.value;
  const steps = 4;
  const ticks: { y: number; label: string }[] = [];
  for (let i = 0; i <= steps; i++) {
    const val = (max / steps) * i;
    ticks.push({
      y: yAt(val),
      label: Number.isInteger(val) ? String(val) : val.toFixed(1),
    });
  }
  return ticks;
});

const xLabels = computed(() => {
  const list = points.value;
  const n = list.length;
  if (!n) return [];
  const labels: { x: number; text: string }[] = [];
  const step = Math.max(1, Math.floor((n - 1) / 4));
  for (let i = 0; i < n; i += step) {
    const t = list[i].time;
    labels.push({ x: xAt(i, n), text: t.slice(11, 16) || t.slice(5, 10) });
  }
  if (n > 1 && (n - 1) % step !== 0) {
    const t = list[n - 1].time;
    labels.push({ x: xAt(n - 1, n), text: t.slice(11, 16) || t.slice(5, 10) });
  }
  return labels;
});

const hoverPoint = computed(() => {
  if (hoverIndex.value == null) return null;
  return points.value[hoverIndex.value] ?? null;
});

const hoverTipStyle = computed(() => {
  if (hoverIndex.value == null || !points.value.length) return {};
  const n = points.value.length;
  const x = xAt(hoverIndex.value, n);
  const left = Math.min(Math.max(x + 8, 8), chartWidth - 160);
  return { left: `${(left / chartWidth) * 100}%` };
});

function onMove(ev: MouseEvent) {
  const svg = ev.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * chartWidth;
  const n = points.value.length;
  if (n <= 0) {
    hoverIndex.value = null;
    return;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(xAt(i, n) - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  hoverIndex.value = best;
}

function onLeave() {
  hoverIndex.value = null;
}

async function load() {
  const id = props.activityId.trim();
  if (!id) return;
  if (!rangeModel.value) initRangeFromProps();
  const current = rangeModel.value;
  if (!current) return;
  const range = clampPresenceTrendRange(current[0], current[1]);
  if (range.clamped) {
    rangeModel.value = [range.startTime, range.endTime];
  }
  const my = ++seq;
  loading.value = true;
  error.value = "";
  hoverIndex.value = null;
  try {
    const res = await fetchTradeTrend(id, {
      startTime: range.startTime,
      endTime: range.endTime,
      bucketSeconds: 60,
    });
    if (my !== seq) return;
    points.value = res.points ?? [];
  } catch (e) {
    if (my !== seq) return;
    points.value = [];
    error.value = e instanceof Error ? e.message : "走势加载失败";
  } finally {
    if (my === seq) loading.value = false;
  }
}

function onRangeChange(val: [string, string] | null) {
  if (!val) {
    initRangeFromProps();
    void load();
    return;
  }
  userAdjustedRange = true;
  const clamped = clampPresenceTrendRange(val[0], val[1]);
  if (clamped.clamped) {
    rangeModel.value = [clamped.startTime, clamped.endTime];
    ElMessage.warning("时间跨度不能超过 1 天，已自动截取");
  } else {
    rangeModel.value = val;
  }
  void load();
}

watch(
  () => props.activityId,
  () => {
    sessionRangeSynced = false;
    userAdjustedRange = false;
    initRangeFromProps();
    void load();
  },
);

watch(
  () => [props.startTime, props.endTime, props.state] as const,
  () => {
    if (!rangeInited) {
      initRangeFromProps();
      void load();
      return;
    }
    if (
      !sessionRangeSynced &&
      (props.startTime || props.endTime || props.state != null)
    ) {
      sessionRangeSynced = true;
      initRangeFromProps();
      void load();
    }
  },
);

onMounted(() => {
  if (props.startTime || props.endTime || props.state != null) {
    sessionRangeSynced = true;
  }
  initRangeFromProps();
  void load();
});

defineExpose({ reload, resetAndReload });
</script>

<template>
  <section class="chart-card">
    <header class="card-head">
      <div class="card-head-main">
        <h4>成交趋势</h4>
        <div class="legend">
          <span
            v-for="s in SERIES"
            :key="s.key"
            class="legend-item"
          >
            <i
              class="legend-dot"
              :style="{ background: s.color }"
            />
            {{ s.label }}
          </span>
        </div>
      </div>
      <div class="range-picker-wrap">
        <ElDatePicker
          v-model="rangeModel"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          format="MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm:ss"
          size="small"
          :clearable="false"
          :disabled="loading"
          style="width: 100%"
          @change="onRangeChange"
        />
      </div>
    </header>

    <div
      v-if="loading && !points.length"
      class="state"
    >
      加载中…
    </div>
    <div
      v-else-if="error"
      class="state is-err"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="retry"
        @click="load"
      >
        重试
      </button>
    </div>
    <div
      v-else-if="!points.length || !hasSeriesData"
      class="state"
    >
      <template v-if="loading">加载中…</template>
      <template v-else>暂无成交数据</template>
    </div>
    <div
      v-else
      class="chart-wrap"
      :class="{ 'is-loading': loading }"
    >
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        class="chart"
        role="img"
        aria-label="成交金额与销量走势"
        @mousemove="onMove"
        @mouseleave="onLeave"
      >
        <line
          class="axis"
          :x1="pad.left"
          :y1="pad.top + innerH"
          :x2="pad.left + innerW"
          :y2="pad.top + innerH"
        />
        <line
          class="axis"
          :x1="pad.left"
          :y1="pad.top"
          :x2="pad.left"
          :y2="pad.top + innerH"
        />
        <g
          v-for="tick in yTicks"
          :key="tick.label + tick.y"
        >
          <line
            class="grid"
            :x1="pad.left"
            :y1="tick.y"
            :x2="pad.left + innerW"
            :y2="tick.y"
          />
          <text
            class="tick"
            :x="pad.left - 6"
            :y="tick.y + 4"
            text-anchor="end"
          >
            {{ tick.label }}
          </text>
        </g>
        <path
          class="line"
          fill="none"
          stroke="#FA8C16"
          stroke-width="2"
          :d="amountPath"
        />
        <path
          class="line"
          fill="none"
          stroke="#722ED1"
          stroke-width="2"
          :d="soldPath"
        />
        <line
          v-if="hoverIndex != null"
          class="cross"
          :x1="xAt(hoverIndex, points.length)"
          :y1="pad.top"
          :x2="xAt(hoverIndex, points.length)"
          :y2="pad.top + innerH"
        />
        <template v-if="hoverPoint && hoverIndex != null">
          <circle
            :cx="xAt(hoverIndex, points.length)"
            :cy="yAt(amountNum(hoverPoint.dealAmount))"
            r="4"
            fill="#FA8C16"
          />
          <circle
            :cx="xAt(hoverIndex, points.length)"
            :cy="yAt(hoverPoint.soldCount)"
            r="4"
            fill="#722ED1"
          />
        </template>
        <text
          v-for="(lab, i) in xLabels"
          :key="i"
          class="tick"
          :x="lab.x"
          :y="pad.top + innerH + 22"
          text-anchor="middle"
        >
          {{ lab.text }}
        </text>
      </svg>
      <div
        v-if="hoverPoint"
        class="tip"
        :style="hoverTipStyle"
      >
        <div class="tip-time">{{ hoverPoint.time }}</div>
        <div><i style="background:#FA8C16" />成交金额 {{ hoverPoint.dealAmount }}</div>
        <div><i style="background:#722ED1" />销量 {{ hoverPoint.soldCount }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chart-card {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  overflow-x: clip;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
  container-type: inline-size;
  container-name: trade-trend;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.card-head-main {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  min-width: 0;
}

.card-head h4 {
  margin: 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  flex: none;
}

.range-picker-wrap {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 100%;
  width: 100%;
}

@container trade-trend (min-width: 480px) {
  .range-picker-wrap {
    flex: 1 1 240px;
    width: auto;
    max-width: min(340px, 100%);
    margin-left: auto;
  }
}

.range-picker-wrap :deep(.el-date-editor) {
  width: 100% !important;
  max-width: 100%;
  min-width: 0 !important;
  box-sizing: border-box;
}

.range-picker-wrap :deep(.el-range-input) {
  flex: 1 1 0;
  min-width: 0;
  width: auto !important;
}

.range-picker-wrap :deep(.el-range-separator) {
  flex: none;
  padding: 0 2px;
  margin: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 12px;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: #999;
  font-size: 13px;
}

.state.is-err {
  color: #ff7875;
}

.retry {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  background: #fff;
  color: #ff4d4f;
  font-size: 12px;
  cursor: pointer;
}

.chart-wrap {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.chart-wrap.is-loading {
  opacity: 0.55;
  pointer-events: none;
}

.chart {
  display: block;
  width: 100%;
  height: auto;
  max-height: 100%;
  cursor: crosshair;
}

.axis {
  stroke: #d9d9d9;
  stroke-width: 1;
}

.grid {
  stroke: #f0f0f0;
  stroke-width: 1;
}

.tick {
  fill: #999;
  font-size: 11px;
}

.line {
  stroke-linejoin: round;
  stroke-linecap: round;
}

.cross {
  stroke: #d9d9d9;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.tip {
  position: absolute;
  top: 12px;
  z-index: 2;
  min-width: 140px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgb(0 0 0 / 72%);
  color: #fff;
  font-size: 12px;
  line-height: 1.6;
  pointer-events: none;
  transform: translateX(0);
}

.tip-time {
  margin-bottom: 4px;
  color: #ddd;
}

.tip i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: middle;
}
</style>
