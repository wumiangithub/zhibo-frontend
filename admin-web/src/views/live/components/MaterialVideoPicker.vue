<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElDialog, ElInput, ElButton, ElMessage, ElRadio } from "element-plus";
import {
  listMaterialGroups,
  listMaterialVideos,
  type MaterialGroup,
  type MaterialVideoItem,
} from "@/api/recordResource";
import { useToast } from "@/composables/useToast";
import UiButton from "@/components/ui/UiButton.vue";

const router = useRouter();

const props = defineProps<{
  modelValue: boolean;
  selectedId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
  select: [item: MaterialVideoItem];
}>();

const { toast } = useToast();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const loading = ref(false);
const usingMock = ref(false);
const capacityTip = ref("已使用 1.28 GB / 共 10 GB（示例）");
const groupKeyword = ref("");
const videoKeyword = ref("");
const groups = ref<MaterialGroup[]>([]);
const activeGroupId = ref("all");
const list = ref<MaterialVideoItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const pickedId = ref("");
const sortLabel = ref("上传时间");

const MOCK_GROUPS: MaterialGroup[] = [
  { id: "all", name: "全部视频", count: 6 },
  { id: "default", name: "默认分组", count: 4 },
  { id: "promo", name: "宣传素材", count: 2 },
];

const MOCK_VIDEOS: MaterialVideoItem[] = [
  {
    id: "mat-1",
    title: "产品介绍成片",
    recordId: "mock-rec-1001",
    duration: "12:30",
    size: "86.2 MB",
    status: "正常",
    citePlaces: "未引用",
    protection: "关闭",
    createdAt: "2026-09-20 10:00:00",
    groupId: "default",
  },
  {
    id: "mat-2",
    title: "春季公开课录制",
    recordId: "mock-rec-1002",
    duration: "48:05",
    size: "320.1 MB",
    status: "正常",
    citePlaces: "1 处",
    protection: "开启",
    createdAt: "2026-09-21 15:20:00",
    groupId: "default",
  },
  {
    id: "mat-3",
    title: "答疑精剪版",
    recordId: "mock-rec-1003",
    duration: "25:40",
    size: "150.0 MB",
    status: "转码中",
    citePlaces: "未引用",
    protection: "关闭",
    createdAt: "2026-09-22 09:10:00",
    groupId: "default",
  },
  {
    id: "mat-4",
    title: "品牌宣传片",
    recordId: "mock-rec-1004",
    duration: "03:18",
    size: "42.5 MB",
    status: "正常",
    citePlaces: "未引用",
    protection: "关闭",
    createdAt: "2026-09-23 11:00:00",
    groupId: "promo",
  },
  {
    id: "mat-5",
    title: "功能演示短片",
    recordId: "mock-rec-1005",
    duration: "08:02",
    size: "55.8 MB",
    status: "正常",
    citePlaces: "2 处",
    protection: "关闭",
    createdAt: "2026-09-24 16:40:00",
    groupId: "promo",
  },
  {
    id: "mat-6",
    title: "未分组样例",
    recordId: "mock-rec-1006",
    duration: "01:05",
    size: "12.0 MB",
    status: "正常",
    citePlaces: "未引用",
    protection: "关闭",
    createdAt: "2026-09-25 08:30:00",
    groupId: "default",
  },
];

const filteredGroups = computed(() => {
  const kw = groupKeyword.value.trim();
  if (!kw) return groups.value;
  return groups.value.filter((g) => g.name.includes(kw));
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

function applyMock() {
  usingMock.value = true;
  capacityTip.value = "已使用 1.28 GB / 共 10 GB（示例）";
  groups.value = MOCK_GROUPS.map((g) => ({ ...g }));
  let rows = MOCK_VIDEOS.slice();
  if (activeGroupId.value && activeGroupId.value !== "all") {
    rows = rows.filter((v) => v.groupId === activeGroupId.value);
  }
  const kw = videoKeyword.value.trim();
  if (kw) rows = rows.filter((v) => v.title.includes(kw) || v.id.includes(kw));
  total.value = rows.length;
  const start = (page.value - 1) * pageSize;
  list.value = rows.slice(start, start + pageSize);
}

async function loadGroups() {
  try {
    const data = await listMaterialGroups();
    groups.value =
      data?.length > 0
        ? data
        : [{ id: "all", name: "全部视频", count: 0 }, ...data];
    if (!groups.value.some((g) => g.id === "all")) {
      groups.value = [
        { id: "all", name: "全部视频", count: groups.value.reduce((s, g) => s + g.count, 0) },
        ...groups.value,
      ];
    }
  } catch {
    /* 列表请求里一并 mock */
  }
}

async function fetchList() {
  loading.value = true;
  usingMock.value = false;
  try {
    const data = await listMaterialVideos({
      page: page.value,
      pageSize,
      groupId: activeGroupId.value === "all" ? undefined : activeGroupId.value,
      keyword: videoKeyword.value.trim() || undefined,
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
    if (data.capacityTip) capacityTip.value = data.capacityTip;
    if (data.groups?.length) groups.value = data.groups;
    else await loadGroups();
  } catch {
    ElMessage.warning("接口未就绪，当前为示例数据");
    applyMock();
  } finally {
    loading.value = false;
    syncPicked();
  }
}

function syncPicked() {
  if (!props.selectedId) {
    pickedId.value = "";
    return;
  }
  const hit = list.value.find(
    (i) => i.id === props.selectedId || i.recordId === props.selectedId,
  );
  pickedId.value = hit?.id ?? "";
}

function selectGroup(id: string) {
  activeGroupId.value = id;
  page.value = 1;
  void fetchList();
}

function searchVideos() {
  page.value = 1;
  void fetchList();
}

function onConfirm() {
  const item = list.value.find((i) => i.id === pickedId.value);
  if (!item) {
    ElMessage.warning("请先选择一个视频");
    return;
  }
  emit("select", item);
  visible.value = false;
}

function goMaterialCenter() {
  visible.value = false;
  void router.push("/settings/materials");
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    groupKeyword.value = "";
    videoKeyword.value = "";
    activeGroupId.value = "all";
    page.value = 1;
    void fetchList();
  },
);
</script>

<template>
  <ElDialog
    v-model="visible"
    title="选择视频"
    width="960px"
    align-center
    destroy-on-close
    class="mat-video-dlg"
  >
    <p
      v-if="usingMock"
      class="mock-tip"
    >
      接口未就绪，当前为示例数据
    </p>
    <div
      v-if="capacityTip"
      class="cap-bar"
    >
      {{ capacityTip }}
    </div>

    <div class="layout">
      <aside class="side">
        <ElInput
          v-model="groupKeyword"
          clearable
          placeholder="搜索分组"
          size="small"
        />
        <ul class="group-list">
          <li
            v-for="g in filteredGroups"
            :key="g.id"
            class="group-item"
            :class="{ 'is-active': activeGroupId === g.id }"
            @click="selectGroup(g.id)"
          >
            <span class="group-name">{{ g.name }}</span>
            <span class="group-count">{{ g.count }}</span>
          </li>
        </ul>
      </aside>

      <div class="main">
        <div class="toolbar">
          <UiButton
            variant="outline"
            @click="toast('「上传视频」暂未开放')"
          >
            上传视频
          </UiButton>
          <span class="sort">排序：{{ sortLabel }}</span>
          <ElInput
            v-model="videoKeyword"
            clearable
            placeholder="按名称搜索"
            style="width: 200px; margin-left: auto"
            @keyup.enter="searchVideos"
          />
          <UiButton
            variant="default"
            @click="searchVideos"
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
          暂无视频
        </div>
        <table
          v-else
          class="tbl"
        >
          <thead>
            <tr>
              <th class="col-radio" />
              <th>视频</th>
              <th>大小</th>
              <th>状态</th>
              <th>引用位置</th>
              <th>增强防护</th>
              <th>上传时间</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in list"
              :key="item.id"
              :class="{ 'is-active': pickedId === item.id }"
              @click="pickedId = item.id"
            >
              <td class="col-radio">
                <ElRadio
                  v-model="pickedId"
                  :value="item.id"
                  @click.stop
                />
              </td>
              <td>
                <div class="video-cell">
                  <div class="thumb">
                    <img
                      v-if="item.coverUrl"
                      :src="item.coverUrl"
                      alt=""
                    >
                    <span v-else>视频</span>
                  </div>
                  <div>
                    <p class="v-title">{{ item.title }}</p>
                    <p class="v-sub">{{ item.duration || "--" }}</p>
                  </div>
                </div>
              </td>
              <td>{{ item.size || "--" }}</td>
              <td>{{ item.status || "--" }}</td>
              <td>{{ item.citePlaces || "--" }}</td>
              <td>{{ item.protection || "--" }}</td>
              <td>{{ item.createdAt || "--" }}</td>
            </tr>
          </tbody>
        </table>

        <div class="pager">
          <span>共 {{ total }} 条 · 第 {{ page }}/{{ pageCount }} 页</span>
          <UiButton
            variant="default"
            :disabled="page <= 1 || loading"
            @click="page--; fetchList()"
          >
            上一页
          </UiButton>
          <UiButton
            variant="default"
            :disabled="page >= pageCount || loading"
            @click="page++; fetchList()"
          >
            下一页
          </UiButton>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <UiButton
          variant="link"
          @click="goMaterialCenter"
        >
          前往素材中心
        </UiButton>
        <div class="footer-actions">
          <ElButton @click="visible = false">取消</ElButton>
          <ElButton
            type="primary"
            @click="onConfirm"
          >
            确认
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.mock-tip {
  margin: 0 0 10px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  font-size: 12px;
  color: #ad6800;
}
.cap-bar {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
}
.layout {
  display: flex;
  gap: 12px;
  min-height: 420px;
}
.side {
  flex: none;
  width: 180px;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 10px;
  background: #fafbfc;
}
.group-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
}
.group-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text);
}
.group-item:hover {
  background: var(--color-primary-bg);
}
.group-item.is-active {
  background: var(--color-primary-bg-active);
  color: var(--color-primary);
  font-weight: 600;
}
.group-count {
  color: var(--color-text-placeholder);
  font-size: 12px;
}
.main {
  flex: 1;
  min-width: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.sort {
  font-size: 12px;
  color: var(--color-text-placeholder);
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
  color: var(--color-text-secondary);
  vertical-align: middle;
}
.tbl th {
  font-weight: 500;
  color: var(--color-text-placeholder);
  background: #fafbfc;
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
.video-cell {
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
.v-title {
  margin: 0;
  color: var(--color-text);
  font-weight: 500;
}
.v-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
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
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
