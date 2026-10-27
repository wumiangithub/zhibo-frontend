<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElUpload,
} from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import {
  createAudience,
  downloadAudienceImportTemplate,
  formatDurationSec,
  importAudiences,
  listAudiences,
  updateAudienceEntitlement,
  type AudienceListItem,
} from "@/api/audience";
import type { ActivityId } from "@/api/activity";
import { exportAudienceRows } from "../exportAudienceRows";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{ activityId: ActivityId }>();

const loading = ref(false);
const rows = ref<AudienceListItem[]>([]);
const total = ref(0);
const selected = ref<AudienceListItem[]>([]);
const page = ref(1);
const pageSize = ref(20);
const sort = ref<string | undefined>();
const order = ref<"asc" | "desc" | undefined>();

const filters = reactive({
  nickname: "",
});

const addVisible = ref(false);
const addPhone = ref("");
const addSaving = ref(false);

async function fetchList() {
  loading.value = true;
  try {
    const res = await listAudiences(props.activityId, {
      page: page.value,
      pageSize: pageSize.value,
      nickname: filters.nickname.trim() || undefined,
      sort: sort.value,
      order: order.value,
    });
    rows.value = res.list ?? [];
    total.value = res.total ?? 0;
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
  filters.nickname = "";
  page.value = 1;
  sort.value = undefined;
  order.value = undefined;
  void fetchList();
}

function onSortChange(payload: { prop: string; order: string | null }) {
  const map: Record<string, string> = {
    stayDurationSec: "stayDuration",
    totalWatchDurationSec: "totalWatchDuration",
    liveWatchDurationSec: "liveWatchDuration",
    replayWatchDurationSec: "replayWatchDuration",
    commentCount: "commentCount",
    dealAmount: "dealAmount",
  };
  const key = map[payload.prop];
  if (!key || !payload.order) {
    sort.value = undefined;
    order.value = undefined;
  } else {
    sort.value = key;
    order.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchList();
}

function onSelectionChange(val: AudienceListItem[]) {
  selected.value = val;
}

function onExport() {
  if (!selected.value.length) {
    ElMessage.warning("请先勾选要导出的用户");
    return;
  }
  exportAudienceRows(selected.value);
}

async function submitAdd() {
  const phone = addPhone.value.trim();
  if (!phone) {
    ElMessage.warning("请输入手机号");
    return;
  }
  addSaving.value = true;
  try {
    await createAudience(props.activityId, phone);
    ElMessage.success("添加成功");
    addVisible.value = false;
    addPhone.value = "";
    await fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "添加失败");
  } finally {
    addSaving.value = false;
  }
}

async function customImport(options: UploadRequestOptions) {
  try {
    const result = await importAudiences(props.activityId, options.file as File);
    ElMessage.success(
      `导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`,
    );
    options.onSuccess?.(result as any);
    await fetchList();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导入失败";
    ElMessage.error(msg);
    options.onError?.(e as any);
  }
}

async function downloadTemplate() {
  try {
    await downloadAudienceImportTemplate();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "下载模板失败");
  }
}

async function toggleEntitlement(row: AudienceListItem) {
  const enable = row.entitlementStatus !== 1;
  const confirmMsg = enable
    ? "开启后，该用户将获得观看本场直播的权限，是否确认开启？"
    : "取消后，该用户将无法继续观看本场直播，是否确认取消？";
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
    await updateAudienceEntitlement(row.id, enable ? 1 : 0);
    ElMessage.success(enable ? "权限已开启" : "权限已取消");
    await fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <div class="user-manage">
    <div class="filters">
      <ElSelect model-value="nickname" style="width: 110px" disabled>
        <ElOption label="昵称" value="nickname" />
      </ElSelect>
      <ElInput
        v-model="filters.nickname"
        clearable
        placeholder="请输入"
        style="width: 180px"
        @keyup.enter="onSearch"
      />
      <ElSelect model-value="" placeholder="标签" style="width: 140px" disabled>
        <ElOption label="（本轮暂无）" value="" />
      </ElSelect>
      <ElButton type="primary" @click="onSearch">查询</ElButton>
      <ElButton @click="onReset">重置</ElButton>
    </div>

    <div class="toolbar">
      <UiButton variant="primary" @click="addVisible = true">+ 添加用户</UiButton>
      <ElUpload :show-file-list="false" accept=".csv,.txt" :http-request="customImport">
        <ElButton>导入</ElButton>
      </ElUpload>
      <ElButton @click="downloadTemplate">下载模板</ElButton>
      <ElButton @click="onExport">导出</ElButton>
    </div>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
    >
      <ElTableColumn type="selection" width="48" />
      <ElTableColumn label="用户" min-width="160">
        <template #default="{ row }">
          <div class="user-cell">
            <img
              v-if="row.avatarUrl"
              class="avatar"
              :src="row.avatarUrl"
              alt=""
            />
            <span v-else class="avatar avatar-ph" />
            <span>{{ row.nickname }}</span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="权益状态" width="100">
        <template #default="{ row }">
          <span class="entitlement">
            <i :class="row.entitlementStatus === 1 ? 'dot on' : 'dot off'" />
            {{ row.entitlementStatus === 1 ? "有效" : "无权益" }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="所属邀请人" min-width="140">
        <template #default="{ row }">
          <span v-if="row.inviterDisplayName">{{ row.inviterDisplayName }}</span>
          <span v-else>—</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="标签" min-width="100">
        <template #default="{ row }">
          {{ (row.tagLabels && row.tagLabels.length) ? row.tagLabels.join("、") : "—" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        prop="stayDurationSec"
        label="直播间停留时长"
        width="140"
        sortable="custom"
      >
        <template #default="{ row }">{{ formatDurationSec(row.stayDurationSec) }}</template>
      </ElTableColumn>
      <ElTableColumn
        prop="totalWatchDurationSec"
        label="累计观看时长"
        width="130"
        sortable="custom"
      >
        <template #default="{ row }">{{ formatDurationSec(row.totalWatchDurationSec) }}</template>
      </ElTableColumn>
      <ElTableColumn
        prop="liveWatchDurationSec"
        label="直播观看时长"
        width="130"
        sortable="custom"
      >
        <template #default="{ row }">{{ formatDurationSec(row.liveWatchDurationSec) }}</template>
      </ElTableColumn>
      <ElTableColumn
        prop="replayWatchDurationSec"
        label="回放观看时长"
        width="130"
        sortable="custom"
      >
        <template #default="{ row }">{{ formatDurationSec(row.replayWatchDurationSec) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="commentCount" label="评论次数" width="100" sortable="custom" />
      <ElTableColumn prop="dealAmount" label="直播间成交金额(元)" width="150" sortable="custom">
        <template #default="{ row }">{{ row.dealAmount || "0.00" }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <button type="button" class="link-btn" @click="toggleEntitlement(row)">
            {{ row.entitlementStatus === 1 ? "取消观看权限" : "开启观看权限" }}
          </button>
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

    <ElDialog v-model="addVisible" title="添加用户" width="420px" destroy-on-close>
      <ElForm label-width="80px" @submit.prevent="submitAdd">
        <ElFormItem label="手机号">
          <ElInput v-model="addPhone" placeholder="观众已绑定的手机号" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="addVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="addSaving" @click="submitAdd">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.user-manage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filters,
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-ph {
  background: #e5e7eb;
  display: inline-block;
}
.entitlement {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot.on {
  background: #22c55e;
}
.dot.off {
  background: #9ca3af;
}
.link-btn {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.pager {
  display: flex;
  justify-content: flex-end;
}
</style>
