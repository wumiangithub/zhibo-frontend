<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElImage,
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
  deleteCourse,
  listCourses,
  RISK_STATUS_LABEL,
  setCourseShelf,
  SHELF_STATUS_LABEL,
  type CourseListItem,
  type CourseSortKey,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/course";
import AuditRecordsDrawer from "./components/AuditRecordsDrawer.vue";
import { exportCourseRows } from "./exportCourseRows";

const router = useRouter();
const loading = ref(false);
const error = ref("");
const list = ref<CourseListItem[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const auditDrawerVisible = ref(false);
const auditDrawerTitle = ref("");
const auditDrawerId = ref("");
const auditDrawerCover = ref("");
const auditDrawerCreatedTime = ref("");

const filters = reactive({
  keyword: "",
  shelfStatus: "" as "" | ShelfStatus,
  ownerName: "",
  riskStatus: "" as "" | RiskStatus,
});
const query = reactive({
  page: 1,
  pageSize: 10,
  sort: "updatedTime" as CourseSortKey,
  order: "desc" as "asc" | "desc",
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

function ownersText(item: CourseListItem) {
  const names = (item.owners ?? []).map((owner) => owner.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function timeText(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

function shelfDotClass(status?: ShelfStatus) {
  if (status === "on") return "dot--green";
  if (status === "banned") return "dot--red";
  return "dot--grey";
}

function riskClass(status?: RiskStatus) {
  if (status === "passed") return "risk--passed";
  if (status === "rejected") return "risk--rejected";
  return "risk--pending";
}

async function fetchList() {
  const keepRows = list.value.length > 0;
  loading.value = true;
  error.value = "";
  selectedIds.value = [];
  try {
    const data = await listCourses({
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      order: query.order,
      ...(filters.keyword.trim() ? { keyword: filters.keyword.trim() } : {}),
      ...(filters.shelfStatus ? { shelfStatus: filters.shelfStatus } : {}),
      ...(filters.ownerName.trim() ? { ownerName: filters.ownerName.trim() } : {}),
      ...(filters.riskStatus ? { riskStatus: filters.riskStatus } : {}),
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    if (!keepRows) {
      list.value = [];
      total.value = 0;
    }
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void fetchList();
}

function resetFilter() {
  filters.keyword = "";
  filters.shelfStatus = "";
  filters.ownerName = "";
  filters.riskStatus = "";
  query.page = 1;
  query.sort = "updatedTime";
  query.order = "desc";
  void fetchList();
}

const SORT_PROPS: Record<string, CourseSortKey> = {
  entitledUserCount: "entitledUserCount",
  totalUserCount: "totalUserCount",
  salesCount: "salesCount",
  updatedTime: "updatedTime",
};

function onSortChange(payload: { prop: string; order: string | null }) {
  const key = SORT_PROPS[payload.prop];
  if (key && payload.order) {
    query.sort = key;
    query.order = payload.order === "ascending" ? "asc" : "desc";
  } else {
    query.sort = "updatedTime";
    query.order = "desc";
  }
  query.page = 1;
  void fetchList();
}

function onSelectionChange(rows: CourseListItem[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function onExport() {
  if (!selectedIds.value.length) {
    ElMessage.warning("请先勾选要导出的课程");
    return;
  }
  exportCourseRows(list.value.filter((item) => selectedIds.value.includes(item.id)));
}

function onShare() {
  ElMessage.info("课程观看页尚未开通");
}

function openAuditRecords(item: CourseListItem) {
  auditDrawerTitle.value = item.title;
  auditDrawerId.value = item.id;
  auditDrawerCover.value = item.coverUrl || "";
  auditDrawerCreatedTime.value = item.createdTime || "";
  auditDrawerVisible.value = true;
}

async function onShelf(item: CourseListItem, listed: boolean) {
  const action = listed ? "上架" : "下架";
  try {
    await ElMessageBox.confirm(`确定要${action}「${item.title}」吗？`, action, {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await setCourseShelf(item.id, listed);
    ElMessage.success(`${action}成功`);
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : `${action}失败`);
  }
}

async function onDelete(item: CourseListItem) {
  try {
    await ElMessageBox.confirm("删除后不可恢复", "删除课程", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteCourse(item.id);
    ElMessage.success("已删除");
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onMoreCommand(cmd: string, item: CourseListItem) {
  if (cmd === "share") onShare();
  else if (cmd === "audit") void router.push(`/course/${item.id}/audit`);
  else if (cmd === "on") void onShelf(item, true);
  else if (cmd === "off") void onShelf(item, false);
  else if (cmd === "delete") void onDelete(item);
}

function onPageChange(page: number) {
  query.page = page;
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
  <div class="course-manage">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">课程名称</span>
        <ElInput
          v-model="filters.keyword"
          clearable
          placeholder="请输入课程名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">上架状态</span>
        <ElSelect
          v-model="filters.shelfStatus"
          clearable
          placeholder="全部状态"
          style="width: 140px"
        >
          <ElOption
            label="全部状态"
            value=""
          />
          <ElOption
            v-for="(label, key) in SHELF_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <div class="filter-item">
        <span class="filter-label">归属人</span>
        <ElInput
          v-model="filters.ownerName"
          clearable
          placeholder="请输入归属人"
          style="width: 160px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">审核状态</span>
        <ElSelect
          v-model="filters.riskStatus"
          clearable
          placeholder="全部状态"
          style="width: 140px"
        >
          <ElOption
            label="全部状态"
            value=""
          />
          <ElOption
            v-for="(label, key) in RISK_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <ElButton
        type="primary"
        @click="search"
      >
        查询
      </ElButton>
      <ElButton @click="resetFilter">重置</ElButton>
    </div>

    <div class="toolbar">
      <ElButton
        type="primary"
        @click="router.push('/course/create')"
      >
        + 新建课程
      </ElButton>
      <ElButton @click="onExport">导出</ElButton>
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
        empty-text="暂无课程"
        :default-sort="{ prop: 'updatedTime', order: 'descending' }"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          type="selection"
          width="48"
        />
        <ElTableColumn
          label="课程名称"
          min-width="260"
        >
          <template #default="{ row }">
            <div class="name-cell">
              <div class="cover">
                <ElImage
                  v-if="row.coverUrl"
                  :src="row.coverUrl"
                  :alt="row.title"
                  :preview-src-list="[row.coverUrl]"
                  fit="cover"
                  preview-teleported
                />
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
          label="上架状态"
          width="110"
        >
          <template #default="{ row }">
            <span class="status-dot">
              <i
                class="dot"
                :class="shelfDotClass(row.shelfStatus)"
              />
              {{ SHELF_STATUS_LABEL[row.shelfStatus] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="上架时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ timeText(row.listedTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="归属人"
          min-width="120"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="ownersText(row) !== '--'"
              :content="ownersText(row)"
              placement="top"
            >
              <span class="ellipsis">{{ ownersText(row) }}</span>
            </ElTooltip>
            <span v-else>--</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="contentCount"
          label="内容数"
          width="90"
        />
        <ElTableColumn
          prop="entitledUserCount"
          label="权益用户数"
          width="120"
          sortable="custom"
        />
        <ElTableColumn
          prop="totalUserCount"
          label="累计用户数"
          width="120"
          sortable="custom"
        />
        <ElTableColumn
          prop="salesCount"
          label="总销量"
          width="100"
          sortable="custom"
        />
        <ElTableColumn
          prop="updatedTime"
          label="最新修改时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ timeText(row.updatedTime) }}
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
              {{ RISK_STATUS_LABEL[row.riskStatus] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="208"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="ops">
              <RouterLink
                :to="`/course/${row.id}`"
                class="op-link"
              >
                管理
              </RouterLink>
              <RouterLink
                :to="`/course/${row.id}/data`"
                class="op-link"
              >
                数据
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
                    <ElDropdownItem command="share">分享</ElDropdownItem>
                    <ElDropdownItem command="audit">去审核</ElDropdownItem>
                    <ElDropdownItem
                      v-if="row.shelfStatus === 'pending' || row.shelfStatus === 'off'"
                      command="on"
                      :disabled="!row.canList"
                    >
                      上架
                    </ElDropdownItem>
                    <ElDropdownItem
                      v-if="row.shelfStatus === 'on'"
                      command="off"
                      :disabled="!row.canUnlist"
                    >
                      下架
                    </ElDropdownItem>
                    <ElDropdownItem
                      command="delete"
                      divided
                      :disabled="!row.canDelete"
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
      <span class="pager-total">共 {{ total }} 条记录，第 {{ query.page }}/{{ pageCount }} 页</span>
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

    <AuditRecordsDrawer
      v-model="auditDrawerVisible"
      :title="auditDrawerTitle"
      :course-id="auditDrawerId"
      :cover-url="auditDrawerCover"
      :created-time="auditDrawerCreatedTime"
    />
  </div>
</template>

<style scoped>
.course-manage {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.filter-bar,
.toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
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
.err-banner {
  flex: none;
  margin: 0;
  padding: 8px 12px;
  color: #cf1322;
  background: #fff2f0;
  border-radius: 4px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ebebeb;
  border-radius: 4px;
}
.name-cell {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 220px;
}
.cover {
  flex: none;
  width: 64px;
  height: 36px;
  overflow: hidden;
  background: #f0f0f0;
  border-radius: 4px;
}
.cover :deep(.el-image) {
  width: 100%;
  height: 100%;
  cursor: zoom-in;
}
.cover-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #bfbfbf;
  font-size: 10px;
}
.title {
  max-width: 220px;
  margin: 0;
  overflow: hidden;
  color: #1a1a1a;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.status-dot {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.dot {
  width: 6px;
  height: 6px;
  background: #bfbfbf;
  border-radius: 50%;
}
.dot--green {
  background: #52c41a;
}
.dot--red {
  background: #f5222d;
}
.ellipsis {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: bottom;
}
.risk-tag {
  display: inline-block;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
}
.risk--passed {
  color: #52c41a;
  background: #f6ffed;
  border-color: #b7eb8f;
}
.risk--rejected {
  color: #f5222d;
  background: #fff1f0;
  border-color: #ffa39e;
}
.risk--pending {
  color: #595959;
  background: #fafafa;
}
.op-link {
  padding: 0;
  color: var(--color-primary);
  font-size: 13px;
  text-decoration: none;
  background: transparent;
  border: 0;
  cursor: pointer;
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
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
}
.pager-total {
  margin-right: auto;
  color: #666;
  font-size: 13px;
}
</style>
