<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  listActivities,
  STATE_LABEL,
  TYPE_LABEL,
  type ActivityListItem,
} from "@/api/activity";

const loading = ref(false);
const error = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);

const query = reactive({
  keyword: "",
  state: 0,
  page: 0,
  pageSize: 20,
});

const stateOptions = [
  { value: 0, label: "全部" },
  { value: 1, label: "直播" },
  { value: 2, label: "预告" },
  { value: 3, label: "结束" },
  { value: 4, label: "点播" },
  { value: 5, label: "回放" },
];

const pageCount = () => Math.max(1, Math.ceil(total.value / query.pageSize));

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const params: Record<string, unknown> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.keyword.trim()) params.keyword = query.keyword.trim();
    if (query.state !== 0) params.state = query.state;
    const data = await listActivities(params);
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 0;
  fetchList();
}

function prev() {
  if (query.page > 0) {
    query.page--;
    fetchList();
  }
}

function next() {
  if (query.page < pageCount() - 1) {
    query.page++;
    fetchList();
  }
}

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-800">活动列表</h2>
      <RouterLink
        to="/activities/create"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        创建活动
      </RouterLink>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input
        v-model="query.keyword"
        type="text"
        placeholder="标题或活动 id"
        class="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        @keyup.enter="search"
      />
      <select
        v-model.number="query.state"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        @change="search"
      >
        <option v-for="o in stateOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <button
        class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        @click="search"
      >
        查询
      </button>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
      {{ error }}
    </p>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">ID</th>
            <th class="px-4 py-3 font-medium">标题</th>
            <th class="px-4 py-3 font-medium">类型</th>
            <th class="px-4 py-3 font-medium">状态</th>
            <th class="px-4 py-3 font-medium">开始时间</th>
            <th class="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">加载中…</td>
          </tr>
          <tr v-else-if="list.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">暂无数据</td>
          </tr>
          <tr v-for="item in list" v-else :key="item.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-gray-500">{{ item.id }}</td>
            <td class="px-4 py-3 text-gray-800">{{ item.title }}</td>
            <td class="px-4 py-3 text-gray-600">{{ TYPE_LABEL[item.type] ?? item.type }}</td>
            <td class="px-4 py-3">
              <span class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                {{ STATE_LABEL[item.state] ?? item.state }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ item.startTime }}</td>
            <td class="px-4 py-3">
              <RouterLink
                :to="`/activities/${item.id}`"
                class="text-blue-600"
              >
                详情
              </RouterLink>
              <RouterLink
                :to="`/activities/${item.id}/stats`"
                class="ml-3 text-blue-600"
              >
                统计
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-gray-600">
      <span>共 {{ total }} 条</span>
      <div class="flex items-center gap-2">
        <button
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40"
          :disabled="query.page === 0 || loading"
          @click="prev"
        >
          上一页
        </button>
        <span>{{ query.page + 1 }} / {{ pageCount() }}</span>
        <button
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40"
          :disabled="query.page >= pageCount() - 1 || loading"
          @click="next"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
