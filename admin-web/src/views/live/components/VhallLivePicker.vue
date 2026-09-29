<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog, ElInput, ElButton, ElMessage, ElMessageBox, ElRadio } from "element-plus";
import {
  listVhallLives,
  listVhallLiveRecords,
  type VhallLiveItem,
  type VhallPlaybackItem,
} from "@/api/recordResource";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
  /** 最终选中的回放，用于写入 recordId */
  select: [payload: { live: VhallLiveItem; playback: VhallPlaybackItem }];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const loading = ref(false);
const confirming = ref(false);
const listError = ref("");
const keyword = ref("");
const list = ref<VhallLiveItem[]>([]);
const total = ref(0);
const page = ref(0);
const pageSize = 10;
const pickedLiveId = ref("");

const playbackVisible = ref(false);
const playbackLoading = ref(false);
const playbackList = ref<VhallPlaybackItem[]>([]);
const pickedPlaybackId = ref("");
const pendingLive = ref<VhallLiveItem | null>(null);

const STATE_MAP: Record<number, string> = {
  1: "直播中",
  2: "未开始",
  3: "已结束",
  4: "点播",
  5: "回放",
};

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

function stateText(item: VhallLiveItem) {
  return item.stateLabel || STATE_MAP[item.state ?? -1] || "--";
}

function timeText(item: VhallLiveItem) {
  if (item.startTime && item.endTime) return `${item.startTime} ~ ${item.endTime}`;
  return item.startTime || "--";
}

async function fetchLives() {
  loading.value = true;
  listError.value = "";
  try {
    const data = await listVhallLives({
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || undefined,
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    list.value = [];
    total.value = 0;
    listError.value = e instanceof Error ? e.message : "加载直播列表失败";
  } finally {
    loading.value = false;
  }
}

function finishWithPlayback(live: VhallLiveItem, playback: VhallPlaybackItem) {
  emit("select", { live, playback });
  playbackVisible.value = false;
  visible.value = false;
}

async function fetchRecordsForLive(live: VhallLiveItem): Promise<VhallPlaybackItem[]> {
  const data = await listVhallLiveRecords(live.id);
  return data.list ?? [];
}

async function onConfirmLive() {
  const live = list.value.find((i) => i.id === pickedLiveId.value);
  if (!live) {
    ElMessage.warning("请先选择一场直播");
    return;
  }
  confirming.value = true;
  playbackLoading.value = true;
  try {
    const records = await fetchRecordsForLive(live);
    if (records.length === 0) {
      await ElMessageBox.alert("当前直播无回放", "提示", {
        type: "warning",
        confirmButtonText: "知道了",
      });
      return;
    }
    if (records.length === 1) {
      finishWithPlayback(live, records[0]);
      return;
    }
    pendingLive.value = live;
    playbackList.value = records;
    pickedPlaybackId.value = records[0].id;
    playbackVisible.value = true;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取回放列表失败");
  } finally {
    confirming.value = false;
    playbackLoading.value = false;
  }
}

function onConfirmPlayback() {
  const live = pendingLive.value;
  const pb = playbackList.value.find((i) => i.id === pickedPlaybackId.value);
  if (!live || !pb) {
    ElMessage.warning("请选择一条回放");
    return;
  }
  finishWithPlayback(live, pb);
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    keyword.value = "";
    page.value = 0;
    pickedLiveId.value = "";
    listError.value = "";
    playbackVisible.value = false;
    void fetchLives();
  },
);
</script>

<template>
  <ElDialog
    v-model="visible"
    title="选择直播"
    width="800px"
    align-center
    destroy-on-close
  >
    <p
      v-if="listError"
      class="err-tip"
    >
      {{ listError }}
    </p>

    <div class="toolbar">
      <UiButton
        variant="default"
        :disabled="loading"
        @click="fetchLives"
      >
        刷新
      </UiButton>
      <ElInput
        v-model="keyword"
        clearable
        placeholder="搜索直播名称"
        style="width: 240px; margin-left: auto"
        @keyup.enter="page = 0; fetchLives()"
      />
      <UiButton
        variant="outline"
        @click="page = 0; fetchLives()"
      >
        搜索
      </UiButton>
    </div>

    <div
      v-if="loading"
      class="empty"
    >
      加载中…
    </div>
    <div
      v-else-if="list.length === 0"
      class="empty"
    >
      暂无直播
    </div>
    <table
      v-else
      class="tbl"
    >
      <thead>
        <tr>
          <th class="col-radio" />
          <th>直播名称</th>
          <th>直播时间</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in list"
          :key="item.id"
          :class="{ 'is-active': pickedLiveId === item.id }"
          @click="pickedLiveId = item.id"
        >
          <td class="col-radio">
            <ElRadio
              v-model="pickedLiveId"
              :value="item.id"
              @click.stop
            />
          </td>
          <td>
            <div class="live-cell">
              <div class="thumb">
                <img
                  v-if="item.coverUrl"
                  :src="item.coverUrl"
                  alt=""
                >
                <span v-else>直播</span>
              </div>
              <span class="live-title">{{ item.title }}</span>
            </div>
          </td>
          <td>{{ timeText(item) }}</td>
          <td>{{ stateText(item) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="pager">
      <span>共 {{ total }} 条 · 第 {{ page + 1 }}/{{ pageCount }} 页</span>
      <UiButton
        variant="default"
        :disabled="page <= 0 || loading"
        @click="page--; fetchLives()"
      >
        上一页
      </UiButton>
      <UiButton
        variant="default"
        :disabled="page + 1 >= pageCount || loading"
        @click="page++; fetchLives()"
      >
        下一页
      </UiButton>
    </div>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton
        type="primary"
        :loading="confirming || playbackLoading"
        @click="onConfirmLive"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>

  <!-- 第三层：多条回放时选择 -->
  <ElDialog
    v-model="playbackVisible"
    title="选择回放"
    width="560px"
    align-center
    append-to-body
    destroy-on-close
  >
    <p class="pb-hint">
      直播「{{ pendingLive?.title }}」有多条回放，请选择一条用于录播
    </p>
    <ul class="pb-list">
      <li
        v-for="pb in playbackList"
        :key="pb.id"
        class="pb-item"
        :class="{ 'is-active': pickedPlaybackId === pb.id }"
        @click="pickedPlaybackId = pb.id"
      >
        <ElRadio
          v-model="pickedPlaybackId"
          :value="pb.id"
          @click.stop
        />
        <div class="pb-body">
          <p class="pb-title">{{ pb.title }}</p>
          <p class="pb-meta">
            <span>ID：{{ pb.id }}</span>
            <span v-if="pb.duration">时长：{{ pb.duration }}</span>
            <span v-if="pb.createdAt">{{ pb.createdAt }}</span>
          </p>
        </div>
      </li>
    </ul>
    <template #footer>
      <ElButton @click="playbackVisible = false">取消</ElButton>
      <ElButton
        type="primary"
        @click="onConfirmPlayback"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.mock-tip,
.err-tip {
  margin: 0 0 10px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}
.mock-tip {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800;
}
.err-tip {
  background: #fff1f0;
  border: 1px solid #ffccc7;
  color: var(--color-danger);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.empty {
  padding: 48px 0;
  text-align: center;
  color: var(--color-text-placeholder);
  font-size: 13px;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--color-border-light);
  padding: 10px 8px;
  text-align: left;
  vertical-align: middle;
  color: var(--color-text-secondary);
}
.tbl th {
  background: #fafbfc;
  color: var(--color-text-placeholder);
  font-weight: 500;
}
.tbl tbody tr {
  cursor: pointer;
}
.tbl tbody tr:hover,
.tbl tbody tr.is-active {
  background: var(--color-primary-bg);
}
.col-radio {
  width: 36px;
}
.live-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thumb {
  width: 64px;
  height: 36px;
  border-radius: 4px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #999;
  overflow: hidden;
  flex: none;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.live-title {
  color: var(--color-text);
  font-weight: 500;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.pb-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.pb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.pb-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
}
.pb-item:last-child {
  border-bottom: 0;
}
.pb-item:hover,
.pb-item.is-active {
  background: var(--color-primary-bg);
}
.pb-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}
.pb-meta {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
