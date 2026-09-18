<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  getStats,
  getOnlineTrend,
  STATE_LABEL,
  type StatsOverview,
  type TrendPoint,
} from "@/api/activity";

const route = useRoute();
const id = Number(route.params.id);

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
    overview.value = await getStats(id);
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
    const data = await getOnlineTrend(id, start, end);
    points.value = data.points ?? [];
  } catch (e) {
    trendError.value = e instanceof Error ? e.message : "加载趋势失败";
  } finally {
    trendLoading.value = false;
  }
}

function selectPreset(p: Preset) {
  activePreset.value = p;
  fetchTrend();
}

function useCustomRange() {
  activePreset.value = "custom";
  fetchTrend();
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
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = Math.round((max / steps) * i);
    const y = chartPad.top + innerH - (val / max) * innerH;
    ticks.push({ y, label: String(val) });
  }
  return ticks;
});

const xLabels = computed(() => {
  if (points.value.length === 0) return [];
  const n = points.value.length;
  const maxLabels = 6;
  const step = Math.max(1, Math.floor(n / maxLabels));
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < n; i += step) {
    const x = chartPad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const t = points.value[i].time;
    labels.push({ x, text: t.slice(11, 16) || t.slice(5, 10) });
  }
  return labels;
});

onMounted(() => {
  fetchOverview();
  fetchTrend();
  pollTimer = setInterval(fetchOverview, POLL_INTERVAL);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div>
    <div class="mb-4 flex items-center gap-3">
      <RouterLink to="/activities" class="text-sm text-gray-500 hover:text-blue-600">
        ← 返回列表
      </RouterLink>
      <RouterLink
        :to="`/activities/${id}`"
        class="text-sm text-gray-500 hover:text-blue-600"
      >
        ← 返回详情
      </RouterLink>
    </div>

    <p v-if="overviewError && !overview" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
      {{ overviewError }}
    </p>

    <template v-if="overview">
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-800">{{ overview.title }}</h2>
            <p class="mt-1 text-sm text-gray-400">ID: {{ overview.id }}</p>
          </div>
          <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
            {{ STATE_LABEL[overview.state] ?? overview.state }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="rounded-md bg-gray-50 p-4">
            <p class="text-xs text-gray-400">热度 (PV)</p>
            <p class="mt-1 text-2xl font-semibold text-gray-800">{{ overview.pv ?? 0 }}</p>
          </div>
          <div class="rounded-md bg-gray-50 p-4">
            <p class="text-xs text-gray-400">当前在线</p>
            <p class="mt-1 text-2xl font-semibold text-green-600">
              {{ overview.onlineCount ?? 0 }}
            </p>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-400">概览每 60 秒自动刷新</p>
      </div>

      <div class="mt-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="mb-3 text-base font-semibold text-gray-800">在线趋势</h3>

        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button
            class="rounded-md border px-3 py-1.5 text-sm"
            :class="activePreset === '1h' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="selectPreset('1h')"
          >
            近 1 小时
          </button>
          <button
            class="rounded-md border px-3 py-1.5 text-sm"
            :class="activePreset === 'today' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="selectPreset('today')"
          >
            今天
          </button>
          <button
            class="rounded-md border px-3 py-1.5 text-sm"
            :class="activePreset === 'yesterday' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="selectPreset('yesterday')"
          >
            昨天
          </button>
          <span class="text-gray-300">|</span>
          <input
            v-model="customStart"
            type="datetime-local"
            class="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <span class="text-gray-400">至</span>
          <input
            v-model="customEnd"
            type="datetime-local"
            class="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            @click="useCustomRange"
          >
            查询
          </button>
        </div>

        <p v-if="trendError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {{ trendError }}
        </p>
        <p v-else-if="trendLoading" class="py-8 text-center text-sm text-gray-400">加载中…</p>
        <p v-else-if="points.length === 0" class="py-8 text-center text-sm text-gray-400">
          该时段暂无在线数据
        </p>

        <div v-else class="overflow-x-auto">
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full max-w-3xl"
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
              class="fill-gray-400 text-[11px]"
            >
              {{ tick.label }}
            </text>
            <polyline
              :points="polylinePoints"
              fill="none"
              stroke="#3b82f6"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <circle
              v-for="(p, i) in points"
              :key="i"
              :cx="chartPad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)"
              :cy="chartPad.top + innerH - (p.count / maxCount) * innerH"
              r="3"
              class="fill-blue-500"
            />
            <text
              v-for="(label, i) in xLabels"
              :key="'x' + i"
              :x="label.x"
              :y="chartPad.top + innerH + 24"
              text-anchor="middle"
              class="fill-gray-400 text-[11px]"
            >
              {{ label.text }}
            </text>
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>
