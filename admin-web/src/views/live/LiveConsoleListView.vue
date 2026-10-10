<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  listActivities,
  STATE_LABEL,
  TYPE_LABEL,
  type ActivityListItem,
} from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

const loading = ref(false);
const error = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);

const query = reactive({
  keyword: "",
  page: 1,
  pageSize: 20,
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

function shelfLabel(state: number) {
  if (state === 3) return { text: "已下架", on: false };
  return { text: "已上架", on: true };
}

function liveStateLabel(state: number) {
  if (state === 1) return { text: "直播中", on: true };
  const label = STATE_LABEL[state] ?? String(state);
  if (state === 2) return { text: "预告", on: false };
  if (state === 3) return { text: "已结束", on: false };
  return { text: label, on: false };
}

function typeLabel(type: number) {
  const t = TYPE_LABEL[type];
  if (t === "视频") return "视频直播";
  if (t === "音频") return "音频直播";
  if (t === "互动") return "互动直播";
  if (t === "录播") return "录播直播";
  return t ?? String(type);
}

function roomStyle(item: ActivityListItem) {
  if (item.viewerStyle === "immersive") return "沉浸全屏";
  if (item.viewerStyle === "traditional") return "传统横屏";
  return item.type === 1 ? "传统横屏" : "沉浸全屏";
}

function formatStartTime(raw?: string) {
  if (!raw) return "—";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const params: Record<string, unknown> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.keyword.trim()) params.keyword = query.keyword.trim();
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
  query.page = 1;
  void fetchList();
}

function resetFilter() {
  query.keyword = "";
  query.page = 1;
  void fetchList();
}

function goConsole(id: string) {
  const token = "";
  const url = `http://localhost:5174/console/${id}?token=${encodeURIComponent(token)}`;
  window.open(url, "_blank", "noopener");
}

function prev() {
  if (query.page > 1) {
    query.page--;
    void fetchList();
  }
}

function next() {
  if (query.page < pageCount.value) {
    query.page++;
    void fetchList();
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="live-console-list box-border min-h-full">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UiInput
        v-model="query.keyword"
        label="直播名称:"
        placeholder="请输入直播名称"
        @keyup.enter="search"
      />
      <UiButton
        variant="outline"
        @click="search"
      >
        筛选
      </UiButton>
      <UiButton
        variant="link"
        @click="resetFilter"
      >
        重置筛选条件
      </UiButton>
      <UiButton
        variant="link"
        @click="toast('「展开」暂未开放')"
      >
        展开
      </UiButton>
    </div>

    <p
      v-if="error"
      class="mb-3 rounded bg-red-50 px-3 py-2 text-[13px] text-red-600"
    >
      {{ error }}
    </p>

    <div class="overflow-x-auto rounded border border-[#f0f0f0] bg-white">
      <table class="w-full min-w-[960px] border-collapse text-left text-[13px]">
        <thead>
          <tr class="border-b border-[#f0f0f0] text-[#999]">
            <th class="px-3 py-3 font-normal">直播名称</th>
            <th class="px-3 py-3 font-normal">直播模式</th>
            <th class="px-3 py-3 font-normal">观看模式</th>
            <th class="px-3 py-3 font-normal">上架状态</th>
            <th class="px-3 py-3 font-normal">直播开始时间</th>
            <th class="px-3 py-3 font-normal">直播状态</th>
            <th class="px-3 py-3 font-normal">归属人</th>
            <th class="px-3 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              colspan="8"
              class="px-3 py-16 text-center text-[#bfbfbf]"
            >
              加载中…
            </td>
          </tr>
          <tr v-else-if="list.length === 0">
            <td
              colspan="8"
              class="px-3 py-16 text-center text-[#bfbfbf]"
            >
              暂无直播
            </td>
          </tr>
          <tr
            v-for="item in list"
            v-else
            :key="item.id"
            class="border-b border-[#f5f5f5] hover:bg-[#fafafa]"
          >
            <td class="px-3 py-3">
              <div class="flex items-center gap-3">
                <div class="h-12 w-16 flex-none overflow-hidden rounded bg-[#f0f0f0]">
                  <img
                    v-if="item.coverUrl"
                    :src="item.coverUrl"
                    :alt="item.title"
                    class="h-full w-full object-cover"
                  >
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-[10px] text-[#bfbfbf]"
                  >
                    无封面
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="truncate font-medium text-[#1a1a1a]">{{ item.title }}</p>
                  <p class="mt-0.5 text-[12px] text-[#999]">免费 / 长期有效</p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3 text-[#666]">{{ typeLabel(item.type) }}</td>
            <td class="px-3 py-3 text-[#666]">{{ roomStyle(item) }}</td>
            <td class="px-3 py-3">
              <span class="inline-flex items-center gap-1.5 text-[#666]">
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="shelfLabel(item.state).on ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'"
                />
                {{ shelfLabel(item.state).text }}
              </span>
            </td>
            <td class="px-3 py-3 text-[#666]">{{ formatStartTime(item.startTime) }}</td>
            <td class="px-3 py-3">
              <span class="inline-flex items-center gap-1.5 text-[#666]">
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="liveStateLabel(item.state).on ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'"
                />
                {{ liveStateLabel(item.state).text }}
              </span>
            </td>
            <td class="px-3 py-3 text-[#666]">--</td>
            <td class="px-3 py-3">
              <UiButton
                variant="link"
                @click="goConsole(item.id)"
              >
                直播中控台
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-[13px] text-[#666]">
      <span>共 {{ total }} 条</span>
      <div class="flex items-center gap-2">
        <UiButton
          variant="default"
          :disabled="query.page <= 1 || loading"
          @click="prev"
        >
          上一页
        </UiButton>
        <span>{{ query.page }} / {{ pageCount }}</span>
        <UiButton
          variant="default"
          :disabled="query.page >= pageCount || loading"
          @click="next"
        >
          下一页
        </UiButton>
      </div>
    </div>
  </div>
</template>
