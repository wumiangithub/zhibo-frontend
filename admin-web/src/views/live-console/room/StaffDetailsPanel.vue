<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";
import {
  listConsoleStaffDetails,
  type ConsoleSessionInviterItem,
  type ConsoleStaffDetailItem,
} from "./api/console";
import { formatDurationSec } from "@/api/audience";
import { fetchDeptTree, type DeptTreeNode } from "@/api/org";

const props = defineProps<{
  activityId: string;
  inviters: ConsoleSessionInviterItem[];
  /** 父级触发表刷新（切换 Tab / 点刷新） */
  refreshToken: number;
}>();

/** 表格区固定高度：表头约 40px + 10 行 × 48px */
const TABLE_FIXED_HEIGHT = 40 + 10 * 48;
const loading = ref(false);
const error = ref("");
const list = ref<ConsoleStaffDetailItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const sort = ref("inviteCount");
const order = ref<"asc" | "desc">("desc");
const deptTree = ref<DeptTreeNode[]>([]);

const draft = reactive({
  employeeId: "" as string | number,
  deptId: undefined as number | undefined,
});
const applied = reactive({ ...draft });

const SORT_PROP_TO_KEY: Record<string, string> = {
  employeeName: "employeeName",
  deptName: "deptName",
  inviteCount: "inviteCount",
  liveWatchCount: "liveWatchCount",
  avgLiveWatchDurationSec: "avgLiveWatchDuration",
  onlineCount: "onlineCount",
  commentCount: "commentCount",
};

async function loadDeptTree() {
  try {
    deptTree.value = await fetchDeptTree();
  } catch {
    deptTree.value = [];
  }
}

async function fetchList() {
  const id = props.activityId.trim();
  if (!id) {
    list.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const empId =
      applied.employeeId === "" || applied.employeeId == null
        ? undefined
        : Number(applied.employeeId);
    const res = await listConsoleStaffDetails(id, {
      page: page.value,
      pageSize: pageSize.value,
      employeeId: empId && empId > 0 ? empId : undefined,
      deptId: applied.deptId && applied.deptId > 0 ? applied.deptId : undefined,
      sort: sort.value,
      order: order.value,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? page.value;
    pageSize.value = res.pageSize ?? pageSize.value;
  } catch (e) {
    list.value = [];
    total.value = 0;
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function onQuery() {
  Object.assign(applied, { ...draft });
  page.value = 1;
  void fetchList();
}

function onReset() {
  draft.employeeId = "";
  draft.deptId = undefined;
  Object.assign(applied, { ...draft });
  page.value = 1;
  sort.value = "inviteCount";
  order.value = "desc";
  void fetchList();
}

function onSortChange(payload: { prop: string; order: string | null }) {
  const key = SORT_PROP_TO_KEY[payload.prop];
  if (!key || !payload.order) {
    sort.value = "inviteCount";
    order.value = "desc";
  } else {
    sort.value = key;
    order.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchList();
}

function onPageChange(p: number) {
  page.value = p;
  void fetchList();
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  void fetchList();
}

onMounted(() => {
  void loadDeptTree();
});

watch(
  () => [props.activityId, props.refreshToken] as const,
  () => {
    page.value = 1;
    void fetchList();
  },
  { immediate: true },
);

defineExpose({ fetchList, onRefresh: fetchList });
</script>

<template>
  <div class="staff-body">
    <div class="filters">
      <span class="filter-label">跟进人</span>
      <ElSelect
        v-model="draft.employeeId"
        clearable
        filterable
        placeholder="全部跟进人"
        style="width: 160px"
      >
        <ElOption
          label="全部跟进人"
          value=""
        />
        <ElOption
          v-for="item in inviters"
          :key="item.employeeId"
          :label="item.name"
          :value="item.employeeId"
        />
      </ElSelect>
      <span class="filter-label">所属组织架构</span>
      <ElTreeSelect
        v-model="draft.deptId"
        :data="deptTree"
        clearable
        check-strictly
        filterable
        placeholder="全部组织"
        style="width: 200px"
        :props="{ label: 'name', value: 'id', children: 'children' }"
      />
      <ElButton
        type="primary"
        @click="onQuery"
      >
        查询
      </ElButton>
      <button
        type="button"
        class="link-btn"
        @click="onReset"
      >
        重置筛选条件
      </button>
    </div>

    <p
      v-if="error"
      class="err"
    >
      {{ error }}
    </p>

    <div
      class="table-wrap hover-scrollbar"
      :style="{ height: `${TABLE_FIXED_HEIGHT}px` }"
    >
      <ElTable
        v-loading="loading"
        :data="list"
        height="100%"
        row-key="employeeId"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          prop="employeeName"
          label="跟进人"
          min-width="120"
          sortable="custom"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="deptName"
          label="所属组织架构"
          min-width="160"
          sortable="custom"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.deptName || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="inviteCount"
          min-width="120"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              邀请人数
              <ElTooltip
                content="用户通过该角色邀请链接进入直播间并绑定的用户总人数，若被邀请人为店铺员工，则不会被统计进入"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="liveWatchCount"
          min-width="140"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              直播观看人数
              <ElTooltip
                content="该员工邀请绑定的用户且直播开播过程中有过直播观看记录的总人数"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="avgLiveWatchDurationSec"
          min-width="200"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              用户直播平均观看时长
              <ElTooltip
                content="直播时，学员观看直播的人均时长；直播开始至直播结束，“浮窗、息屏、投屏”不计入统计"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">
            {{ formatDurationSec(row.avgLiveWatchDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="onlineCount"
          min-width="120"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              在线人数
              <ElTooltip
                content="该员工邀请绑定的用户当前仍处于在线观看状态"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="commentCount"
          label="用户发言次数"
          min-width="140"
          sortable="custom"
        />
      </ElTable>
    </div>

    <div class="pager">
      <span class="total">共 {{ total }} 条</span>
      <ElPagination
        background
        layout="sizes, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.staff-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 0 12px 12px;
}

.filters {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.filter-label {
  color: #666;
  font-size: 13px;
}

.link-btn {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.err {
  margin: 0;
  color: #f56c6c;
  font-size: 13px;
}

.table-wrap {
  min-width: 0;
  overflow: auto;
}

.table-wrap :deep(th.el-table__cell > .cell) {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.table-wrap :deep(th.el-table__cell .caret-wrapper) {
  flex: none;
}

.pager {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.total {
  color: #999;
  font-size: 13px;
}

.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.info-icon {
  font-size: 14px;
  color: #c0c4cc;
  cursor: help;
}
</style>
