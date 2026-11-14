<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElDatePicker, ElMessage } from "element-plus";
import { fetchPresenceTrend, type PresenceTrendPoint } from "./api/console";
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
/** ElDatePicker：展示 `MM-DD HH:mm`，value 仍为 `yyyy-MM-dd HH:mm:ss` */
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
  { key: "online" as const, label: "在线", color: "#2563EB" },
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

/** 在线：按自己的 online 全程打点连折线 */
const onlinePath = computed(() => {
  const list = points.value;
  if (!list.length) return "";
  const n = list.length;
  let d = `M ${xAt(0, n)} ${yAt(list[0].online)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${xAt(i, n)} ${yAt(list[i].online)}`;
  }
  return d;
});

/**
 * 进场 / 离场：桶内事件数，各自独立画竖针（底→该点值），颜色不串线。
 * 同一分钟既有进又有离时，进场略左、离场略右，避免叠成一根。
 */
function eventStemPath(key: "enter" | "leave"): string {
  const list = points.value;
  if (!list.length) return "";
  const n = list.length;
  const dx = key === "enter" ? -3 : 3;
  let d = "";
  for (let i = 0; i < n; i++) {
    const v = list[i][key];
    if (v <= 0) continue;
    const x = xAt(i, n) + dx;
    d += `M ${x} ${yAt(0)} L ${x} ${yAt(v)} `;
  }
  return d;
}

const enterPath = computed(() => eventStemPath("enter"));
const leavePath = computed(() => eventStemPath("leave"));

/** 在线折点 + 进/离针顶打点 */
const seriesMarkers = computed(() => {
  const list = points.value;
  const n = list.length;
  if (!n) return [] as { key: string; x: number; y: number; color: string }[];
  const out: { key: string; x: number; y: number; color: string }[] = [];

  for (let i = 0; i < n; i++) {
    const online = list[i].online;
    const prev = i > 0 ? list[i - 1].online : null;
    const next = i < n - 1 ? list[i + 1].online : null;
    const corner =
      (prev != null && prev !== online) ||
      (next != null && next !== online) ||
      i === 0 ||
      i === n - 1;
    if (online > 0 && corner) {
      out.push({
        key: `online-${i}`,
        x: xAt(i, n),
        y: yAt(online),
        color: SERIES[0].color,
      });
    }

    const enter = list[i].enter;
    if (enter > 0) {
      out.push({
        key: `enter-${i}`,
        x: xAt(i, n) - 3,
        y: yAt(enter),
        color: SERIES[1].color,
      });
    }
    const leave = list[i].leave;
    if (leave > 0) {
      out.push({
        key: `leave-${i}`,
        x: xAt(i, n) + 3,
        y: yAt(leave),
        color: SERIES[2].color,
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
      <div class="card-head-main">
        <h4>在线人数</h4>
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
          class="line"
          fill="none"
          stroke="#2563EB"
          stroke-width="2"
          :d="onlinePath"
        />
        <path
          class="line"
          fill="none"
          stroke="#52c41a"
          stroke-width="2"
          :d="enterPath"
        />
        <path
          class="line"
          fill="none"
          stroke="#eb2f96"
          stroke-width="2"
          :d="leavePath"
        />
        <circle
          v-for="m in seriesMarkers"
          :key="m.key"
          class="marker"
          :cx="m.x"
          :cy="m.y"
          r="3"
          :fill="m.color"
          stroke="#fff"
          stroke-width="1"
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
            fill="#2563EB"
          />
          <circle
            v-if="hoverPoint.enter > 0"
            :cx="xAt(hoverIndex, points.length) - 3"
            :cy="yAt(hoverPoint.enter)"
            r="4"
            fill="#52c41a"
          />
          <circle
            v-if="hoverPoint.leave > 0"
            :cx="xAt(hoverIndex, points.length) + 3"
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
        <div><i style="background:#2563EB" />在线 {{ hoverPoint.online }}</div>
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
  overflow-x: clip;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
  container-type: inline-size;
  container-name: presence-trend;
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

/* 宽卡：标题+图例左侧，选择器靠右且可收缩 */
@container presence-trend (min-width: 480px) {
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
