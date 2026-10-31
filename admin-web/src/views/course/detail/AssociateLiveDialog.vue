<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { Search } from "@element-plus/icons-vue";
import {
  listActivities,
  RISK_STATUS_LABEL,
  sellTagText,
  type ActivityListItem,
  type RiskStatus,
} from "@/api/activity";
import {
  bindCatalogLives,
  listCatalogUsedContents,
} from "@/api/course";

const props = defineProps<{
  courseId: string;
  parentId: number;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const loading = ref(false);
const confirming = ref(false);
const keyword = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const selected = ref<ActivityListItem[]>([]);
const usedLiveIds = ref<Set<string>>(new Set());
const tableRef = ref<InstanceType<typeof ElTable> | null>(null);

const selectedIds = computed(() => new Set(selected.value.map((r) => String(r.id))));

function timeText(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

function riskLabel(status?: RiskStatus) {
  if (!status) return "--";
  return RISK_STATUS_LABEL[status] ?? status;
}

function riskClass(status?: RiskStatus) {
  if (status === "passed") return "risk--passed";
  if (status === "rejected") return "risk--rejected";
  return "risk--pending";
}

function isUsed(row: ActivityListItem) {
  return usedLiveIds.value.has(String(row.id));
}

function selectable(row: ActivityListItem) {
  return !isUsed(row);
}

async function loadUsed() {
  try {
    const data = await listCatalogUsedContents(props.courseId);
    usedLiveIds.value = new Set((data.lives ?? []).map(String));
  } catch {
    usedLiveIds.value = new Set();
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const data = await listActivities({
      page: page.value,
      pageSize: pageSize.value,
      ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载直播失败");
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onSelectionChange(rows: ActivityListItem[]) {
  const pageIds = new Set(list.value.map((r) => String(r.id)));
  const kept = selected.value.filter((r) => !pageIds.has(String(r.id)));
  const next = [...kept, ...rows.filter((r) => selectable(r))];
  const map = new Map(next.map((r) => [String(r.id), r]));
  selected.value = [...map.values()];
}

function onPageChange(p: number) {
  page.value = p;
  void fetchList();
}

function onPageSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  void fetchList();
}

async function onConfirm() {
  if (!selected.value.length) {
    ElMessage.warning("请选择直播");
    return;
  }
  confirming.value = true;
  try {
    await bindCatalogLives(props.courseId, {
      parentId: props.parentId,
      activityIds: selected.value.map((r) => String(r.id)),
    });
    ElMessage.success("已关联直播小节");
    visible.value = false;
    emit("confirmed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "关联失败");
  } finally {
    confirming.value = false;
  }
}

watch(visible, (open) => {
  if (!open) return;
  keyword.value = "";
  page.value = 1;
  selected.value = [];
  void loadUsed().then(() => fetchList());
});

watch(list, () => {
  // 翻页后恢复本页勾选
  const restore = list.value.filter((r) => selectedIds.value.has(String(r.id)));
  if (restore.length) {
    requestAnimationFrame(() => {
      restore.forEach((row) => tableRef.value?.toggleRowSelection(row, true));
    });
  }
});
</script>

<template>
  <ElDialog
    v-model="visible"
    title="关联已有直播"
    width="920px"
    append-to-body
    destroy-on-close
    class="associate-live-dialog"
  >
    <div class="toolbar">
      <span class="toolbar-label">直播名称</span>
      <ElInput
        v-model="keyword"
        clearable
        placeholder="请输入"
        style="width: 240px"
        :prefix-icon="Search"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="list"
      row-key="id"
      height="420"
      empty-text="暂无直播"
      @selection-change="onSelectionChange"
    >
      <ElTableColumn
        type="selection"
        width="48"
        :selectable="selectable"
      />
      <ElTableColumn
        label="直播名称"
        min-width="260"
      >
        <template #default="{ row }">
          <div class="name-cell">
            <div class="cover">
              <img
                v-if="row.coverUrl"
                :src="row.coverUrl"
                alt=""
              >
              <span v-else>封面</span>
            </div>
            <div class="name-meta">
              <p class="title">
                {{ row.title }}
              </p>
              <p class="sell">
                {{ sellTagText(row) || "--" }}
              </p>
              <p
                v-if="isUsed(row)"
                class="used"
              >
                已关联本课程
              </p>
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="直播上架时间"
        width="170"
      >
        <template #default="{ row }">
          {{ timeText(row.createdTime) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="直播开始时间"
        width="170"
      >
        <template #default="{ row }">
          {{ timeText(row.startTime) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="风控合规审核"
        width="120"
      >
        <template #default="{ row }">
          <span
            class="risk-tag"
            :class="riskClass(row.riskStatus)"
          >
            {{ riskLabel(row.riskStatus) }}
          </span>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <span>共 {{ total }} 条</span>
      <ElPagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        background
        layout="sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="confirming"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.toolbar-label {
  font-size: 13px;
  color: #666;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cover {
  width: 64px;
  height: 36px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 12px;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.name-meta {
  min-width: 0;
}
.title {
  margin: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sell,
.used {
  margin: 2px 0 0;
  font-size: 12px;
  color: #999;
}
.used {
  color: #fa8c16;
}
.risk-tag {
  font-size: 13px;
}
.risk--passed {
  color: var(--color-success);
}
.risk--rejected {
  color: var(--color-danger);
}
.risk--pending {
  color: #faad14;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
  color: #666;
}
</style>
