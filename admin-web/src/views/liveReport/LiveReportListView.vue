<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ElButton,
  ElDatePicker,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import {
  deleteLiveReport,
  listLiveReports,
  REPORT_STATUS_LABEL,
  type LiveReport,
  type ReportStatus,
} from "@/api/liveReport";
import ImagePreview from "@/components/ImagePreview.vue";
import type { ImagePreviewItem } from "@/components/ImagePreview.vue";
import { copyText } from "@/utils/copyText";
import ReportAuditDrawer from "./ReportAuditDrawer.vue";

const router = useRouter();

const loading = ref(false);
const error = ref("");
const list = ref<LiveReport[]>([]);
const total = ref(0);
/** 列表多选（暂无批量业务，仅 UI / 状态预留） */
const selectedIds = ref<string[]>([]);

const auditDrawerVisible = ref(false);
const auditDrawerId = ref("");
const auditDrawerTitle = ref("");
const auditDrawerCover = ref("");

/** 列表封面点击放大（共用 ImagePreview，对齐素材中心） */
const coverPreviewVisible = ref(false);
const coverPreviewItems = ref<ImagePreviewItem[]>([]);

const filters = reactive({
  title: "",
  hostName: "",
  status: "" as "" | ReportStatus,
  range: null as [string, string] | null,
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

function openCoverPreview(url?: string | null, title?: string) {
  if (!url) return;
  coverPreviewItems.value = [{ url, name: title || "封面" }];
  coverPreviewVisible.value = true;
}

function copyReportId(id: string) {
  void copyText(id, "报备ID已复制");
}

function fmtTimes(r: LiveReport) {
  if (!r.planTimes?.length) return "--";
  return r.planTimes.map((x) => `${x.startTime} 至 ${x.endTime}`).join("；");
}

function statusClass(status: ReportStatus) {
  if (status === "passed") return "risk--passed";
  if (status === "rejected") return "risk--rejected";
  return "risk--pending";
}

async function fetchList() {
  loading.value = true;
  error.value = "";
  selectedIds.value = [];
  try {
    const data = await listLiveReports({
      page: query.page,
      pageSize: query.pageSize,
      title: filters.title.trim() || undefined,
      hostName: filters.hostName.trim() || undefined,
      status: filters.status || undefined,
      startFrom: filters.range?.[0],
      startTo: filters.range?.[1],
    });
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
  filters.title = "";
  filters.hostName = "";
  filters.status = "";
  filters.range = null;
  query.page = 1;
  void fetchList();
}

function onSelectionChange(rows: LiveReport[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function goCreate() {
  void router.push("/live-reports/new");
}

/** 待审核 / 已通过 / 已驳回均可进入去审核（契约 §4） */
function canAudit(r: LiveReport) {
  return r.status === "pending" || r.status === "passed" || r.status === "rejected";
}

function openAuditRecords(row: LiveReport) {
  auditDrawerId.value = row.id;
  auditDrawerTitle.value = row.title;
  auditDrawerCover.value = row.coverUrl ?? "";
  auditDrawerVisible.value = true;
}

async function onDelete(row: LiveReport) {
  try {
    await ElMessageBox.confirm("删除后不可恢复", "删除报备", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteLiveReport(row.id);
    ElMessage.success("已删除");
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onMoreCommand(command: string, row: LiveReport) {
  if (command === "audit" && canAudit(row)) {
    void router.push(`/live-reports/audit/${row.id}`);
  } else if (command === "delete") {
    void onDelete(row);
  }
}

function onPageChange(p: number) {
  query.page = p;
  void fetchList();
}

function onPageSizeChange(size: number) {
  query.pageSize = size;
  query.page = 1;
  void fetchList();
}

onMounted(fetchList);
</script>

<template>
  <div class="live-report-list">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">报备名称</span>
        <ElInput
          v-model="filters.title"
          clearable
          placeholder="请输入报备名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">主播姓名</span>
        <ElInput
          v-model="filters.hostName"
          clearable
          placeholder="请输入主播姓名"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">审核状态</span>
        <ElSelect
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          style="width: 140px"
        >
          <ElOption
            label="全部状态"
            value=""
          />
          <ElOption
            v-for="(label, key) in REPORT_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <div class="filter-item">
        <span class="filter-label">计划时间</span>
        <ElDatePicker
          v-model="filters.range"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          range-separator="至"
          style="width: 360px"
        />
      </div>
      <ElButton @click="resetFilter">重置</ElButton>
      <ElButton
        type="primary"
        @click="search"
      >
        查询
      </ElButton>
    </div>

    <div class="toolbar">
      <ElButton
        type="primary"
        @click="goCreate"
      >
        + 新建直播报备
      </ElButton>
    </div>

    <p
      v-if="error"
      class="err-banner"
    >
      {{ error }}
    </p>

    <div class="table-wrap">
      <ElTable
        v-loading="loading"
        :data="list"
        row-key="id"
        height="100%"
        empty-text="暂无报备"
        @selection-change="onSelectionChange"
      >
        <ElTableColumn
          type="selection"
          width="48"
        />
        <ElTableColumn
          label="报备ID"
          min-width="200"
          class-name="col-id"
        >
          <template #default="{ row }">
            <ElTooltip
              :content="row.id"
              placement="top"
            >
              <button
                type="button"
                class="id-copy"
                :title="row.id"
                @click="copyReportId(row.id)"
              >
                {{ row.id }}
              </button>
            </ElTooltip>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="报备直播名称"
          min-width="260"
        >
          <template #default="{ row }">
            <div class="name-cell">
              <div class="cover">
                <img
                  v-if="row.coverUrl"
                  :src="row.coverUrl"
                  :alt="row.title"
                  @click.stop="openCoverPreview(row.coverUrl, row.title)"
                >
                <span
                  v-else
                  class="cover-ph"
                >无封面</span>
              </div>
              <div class="name-meta">
                <ElTooltip
                  :content="row.title"
                  placement="top"
                >
                  <p class="title">{{ row.title }}</p>
                </ElTooltip>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="主播"
          width="120"
        >
          <template #default="{ row }">
            {{ row.host?.userName || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="计划时间"
          min-width="340"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="fmtTimes(row) !== '--'"
              :content="fmtTimes(row)"
              placement="top"
            >
              <span class="ellipsis time-ellipsis">{{ fmtTimes(row) }}</span>
            </ElTooltip>
            <span v-else>--</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="审核状态"
          width="110"
        >
          <template #default="{ row }">
            <span
              class="risk-tag"
              :class="statusClass(row.status)"
            >
              {{ REPORT_STATUS_LABEL[row.status] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="180"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="ops">
              <RouterLink
                :to="`/live-reports/${row.id}`"
                class="op-link"
              >
                查看
              </RouterLink>
              <button
                type="button"
                class="op-link"
                @click="openAuditRecords(row)"
              >
                审核记录
              </button>
              <ElDropdown
                trigger="click"
                @command="(cmd: string) => onMoreCommand(cmd, row)"
              >
                <button
                  type="button"
                  class="op-more"
                >
                  ···
                </button>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem
                      command="audit"
                      :disabled="!canAudit(row)"
                    >
                      去审核
                    </ElDropdownItem>
                    <ElDropdownItem
                      command="delete"
                      divided
                    >
                      删除
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="pager">
      <span class="pager-total">共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页</span>
      <ElPagination
        :current-page="query.page"
        :page-size="query.pageSize"
        background
        layout="sizes, prev, pager, next, jumper"
        :total="total"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <ReportAuditDrawer
      v-model="auditDrawerVisible"
      :report-id="auditDrawerId"
      :title="auditDrawerTitle"
      :cover-url="auditDrawerCover"
    />

    <ImagePreview
      v-model="coverPreviewVisible"
      :items="coverPreviewItems"
    />
  </div>
</template>

<style scoped>
.live-report-list {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 顶栏 52 + main padding 20*2，与直播管理 / 素材中心一致，避免整页滚 */
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.filter-bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}
.err-banner {
  flex: none;
  margin: 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: #fff2f0;
  color: #cf1322;
  font-size: 13px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.cover {
  width: 64px;
  height: 48px;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
  background: #f0f0f0;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.cover-ph {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #bfbfbf;
}
.name-meta {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.name-meta :deep(.el-tooltip__trigger),
.title {
  margin: 0;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-word;
}
.ellipsis {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.time-ellipsis {
  max-width: 320px;
}
:deep(.col-id .cell) {
  overflow: hidden;
}
:deep(.col-id .cell .el-tooltip__trigger),
:deep(.col-id .cell > span) {
  display: block;
  max-width: 100%;
  overflow: hidden;
}
.id-copy {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--color-primary);
  text-align: left;
  cursor: pointer;
}
.id-copy:hover {
  text-decoration: underline;
}
.risk-tag {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 2px;
  border: 1px solid #d9d9d9;
  font-size: 12px;
}
.risk--passed {
  color: #52c41a;
  border-color: #b7eb8f;
  background: #f6ffed;
}
.risk--rejected {
  color: #f5222d;
  border-color: #ffa39e;
  background: #fff1f0;
}
.risk--pending {
  color: #595959;
  border-color: #d9d9d9;
  background: #fafafa;
}
.ops {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.op-link {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}
.op-link:hover {
  text-decoration: underline;
}
.op-link:disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  text-decoration: none;
}
.op-more {
  border: 0;
  background: transparent;
  padding: 0 4px;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}
.op-more:hover {
  color: var(--color-primary);
}
.pager {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.pager-total {
  font-size: 13px;
  color: #666;
  margin-right: auto;
}
</style>
