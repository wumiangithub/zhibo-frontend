<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  listWatchActivities,
  type WatchActivityItem,
} from "@/api/watch";

const router = useRouter();
const id = ref("");
const loading = ref(true);
const error = ref("");
const list = ref<WatchActivityItem[]>([]);

const STATE_LABEL: Record<number, string> = {
  1: "直播",
  2: "预告",
  3: "结束",
  4: "点播",
  5: "回放",
};

const STATE_COLOR: Record<number, string> = {
  1: "bg-green-500/20 text-green-400",
  2: "bg-blue-500/20 text-blue-400",
  3: "bg-gray-500/20 text-gray-400",
  4: "bg-purple-500/20 text-purple-400",
  5: "bg-yellow-500/20 text-yellow-400",
};

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const data = await listWatchActivities();
    list.value = data.list ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    list.value = [];
  } finally {
    loading.value = false;
  }
}

function go() {
  const n = Number(id.value);
  if (Number.isInteger(n) && n > 0) {
    router.push(`/watch/${n}`);
  }
}

function enter(item: WatchActivityItem) {
  router.push(`/watch/${item.id}`);
}

onMounted(fetchList);
</script>

<template>
  <div class="min-h-dvh bg-gray-900 p-6 text-white">
    <div class="mx-auto max-w-2xl">
      <h1 class="text-xl font-bold text-green-400">直播观看端</h1>
      <p class="mt-1 text-sm text-gray-400">选择活动进入观看页，或手动输入活动 ID</p>

      <div class="mt-4 flex items-center gap-2">
        <input
          v-model="id"
          type="number"
          min="1"
          placeholder="活动 ID"
          class="w-40 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          @keyup.enter="go"
        />
        <button
          class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700"
          @click="go"
        >
          进入
        </button>
      </div>

      <div class="mt-6">
        <h2 class="mb-3 text-base font-semibold text-gray-300">近期活动</h2>

        <p v-if="loading" class="text-sm text-gray-500">加载中…</p>
        <p v-else-if="error" class="text-sm text-red-400">{{ error }}</p>
        <p v-else-if="list.length === 0" class="text-sm text-gray-500">暂无活动</p>

        <ul v-else class="space-y-2">
          <li
            v-for="item in list"
            :key="item.id"
            class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-4 transition hover:border-green-500 hover:bg-gray-750"
            @click="enter(item)"
          >
            <div>
              <p class="font-medium text-gray-100">{{ item.title }}</p>
              <p class="mt-1 text-xs text-gray-500">
                ID: {{ item.id }} · {{ item.startTime }}
              </p>
            </div>
            <span
              class="rounded px-2 py-0.5 text-xs"
              :class="STATE_COLOR[item.state] ?? 'bg-gray-500/20 text-gray-400'"
            >
              {{ STATE_LABEL[item.state] ?? item.state }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
