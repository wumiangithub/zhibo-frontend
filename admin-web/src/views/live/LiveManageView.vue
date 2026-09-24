<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  getHostUrl,
  listActivities,
  TYPE_LABEL,
  type ActivityListItem,
} from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import UiCheckButton from "@/components/ui/UiCheckButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const { toast } = useToast();

const loading = ref(false);
const error = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);
const selected = ref<number[]>([]);
const selectPage = ref(false);

const query = reactive({
  keyword: "",
  page: 0,
  pageSize: 20,
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

/** 上架状态：无独立字段，用直播状态近似展示 */
function shelfLabel(state: number) {
  if (state === 3) return { text: "已下架", on: false };
  return { text: "已上架", on: true };
}

function roomStyle(type: number) {
  return type === 1 ? "传统直播间" : "沉浸直播间";
}

function typeLabel(type: number) {
  const t = TYPE_LABEL[type];
  if (t === "视频") return "视频直播";
  if (t === "音频") return "音频直播";
  if (t === "互动") return "互动直播";
  return t ?? String(type);
}

async function fetchList() {
  loading.value = true;
  error.value = "";
  selected.value = [];
  selectPage.value = false;
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
  query.page = 0;
  void fetchList();
}

function resetFilter() {
  query.keyword = "";
  query.page = 0;
  void fetchList();
}

function onSelectPageChange() {
  selected.value = selectPage.value ? list.value.map((i) => i.id) : [];
}

function toggleSelectPage() {
  selectPage.value = !selectPage.value;
  onSelectPageChange();
}

function toggleRow(id: number) {
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
  selectPage.value = selected.value.length === list.value.length && list.value.length > 0;
}

function shell(label: string) {
  toast(`「${label}」暂未开放`);
}

function goCreate() {
  void router.push("/live/create");
}

async function goLive(id: number) {
  try {
    const { hostUrl } = await getHostUrl(id);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    toast(e instanceof Error ? e.message : "获取开播链接失败");
  }
}

function prev() {
  if (query.page > 0) {
    query.page--;
    void fetchList();
  }
}

function next() {
  if (query.page < pageCount.value - 1) {
    query.page++;
    void fetchList();
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="live-manage box-border min-h-full">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <UiButton
          variant="primary"
          @click="goCreate"
        >
          新建
        </UiButton>
        <UiButton
          variant="outline"
          dropdown
          @click="shell('批量创建')"
        >
          批量创建
        </UiButton>
      </div>
      <UiButton
        variant="link"
        @click="shell('使用教程')"
      >
        使用教程
      </UiButton>
    </div>

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
        variant="default"
        @click="shell('导出')"
      >
        导出
      </UiButton>
      <UiButton
        variant="link"
        @click="resetFilter"
      >
        重置筛选条件
      </UiButton>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UiCheckButton
        v-model:checked="selectPage"
        @change="onSelectPageChange"
      >
        {{ selectPage ? "取消本页" : "选中本页" }}
      </UiCheckButton>
      <UiButton
        variant="default"
        @click="shell('上架')"
      >
        上架
      </UiButton>
      <UiButton
        variant="default"
        @click="shell('下架')"
      >
        下架
      </UiButton>
      <UiButton
        variant="default"
        @click="shell('删除')"
      >
        删除
      </UiButton>
      <UiButton
        variant="default"
        dropdown
        @click="shell('更多操作')"
      >
        更多操作
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
            <th class="w-10 px-3 py-3 font-normal">
              <input
                type="checkbox"
                :checked="selectPage"
                class="align-middle accent-[var(--color-primary)]"
                @change="toggleSelectPage"
              >
            </th>
            <th class="px-3 py-3 font-normal">直播名称</th>
            <th class="px-3 py-3 font-normal">直播类型</th>
            <th class="px-3 py-3 font-normal">观看端样式</th>
            <th class="px-3 py-3 font-normal">订阅量</th>
            <th class="px-3 py-3 font-normal">打赏金额</th>
            <th class="px-3 py-3 font-normal">上架状态</th>
            <th class="px-3 py-3 font-normal">直播开始时间</th>
            <th class="px-3 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              colspan="9"
              class="px-3 py-16 text-center text-[#bfbfbf]"
            >
              加载中…
            </td>
          </tr>
          <tr v-else-if="list.length === 0">
            <td
              colspan="9"
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
              <input
                type="checkbox"
                :checked="selected.includes(item.id)"
                class="align-middle accent-[var(--color-primary)]"
                @change="toggleRow(item.id)"
              >
            </td>
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
            <td class="px-3 py-3 text-[#666]">{{ roomStyle(item.type) }}</td>
            <td class="px-3 py-3 text-[#666]">--</td>
            <td class="px-3 py-3 text-[#666]">¥0</td>
            <td class="px-3 py-3">
              <span class="inline-flex items-center gap-1.5 text-[#666]">
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="shelfLabel(item.state).on ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'"
                />
                {{ shelfLabel(item.state).text }}
              </span>
            </td>
            <td class="px-3 py-3 text-[#666]">{{ item.startTime }}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <UiButton
                  variant="link"
                  @click="goLive(item.id)"
                >
                  去直播
                </UiButton>
                <RouterLink
                  :to="{ path: `/live/${item.id}`, query: { tab: 'data' } }"
                  class="text-[13px] text-[var(--color-primary)] hover:underline"
                >
                  数据
                </RouterLink>
                <RouterLink
                  :to="`/live/${item.id}`"
                  class="text-[13px] text-[var(--color-primary)] hover:underline"
                >
                  管理
                </RouterLink>
                <UiButton
                  variant="link"
                  @click="shell('分享')"
                >
                  分享
                </UiButton>
                <button
                  type="button"
                  class="border-0 bg-transparent p-0 text-[#999] outline-none hover:text-[var(--color-primary)]"
                  @click="shell('更多')"
                >
                  ···
                </button>
              </div>
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
          :disabled="query.page === 0 || loading"
          @click="prev"
        >
          上一页
        </UiButton>
        <span>{{ query.page + 1 }} / {{ pageCount }}</span>
        <UiButton
          variant="default"
          :disabled="query.page >= pageCount - 1 || loading"
          @click="next"
        >
          下一页
        </UiButton>
      </div>
    </div>
  </div>
</template>
