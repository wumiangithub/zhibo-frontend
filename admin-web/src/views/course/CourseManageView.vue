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
const selectPage = computed({
  get: () => list.value.length > 0 && selectedIds.value.length === list.value.length,
  set: (checked: boolean) => {
    selectedIds.value = checked ? list.value.map((item) => item.id) : [];
  },
});

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

function toggleSort(key: CourseSortKey) {
  if (query.sort === key) {
    query.order = query.order === "asc" ? "desc" : "asc";
  } else {
    query.sort = key;
    query.order = "desc";
  }
  query.page = 1;
  void fetchList();
}

function sortActive(key: CourseSortKey, dir: "asc" | "desc") {
  return query.sort === key && query.order === dir;
}

function toggleRow(id: string) {
  const index = selectedIds.value.indexOf(id);
  if (index >= 0) selectedIds.value.splice(index, 1);
  else selectedIds.value.push(id);
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

    <div
      class="table-wrap"
      :class="{ 'is-loading': loading && list.length > 0 }"
    >
      <table class="course-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                v-model="selectPage"
                type="checkbox"
                class="row-check"
              >
            </th>
            <th>课程名称</th>
            <th>上架状态</th>
            <th>上架时间</th>
            <th>归属人</th>
            <th>内容数</th>
            <th>
              <button
                type="button"
                class="sort-btn"
                @click="toggleSort('entitledUserCount')"
              >
                权益用户数
                <span class="sort-carets">
                  <i
                    class="sort-caret sort-caret--asc"
                    :class="{ 'is-active': sortActive('entitledUserCount', 'asc') }"
                  />
                  <i
                    class="sort-caret sort-caret--desc"
                    :class="{ 'is-active': sortActive('entitledUserCount', 'desc') }"
                  />
                </span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="sort-btn"
                @click="toggleSort('totalUserCount')"
              >
                累计用户数
                <span class="sort-carets">
                  <i
                    class="sort-caret sort-caret--asc"
                    :class="{ 'is-active': sortActive('totalUserCount', 'asc') }"
                  />
                  <i
                    class="sort-caret sort-caret--desc"
                    :class="{ 'is-active': sortActive('totalUserCount', 'desc') }"
                  />
                </span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="sort-btn"
                @click="toggleSort('salesCount')"
              >
                总销量
                <span class="sort-carets">
                  <i
                    class="sort-caret sort-caret--asc"
                    :class="{ 'is-active': sortActive('salesCount', 'asc') }"
                  />
                  <i
                    class="sort-caret sort-caret--desc"
                    :class="{ 'is-active': sortActive('salesCount', 'desc') }"
                  />
                </span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="sort-btn"
                @click="toggleSort('updatedTime')"
              >
                最新修改时间
                <span class="sort-carets">
                  <i
                    class="sort-caret sort-caret--asc"
                    :class="{ 'is-active': sortActive('updatedTime', 'asc') }"
                  />
                  <i
                    class="sort-caret sort-caret--desc"
                    :class="{ 'is-active': sortActive('updatedTime', 'desc') }"
                  />
                </span>
              </button>
            </th>
            <th>风控合规审核</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!list.length">
            <td
              colspan="12"
              class="empty-cell"
            >
              {{ loading ? "加载中…" : "暂无课程" }}
            </td>
          </tr>
          <tr
            v-for="item in list"
            v-else
            :key="item.id"
          >
            <td>
              <input
                type="checkbox"
                class="row-check"
                :checked="selectedIds.includes(item.id)"
                @change="toggleRow(item.id)"
              >
            </td>
            <td>
              <div class="name-cell">
                <div class="cover">
                  <ElImage
                    v-if="item.coverUrl"
                    :src="item.coverUrl"
                    :alt="item.title"
                    :preview-src-list="[item.coverUrl]"
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
                    :content="item.title"
                    placement="top"
                  >
                    <p class="title">{{ item.title }}</p>
                  </ElTooltip>
                  <p class="sell-tag">未设置</p>
                </div>
              </div>
            </td>
            <td>
              <span class="status-dot">
                <i
                  class="dot"
                  :class="shelfDotClass(item.shelfStatus)"
                />
                {{ SHELF_STATUS_LABEL[item.shelfStatus] }}
              </span>
            </td>
            <td>{{ timeText(item.listedTime) }}</td>
            <td>
              <ElTooltip
                v-if="ownersText(item) !== '--'"
                :content="ownersText(item)"
                placement="top"
              >
                <span class="ellipsis">{{ ownersText(item) }}</span>
              </ElTooltip>
              <span v-else>--</span>
            </td>
            <td>{{ item.contentCount }}</td>
            <td>{{ item.entitledUserCount }}</td>
            <td>{{ item.totalUserCount }}</td>
            <td>{{ item.salesCount }}</td>
            <td>{{ timeText(item.updatedTime) }}</td>
            <td>
              <span
                class="risk-tag"
                :class="riskClass(item.riskStatus)"
              >
                {{ RISK_STATUS_LABEL[item.riskStatus] }}
              </span>
            </td>
            <td>
              <div class="ops">
                <RouterLink
                  :to="`/course/${item.id}`"
                  class="op-link"
                >
                  管理
                </RouterLink>
                <RouterLink
                  :to="`/course/${item.id}/data`"
                  class="op-link"
                >
                  数据
                </RouterLink>
                <button
                  type="button"
                  class="op-link"
                  @click="openAuditRecords(item)"
                >
                  审核记录
                </button>
                <ElDropdown
                  trigger="click"
                  @command="(cmd: string) => onMoreCommand(cmd, item)"
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
                        v-if="item.shelfStatus === 'pending' || item.shelfStatus === 'off'"
                        command="on"
                        :disabled="!item.canList"
                      >
                        上架
                      </ElDropdownItem>
                      <ElDropdownItem
                        v-if="item.shelfStatus === 'on'"
                        command="off"
                        :disabled="!item.canUnlist"
                      >
                        下架
                      </ElDropdownItem>
                      <ElDropdownItem
                        command="delete"
                        divided
                        :disabled="!item.canDelete"
                      >
                        删除
                      </ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}
.table-wrap.is-loading {
  pointer-events: none;
}
.table-wrap.is-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.45);
}
.course-table {
  width: 100%;
  min-width: 1280px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  text-align: left;
}
.course-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px;
  font-weight: 400;
  color: #999;
  white-space: nowrap;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}
.course-table td {
  padding: 12px;
  color: #666;
  vertical-align: middle;
  border-bottom: 1px solid #f5f5f5;
}
.course-table tr:hover td {
  background: #fafafa;
}
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: inherit;
  font: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.sort-carets {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 10px;
  height: 14px;
  justify-content: center;
}
.sort-caret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}
.sort-caret--asc {
  border-bottom: 5px solid #c0c4cc;
}
.sort-caret--desc {
  border-top: 5px solid #c0c4cc;
}
.sort-caret.is-active.sort-caret--asc {
  border-bottom-color: var(--color-primary);
}
.sort-caret.is-active.sort-caret--desc {
  border-top-color: var(--color-primary);
}
.sort-btn:hover .sort-caret--asc:not(.is-active) {
  border-bottom-color: #909399;
}
.sort-btn:hover .sort-caret--desc:not(.is-active) {
  border-top-color: #909399;
}
.col-check {
  width: 40px;
}
.row-check {
  accent-color: var(--color-primary);
}
.empty-cell {
  padding: 64px 12px !important;
  color: #bfbfbf;
  text-align: center;
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
.sell-tag {
  margin: 2px 0 0;
  color: #f5222d;
  font-size: 12px;
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
