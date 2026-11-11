<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
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
  courseSellTagText,
  listCourses,
  RISK_STATUS_LABEL,
  setCourseShelf,
  SHELF_STATUS_LABEL,
  type CourseListItem,
  type CourseSortKey,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/course";
import ShareDialog from "@/components/share/ShareDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { buildCourseShareUrl } from "@/utils/courseLinks";
import AuditRecordsDrawer from "./components/AuditRecordsDrawer.vue";
import DeleteCourseDialog from "./components/DeleteCourseDialog.vue";
import { exportCourseRows } from "./exportCourseRows";

const router = useRouter();
const auth = useAuthStore();
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

const deleteDialogVisible = ref(false);
const deleteCourseId = ref("");

const shareVisible = ref(false);
const shareTitle = ref("");
const shareWatchUrl = ref("");

const filters = reactive({
  keyword: "",
  shelfStatus: "all" as "all" | ShelfStatus,
  ownerName: "",
  riskStatus: "all" as "all" | RiskStatus,
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

function shelfTone(status?: ShelfStatus) {
  if (status === "on") return "success";
  if (status === "banned") return "danger";
  if (status === "pending") return "pending";
  return "ended";
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
      ...(filters.shelfStatus && filters.shelfStatus !== "all" ? { shelfStatus: filters.shelfStatus } : {}),
      ...(filters.ownerName.trim() ? { ownerName: filters.ownerName.trim() } : {}),
      ...(filters.riskStatus && filters.riskStatus !== "all" ? { riskStatus: filters.riskStatus } : {}),
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
  filters.shelfStatus = "all";
  filters.ownerName = "";
  filters.riskStatus = "all";
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

function onSortChange(payload: { prop: string | null; order: string | null }) {
  const key = payload.prop ? SORT_PROPS[payload.prop] : undefined;
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

function onShare(item: CourseListItem) {
  shareTitle.value = item.title;
  shareWatchUrl.value = buildCourseShareUrl(item.id, auth.user?.id);
  shareVisible.value = true;
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

function onDelete(item: CourseListItem) {
  deleteCourseId.value = item.id;
  deleteDialogVisible.value = true;
}

function onDeleteConfirmed() {
  ElMessage.success("已删除");
  void fetchList();
}

function onMoreCommand(cmd: string, item: CourseListItem) {
  if (cmd === "share") onShare(item);
  else if (cmd === "audit") void router.push(`/course/${item.id}/audit`);
  else if (cmd === "on") void onShelf(item, true);
  else if (cmd === "off") void onShelf(item, false);
  else if (cmd === "delete") onDelete(item);
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
  <div class="admin-panel admin-panel--row-72 course-manage">
    <div class="admin-filter-bar">
      <div class="admin-filter-fields">
      <div class="admin-filter-item">
        <span class="admin-filter-label">课程名称</span>
        <ElInput
          v-model="filters.keyword"
          clearable
          placeholder="请输入课程名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">上架状态</span>
        <ElSelect
          v-model="filters.shelfStatus"
          placeholder="全部状态"
          style="width: 120px"
        >
          <ElOption
            label="全部状态"
            value="all"
          />
          <ElOption
            v-for="(label, key) in SHELF_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">归属人</span>
        <ElInput
          v-model="filters.ownerName"
          clearable
          placeholder="请输入归属人"
          style="width: 160px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">审核状态</span>
        <ElSelect
          v-model="filters.riskStatus"
          placeholder="全部状态"
          style="width: 120px"
        >
          <ElOption
            label="全部状态"
            value="all"
          />
          <ElOption
            v-for="(label, key) in RISK_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      </div>
      <div class="admin-filter-actions">
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          @click="search"
        >
          查询
        </button>
        <button
          type="button"
          class="admin-btn admin-btn--ghost"
          @click="resetFilter"
        >
          重置
        </button>
      </div>
    </div>

    <div class="admin-toolbar">
      <button
        type="button"
        class="admin-btn admin-btn--primary"
        @click="router.push('/course/create')"
      >
        + 新建课程
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--ghost"
        @click="onExport"
      >
        导出
      </button>
    </div>

    <p
      v-if="error"
      class="admin-err"
    >
      {{ error }}
    </p>

    <div class="admin-table-wrap">
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
          width="44"
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
                <p class="sell-tag">{{ courseSellTagText(row) }}</p>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="上架状态"
          width="128"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${shelfTone(row.shelfStatus)}`"
            >
              <i class="dot" />
              {{ SHELF_STATUS_LABEL[(row as CourseListItem).shelfStatus] }}
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
              v-if="ownersText(row as CourseListItem) !== '--'"
              :content="ownersText(row as CourseListItem)"
              placement="top"
            >
              <span class="ellipsis">{{ ownersText(row as CourseListItem) }}</span>
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
              {{ RISK_STATUS_LABEL[(row as CourseListItem).riskStatus] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="208"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="admin-ops">
              <RouterLink
                :to="`/course/${row.id}`"
                class="admin-op"
              >
                管理
              </RouterLink>
              <RouterLink
                :to="{ path: `/course/${row.id}`, query: { tab: 'data' } }"
                class="admin-op"
              >
                数据
              </RouterLink>
              <!-- D109：去审核 / 审核记录入口暂隐藏，接口与路由保留 -->
              <ElDropdown
                trigger="click"
                @command="(cmd: string) => onMoreCommand(cmd, row as CourseListItem)"
              >
                <button
                  type="button"
                  class="admin-op-more"
                  aria-label="更多"
                >
                  
                </button>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem command="share">分享</ElDropdownItem>
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

    <div class="admin-pager">
      <span class="admin-pager__total">共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页</span>
      <ElPagination
        :current-page="query.page"
        :page-size="query.pageSize"
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

    <DeleteCourseDialog
      v-model="deleteDialogVisible"
      :course-id="deleteCourseId"
      @confirmed="onDeleteConfirmed"
    />

    <ShareDialog
      v-model="shareVisible"
      :title="shareTitle"
      :watch-url="shareWatchUrl"
      brand-line="钱坤云直播平台 发现一门精彩课程"
      hint="给用户分享这个课程："
      watch-verb="点击学习"
      title-fallback="课程"
    />
  </div>
</template>

<style scoped>
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.cover {
  width: 72px;
  height: 48px;
  flex: none;
  overflow: hidden;
  border-radius: 6px;
  background: var(--line-soft);
}
.cover :deep(.el-image) {
  width: 100%;
  height: 100%;
  cursor: zoom-in;
}
.cover-ph {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-4);
}
.name-meta {
  min-width: 0;
}
.title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sell-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin: 2px 0 0;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  background: #F1F5F9;
  color: var(--text-3);
}
.ellipsis {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.risk-tag {
  display: inline-block;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--text-3);
  background: #F8FAFC;
  white-space: nowrap;
}
.risk--passed {
  color: var(--success);
  background: #ecfbf3;
  border-color: color-mix(in srgb, var(--success) 35%, #fff);
}
.risk--rejected {
  color: var(--danger);
  background: #fff1f0;
  border-color: color-mix(in srgb, var(--danger) 35%, #fff);
}
.risk--pending {
  color: var(--text-3);
  background: #F8FAFC;
}
</style>
