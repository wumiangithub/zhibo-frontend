<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ElDatePicker,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
} from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import {
  listLiveReports,
  REPORT_STATUS_LABEL,
  type LiveReport,
  type ReportStatus,
} from "@/api/liveReport";
import ReportAuditDrawer from "./ReportAuditDrawer.vue";

const router = useRouter();
const loading = ref(false);
const error = ref("");
const rows = ref<LiveReport[]>([]);
const total = ref(0);
const auditDrawerVisible = ref(false);
const auditDrawerId = ref("");
const auditDrawerTitle = ref("");
const auditDrawerCover = ref("");
const q = reactive({
  title: "",
  hostName: "",
  status: "",
  range: [] as string[],
  page: 1,
  pageSize: 10,
});

function fmtTimes(r: LiveReport) {
  return r.planTimes.map((x) => `${x.startTime} 至 ${x.endTime}`).join("；");
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const d = await listLiveReports({
      page: q.page,
      pageSize: q.pageSize,
      title: q.title || undefined,
      hostName: q.hostName || undefined,
      status: q.status || undefined,
      startFrom: q.range?.[0],
      startTo: q.range?.[1],
    });
    rows.value = d.list;
    total.value = d.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function search() {
  q.page = 1;
  void load();
}

function reset() {
  Object.assign(q, { title: "", hostName: "", status: "", range: [], page: 1 });
  void load();
}

function canEdit(r: LiveReport) {
  return r.status === "rejected" || (r.status === "passed" && r.boundLiveCount === 0);
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

function onMoreCommand(command: string, row: LiveReport) {
  if (command === "audit" && canAudit(row)) {
    void router.push(`/live-reports/${row.id}/audit`);
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="crumb">直播 / 直播报备</div>
    <div class="filters card">
      <label>
        报备名称
        <ElInput v-model="q.title" placeholder="请输入报备名称" clearable />
      </label>
      <label>
        主播姓名
        <ElInput v-model="q.hostName" placeholder="请输入主播姓名" clearable />
      </label>
      <label>
        审核状态
        <ElSelect v-model="q.status" placeholder="全部状态" clearable>
          <ElOption v-for="(v, k) in REPORT_STATUS_LABEL" :key="k" :label="v" :value="k" />
        </ElSelect>
      </label>
      <label>
        计划时间
        <ElDatePicker
          v-model="q.range"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </label>
      <UiButton @click="reset">重置</UiButton>
      <UiButton variant="primary" @click="search">查询</UiButton>
    </div>
    <div class="card table-card">
      <UiButton variant="primary" @click="router.push('/live-reports/new')">+ 新建直播报备</UiButton>
      <p v-if="error" class="err">{{ error }}</p>
      <el-table v-loading="loading" :data="rows" class="table">
        <el-table-column prop="id" label="报备ID" width="250" />
        <el-table-column label="报备直播名称" min-width="250">
          <template #default="{ row }">
            <div class="name">
              <img :src="row.coverUrl" alt="" />
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="host.userName" label="主播" width="110" />
        <el-table-column label="计划时间" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ fmtTimes(row) }}</template>
        </el-table-column>
        <el-table-column label="审核状态" width="100">
          <template #default="{ row }">
            <span class="status" :class="row.status">
              {{ REPORT_STATUS_LABEL[row.status as ReportStatus] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <UiButton variant="link" @click="router.push(`/live-reports/${row.id}`)">查看</UiButton>
              <UiButton
                variant="link"
                :disabled="!canEdit(row)"
                @click="router.push(`/live-reports/${row.id}/edit`)"
              >
                编辑
              </UiButton>
              <UiButton variant="link" @click="openAuditRecords(row)">
                审核记录
              </UiButton>
              <ElDropdown trigger="click" @command="(command: string) => onMoreCommand(command, row)">
                <button type="button" class="op-more">···</button>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem command="audit" :disabled="!canAudit(row)">
                      去审核
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <ElPagination
        v-model:current-page="q.page"
        v-model:page-size="q.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @change="load"
      />
    </div>
    <ReportAuditDrawer
      v-model="auditDrawerVisible"
      :report-id="auditDrawerId"
      :title="auditDrawerTitle"
      :cover-url="auditDrawerCover"
    />
  </div>
</template>

<style scoped>
.page {
  min-width: 900px;
}
.crumb {
  margin-bottom: 12px;
  color: #666;
  font-size: 13px;
}
.card {
  background: #fff;
  border-radius: 6px;
}
.filters {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 16px;
  flex-wrap: wrap;
}
.filters label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  white-space: nowrap;
}
.filters .el-input,
.filters .el-select {
  width: 170px;
}
.table-card {
  margin-top: 12px;
  padding: 16px;
}
.table {
  margin-top: 14px;
}
.name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name img {
  width: 72px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
}
.status {
  padding: 2px 6px;
  border-radius: 2px;
  background: #f5f5f5;
}
.status.passed {
  color: #389e0d;
  background: #f6ffed;
}
.status.rejected {
  color: #cf1322;
  background: #fff1f0;
}
.ops {
  display: flex;
  align-items: center;
  gap: 4px;
}
.op-more {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  line-height: 1;
}
.err {
  color: var(--color-danger);
}
.el-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
