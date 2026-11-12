<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
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
  exportCourseUsers,
  listCourseUsers,
  updateCourseUserEntitlement,
  updateCourseUserExpire,
  type CourseUserEntitlementState,
  type CourseUserKeywordType,
  type CourseUserListItem,
} from "@/api/course";
import AddCourseUserDialog from "./AddCourseUserDialog.vue";

const props = defineProps<{
  courseId: string;
}>();

const loading = ref(false);
const exporting = ref(false);
const list = ref<CourseUserListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const addVisible = ref(false);

const delayVisible = ref(false);
const delaySaving = ref(false);
const delayRowId = ref<number | null>(null);
const delayExpireTime = ref("");
const delayCurrentLabel = ref("—");

function disabledDelayDate(date: Date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return date.getTime() < start.getTime();
}

const delayTimeShortcuts = [
  {
    text: "此刻",
    value: () => new Date(),
  },
  {
    text: "一周后",
    value: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    },
  },
  {
    text: "一月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  {
    text: "三月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d;
    },
  },
  {
    text: "六月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      return d;
    },
  },
];

const filters = reactive({
  keywordType: "nickname" as CourseUserKeywordType,
  keyword: "",
  entitlementState: "" as "" | CourseUserEntitlementState,
});

const keywordPlaceholder: Record<CourseUserKeywordType, string> = {
  nickname: "请输入学员昵称",
  id: "请输入用户名",
  phone: "请输入手机号",
};

async function fetchList() {
  if (!props.courseId) return;
  loading.value = true;
  try {
    const res = await listCourseUsers(props.courseId, {
      page: page.value,
      pageSize: pageSize.value,
      keywordType: filters.keywordType,
      keyword: filters.keyword,
      entitlementState: filters.entitlementState || undefined,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? page.value;
    pageSize.value = res.pageSize ?? pageSize.value;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.keywordType = "nickname";
  filters.keyword = "";
  filters.entitlementState = "";
  page.value = 1;
  void fetchList();
}

function onAddStudent() {
  addVisible.value = true;
}

async function onExport() {
  exporting.value = true;
  try {
    await exportCourseUsers(props.courseId, {
      keywordType: filters.keywordType,
      keyword: filters.keyword,
      entitlementState: filters.entitlementState || undefined,
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function openDelayDialog(row: CourseUserListItem) {
  delayRowId.value = row.id;
  delayCurrentLabel.value = row.expireDisplay || row.expireTime || "—";
  delayExpireTime.value = row.expireTime?.trim() || "";
  delayVisible.value = true;
}

async function submitDelay() {
  const rowId = delayRowId.value;
  const expireTime = delayExpireTime.value?.trim();
  if (rowId == null) return;
  if (!expireTime) {
    ElMessage.warning("请选择到期时间");
    return;
  }
  delaySaving.value = true;
  try {
    await updateCourseUserExpire(rowId, expireTime);
    ElMessage.success("到期时间已更新");
    delayVisible.value = false;
    await fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "更新失败");
  } finally {
    delaySaving.value = false;
  }
}

async function toggleEntitlement(row: CourseUserListItem) {
  const enable = row.entitlementStatus !== 1;
  const confirmMsg = enable
    ? "开启后，该用户将获得学习本课程的权限，是否确认开启？"
    : "取消后，该用户将无法继续学习本课程，是否确认取消？";
  try {
    await ElMessageBox.confirm(confirmMsg, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await updateCourseUserEntitlement(row.id, enable ? 1 : 0);
    ElMessage.success(enable ? "权限已开启" : "权限已取消");
    await fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
}

function completionText(rate: number) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

function stateDotClass(state: CourseUserEntitlementState) {
  if (state === "valid") return "dot on";
  return "dot off";
}

watch(
  () => props.courseId,
  () => {
    page.value = 1;
    void fetchList();
  },
);

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <div class="course-users hover-scrollbar">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">学员关键字</span>
        <ElSelect
          v-model="filters.keywordType"
          style="width: 110px"
        >
          <ElOption
            label="昵称"
            value="nickname"
          />
          <ElOption
            label="用户名"
            value="id"
          />
          <ElOption
            label="手机号"
            value="phone"
          />
        </ElSelect>
        <ElInput
          v-model="filters.keyword"
          clearable
          :placeholder="keywordPlaceholder[filters.keywordType]"
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">权益状态</span>
        <ElSelect
          v-model="filters.entitlementState"
          clearable
          placeholder="全部"
          style="width: 120px"
        >
          <ElOption
            label="全部"
            value=""
          />
          <ElOption
            label="有效"
            value="valid"
          />
          <ElOption
            label="已到期"
            value="expired"
          />
          <ElOption
            label="已失效"
            value="invalid"
          />
        </ElSelect>
      </div>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
      <ElButton @click="onReset">
        重置
      </ElButton>
    </div>

    <div class="toolbar">
      <ElButton
        type="primary"
        @click="onAddStudent"
      >
        <ElIcon class="btn-icon">
          <Plus />
        </ElIcon>
        添加学员
      </ElButton>
      <ElButton
        :loading="exporting"
        @click="onExport"
      >
        导出
      </ElButton>
    </div>

    <ElTable
      v-loading="loading"
      :data="list"
      row-key="id"
      class="users-table"
    >
      <ElTableColumn
        type="selection"
        width="42"
      />
      <ElTableColumn
        label="学员"
        min-width="160"
      >
        <template #default="{ row }">
          <div class="student-cell">
            <img
              v-if="row.avatar"
              class="avatar"
              :src="row.avatar"
              alt=""
            >
            <span
              v-else
              class="avatar avatar-ph"
            />
            <span class="student-name">{{ row.nickname }}</span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="账户绑定手机号"
        min-width="140"
      >
        <template #default="{ row }">
          {{ row.phoneMasked || "—" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="标签"
        min-width="140"
      >
        <template #default="{ row }">
          <ElTooltip
            v-if="row.tagLabels?.length"
            :content="row.tagLabels.join('、')"
            placement="top"
            :show-after="200"
          >
            <div class="tag-line">
              <span
                v-for="(label, idx) in row.tagLabels"
                :key="`${row.id}-${idx}`"
                class="tag-pill"
              >{{ label }}</span>
            </div>
          </ElTooltip>
          <span v-else>—</span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="小节完成率"
        width="110"
      >
        <template #default="{ row }">
          {{ completionText(row.chapterCompletionRate) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="权益状态"
        width="100"
      >
        <template #default="{ row }">
          <span class="entitlement">
            <i :class="stateDotClass(row.entitlementState)" />
            {{ row.entitlementStateLabel }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="权益获取方式"
        width="120"
      >
        <template #default="{ row }">
          {{ row.acquireWayLabel || "—" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="权益首次获取时间"
        min-width="170"
      >
        <template #default="{ row }">
          {{ row.firstAcquireTime || "—" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="权益到期时间"
        min-width="170"
      >
        <template #default="{ row }">
          {{ row.expireDisplay || "—" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="操作"
        width="160"
        fixed="right"
      >
        <template #default="{ row }">
          <div class="ops">
            <button
              type="button"
              class="link-btn"
              @click="toggleEntitlement(row as CourseUserListItem)"
            >
              {{ row.entitlementStatus === 1 ? "取消观看权限" : "开启观看权限" }}
            </button>
            <ElDropdown trigger="click">
              <button
                type="button"
                class="more-btn"
                aria-label="更多"
              >
                <i class="admin-more-icon" aria-hidden="true" />
              </button>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="openDelayDialog(row as CourseUserListItem)">
                    延迟用户时间
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchList"
        @size-change="
          () => {
            page = 1;
            fetchList();
          }
        "
      />
    </div>

    <AddCourseUserDialog
      v-model="addVisible"
      :course-id="courseId"
      @refreshed="fetchList"
    />

    <ElDialog
      v-model="delayVisible"
      title="延迟用户时间"
      width="440px"
      destroy-on-close
    >
      <div class="delay-body">
        <p class="delay-current">
          当前到期时间：{{ delayCurrentLabel }}
        </p>
        <div class="delay-field">
          <span class="delay-label">自定义到期时间</span>
          <ElDatePicker
            v-model="delayExpireTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择日期和时间"
            class="delay-picker"
            :disabled-date="disabledDelayDate"
            :shortcuts="delayTimeShortcuts"
            :show-now="false"
          />
        </div>
      </div>
      <template #footer>
        <ElButton @click="delayVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="delaySaving"
          @click="submitDelay"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.course-users {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding-right: 4px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  gap: 8px;
}

.btn-icon {
  margin-right: 4px;
}

.users-table {
  width: 100%;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-ph {
  display: inline-block;
  background: #e5e7eb;
}

.student-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-line {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
}

.tag-pill {
  flex: none;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 11px;
  border: 1px solid #fa8c16;
  color: #fa8c16;
  font-size: 12px;
  white-space: nowrap;
}

.entitlement {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #303133;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
}

.dot.on {
  background: #67c23a;
}

.ops {
  display: flex;
  align-items: center;
  gap: 4px;
}

.link-btn {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}

.link-btn:hover {
  opacity: 0.85;
}

.more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #909399;
  cursor: pointer;
  padding: 2px;
}

.more-btn:hover {
  color: var(--color-primary);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 8px;
}

.delay-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.delay-current {
  margin: 0;
  color: #606266;
  font-size: 13px;
}

.delay-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delay-label {
  font-size: 13px;
  color: #303133;
}

.delay-picker {
  width: 100%;
}
</style>
