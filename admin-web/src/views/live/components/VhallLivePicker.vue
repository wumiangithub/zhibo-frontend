<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElDialog,
  ElInput,
  ElButton,
  ElMessage,
  ElMessageBox,
  ElRadio,
  ElSelect,
  ElOption,
  ElPagination,
} from "element-plus";
import {
  listVhallLives,
  listVhallLiveRecords,
  type VhallLiveItem,
  type VhallPlaybackItem,
} from "@/api/recordResource";
import { STATE_LABEL } from "@/api/activity";
import { resolveCreatedTime } from "@/utils/createdTime";
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
/** 直播状态多选；空 = 不过滤；默认「结束」 */
const selectedStates = ref<number[]>([3]);
const list = ref<VhallLiveItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const pickedLiveId = ref("");

const playbackVisible = ref(false);
const playbackLoading = ref(false);
const playbackList = ref<VhallPlaybackItem[]>([]);
const pickedPlaybackId = ref<number | null>(null);
const pendingLive = ref<VhallLiveItem | null>(null);

const STATE_OPTIONS = (Object.entries(STATE_LABEL) as [string, string][]).map(
  ([value, label]) => ({ value: Number(value), label }),
);

function stateText(item: VhallLiveItem) {
  return item.stateLabel || STATE_LABEL[item.state ?? -1] || "--";
}

function onFilterChange() {
  page.value = 1;
  void fetchLives();
}

function onPageChange(p: number) {
  page.value = p;
  void fetchLives();
}

function onPageSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  void fetchLives();
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
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      states: selectedStates.value.length > 0 ? selectedStates.value : undefined,
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
    selectedStates.value = [3];
    page.value = 1;
    pageSize.value = 10;
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
    class="vhall-live-picker"
  >
    <div class="picker-layout">
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
        <ElSelect
          v-model="selectedStates"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          placeholder="直播状态"
          style="width: 200px"
          @change="onFilterChange"
        >
          <ElOption
            v-for="opt in STATE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </ElSelect>
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索直播名称"
          style="width: 220px; margin-left: auto"
          @keyup.enter="page = 1; fetchLives()"
        />
        <UiButton
          variant="outline"
          @click="page = 1; fetchLives()"
        >
          搜索
        </UiButton>
      </div>

      <div class="list-scroll">
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
      </div>

      <div class="pager">
        <ElPagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          :disabled="loading"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
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
            <span v-if="resolveCreatedTime(pb)">{{ resolveCreatedTime(pb) }}</span>
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
.picker-layout {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 0;
}
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
  flex: none;
}
.list-scroll {
  flex: none;
  height: 360px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
}
.empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
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
  position: sticky;
  top: 0;
  z-index: 1;
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
  justify-content: flex-end;
  margin-top: 12px;
  flex: none;
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

<!-- ElDialog 挂到 body，壳层样式需非 scoped -->
<style>
.vhall-live-picker.el-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 80px);
}
.vhall-live-picker .el-dialog__header,
.vhall-live-picker .el-dialog__footer {
  flex: none;
}
.vhall-live-picker .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>
