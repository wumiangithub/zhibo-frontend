<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElDatePicker, ElMessage } from "element-plus";
import { fetchPresenceTrend, type PresenceTrendPoint } from "@/api/presenceTrend";
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
const points = ref<PresenceTrendPoint[]>([]);
/** ElDatePicker datetimerange：`yyyy-MM-dd HH:mm:ss` */
const rangeModel = ref<[string, string] | null>(null);
const hoverIndex = ref<number | null>(null);

let seq = 0;
let rangeInited = false;
/** session 起止/状态首次就绪后补同步一次默认范围（面板可能早于 load 挂载） */
let sessionRangeSynced = false;
/** 用户是否在日期选择器里改过范围；未改过时 ↻ 对未结束场次把结束端推到 now */
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

/**
 * ↻：保持当前选中范围重拉。
 * 未手动改过且场次未结束时，结束端语义是「到现在」——推到 now（起点不变），否则同参重拉看不到新桶。
 */
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

/** 「数据」：重置为默认时间范围并重新拉走势 */
async function resetAndReload() {
  initRangeFromProps();
  await load();
}

const chartWidth = 560;
const chartHeight = 280;
const pad = { top: 20, right: 16, bottom: 36, left: 36 };
const innerW = chartWidth - pad.left - pad.right;
const innerH = chartHeight - pad.top - pad.bottom;

const SERIES = [
  { key: "online" as const, label: "在线", color: "#1677ff" },
  { key: "enter" as const, label: "进场", color: "#52c41a" },
  { key: "leave" as const, label: "离场", color: "#eb2f96" },
];

const maxY = computed(() => {
  if (!points.value.length) return 1;
  let max = 1;
  for (const p of points.value) {
    max = Math.max(max, p.online, p.enter, p.leave);
  }
  return max;
});

const hasSeriesData = computed(() =>
  points.value.some((p) => p.online > 0 || p.enter > 0 || p.leave > 0),
);

function xAt(i: number, n: number): number {
  return pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
}

function yAt(val: number): number {
  return pad.top + innerH - (val / maxY.value) * innerH;
}

/** 普通线性折线：相邻桶用直线相连（非 step / 非针） */
function seriesPath(key: "online" | "enter" | "leave"): string {
  const list = points.value;
  if (!list.length) return "";
  const n = list.length;
  let d = `M ${xAt(0, n)} ${yAt(list[0][key])}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${xAt(i, n)} ${yAt(list[i][key])}`;
  }
  return d;
}

/** 非零采样点轻量标记（不喧宾夺主） */
const seriesMarkers = computed(() => {
  const list = points.value;
  const n = list.length;
  if (!n) return [] as { key: string; x: number; y: number; color: string }[];
  const out: { key: string; x: number; y: number; color: string }[] = [];
  for (const s of SERIES) {
    for (let i = 0; i < n; i++) {
      const val = list[i][s.key];
      if (val <= 0) continue;
      out.push({
        key: `${s.key}-${i}`,
        x: xAt(i, n),
        y: yAt(val),
        color: s.color,
      });
    }
  }
  return out;
});

const yTicks = computed(() => {
  const max = maxY.value;
  const ticks: { y: number; label: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((max / 4) * i);
    ticks.push({ y: yAt(val), label: String(val) });
  }
  return ticks;
});

const xLabels = computed(() => {
  const list = points.value;
  if (!list.length) return [];
  const n = list.length;
  const step = Math.max(1, Math.floor(n / 6));
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < n; i += step) {
    const t = list[i].time;
    labels.push({ x: xAt(i, n), text: t.slice(11, 16) || t.slice(5, 10) });
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
    const res = await fetchPresenceTrend(id, {
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
      <h4>在线人数</h4>
      <ElDatePicker
        v-model="rangeModel"
        class="range-picker"
        type="datetimerange"
        range-separator="至"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        :clearable="false"
        :disabled="loading"
        @change="onRangeChange"
      />
    </header>

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
      <template v-else>暂无进出数据</template>
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
        aria-label="在线、进场、离场走势"
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
          v-for="s in SERIES"
          :key="s.key"
          class="line"
          fill="none"
          :stroke="s.color"
          stroke-width="2"
          :d="seriesPath(s.key)"
        />
        <circle
          v-for="m in seriesMarkers"
          :key="m.key"
          class="marker"
          :cx="m.x"
          :cy="m.y"
          r="2.5"
          :fill="m.color"
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
            :cy="yAt(hoverPoint.online)"
            r="4"
            fill="#1677ff"
          />
          <circle
            :cx="xAt(hoverIndex, points.length)"
            :cy="yAt(hoverPoint.enter)"
            r="4"
            fill="#52c41a"
          />
          <circle
            :cx="xAt(hoverIndex, points.length)"
            :cy="yAt(hoverPoint.leave)"
            r="4"
            fill="#eb2f96"
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
        <div><i style="background:#1677ff" />在线 {{ hoverPoint.online }}</div>
        <div><i style="background:#52c41a" />进场 {{ hoverPoint.enter }}</div>
        <div><i style="background:#eb2f96" />离场 {{ hoverPoint.leave }}</div>
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
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.card-head h4 {
  margin: 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.range-picker {
  margin-left: auto;
  width: min(420px, 100%);
}

.range-picker :deep(.el-input__wrapper) {
  font-size: 12px;
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

.marker {
  pointer-events: none;
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
