<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, reactive, watch } from "vue";
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTooltip,
} from "element-plus";
import type { TableInstance } from "element-plus";
import { Close, InfoFilled } from "@element-plus/icons-vue";
import {
  createAudience,
  downloadAudienceImportFailures,
  downloadAudienceImportTemplate,
  exportAudiences,
  formatDurationSec,
  importAudiences,
  listAudienceImports,
  listAudiences,
  updateAudienceEntitlement,
  type AudienceDurationOp,
  type AudienceImportHistoryItem,
  type AudienceKeywordType,
  type AudienceListItem,
  type AudienceTagMatch,
} from "@/api/audience";
import type { ActivityId } from "@/api/activity";
import { listViewerTags, type ViewerTagItem } from "@/api/viewerTag";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{ activityId: ActivityId }>();

const loading = ref(false);
const rows = ref<AudienceListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const sort = ref<string | undefined>();
const order = ref<"asc" | "desc" | undefined>();

const filters = reactive({
  keywordType: "nickname" as AudienceKeywordType,
  keyword: "",
  tagMatch: "any" as AudienceTagMatch,
  tagIds: [] as number[],
  totalWatchOp: "gte" as AudienceDurationOp,
  totalWatchMin: "",
  totalWatchSec: "",
  liveWatchOp: "gte" as AudienceDurationOp,
  liveWatchMin: "",
  liveWatchSec: "",
});

const keywordPlaceholder: Record<AudienceKeywordType, string> = {
  nickname: "请输入用户昵称",
  id: "请输入用户ID",
  phone: "请输入手机号",
};

/** 筛选用：全部未软删标签 */
const filterTags = ref<ViewerTagItem[]>([]);

/** 分：仅保留数字（非负整数，可空） */
function onDurationMinInput(
  key: "totalWatchMin" | "liveWatchMin",
  raw: string,
) {
  filters[key] = String(raw ?? "").replace(/\D/g, "");
}

/** 秒：仅数字，且钳制到 0～59（可空） */
function onDurationSecInput(
  key: "totalWatchSec" | "liveWatchSec",
  raw: string,
) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) {
    filters[key] = "";
    return;
  }
  filters[key] = String(Math.min(Number(digits), 59));
}

/** 分+秒 → 总秒；两边都空则不过滤。秒须 0～59；输入须为非负整数。 */
function parseDurationFilter(
  label: string,
  minRaw: string,
  secRaw: string,
): { ok: true; sec?: number } | { ok: false; message: string } {
  const minTrim = minRaw.trim();
  const secTrim = secRaw.trim();
  if (!minTrim && !secTrim) {
    return { ok: true };
  }
  const minPart = minTrim || "0";
  const secPart = secTrim || "0";
  if (!/^\d+$/.test(minPart) || !/^\d+$/.test(secPart)) {
    return { ok: false, message: `${label}须为数字` };
  }
  const minutes = Number(minPart);
  const seconds = Number(secPart);
  if (seconds > 59) {
    return { ok: false, message: `${label}的秒须为 0～59` };
  }
  return { ok: true, sec: minutes * 60 + seconds };
}

async function fetchList() {
  const totalParsed = parseDurationFilter(
    "累计观看时长",
    filters.totalWatchMin,
    filters.totalWatchSec,
  );
  if (!totalParsed.ok) {
    ElMessage.warning(totalParsed.message);
    return;
  }
  const liveParsed = parseDurationFilter("直播观看时长", filters.liveWatchMin, filters.liveWatchSec);
  if (!liveParsed.ok) {
    ElMessage.warning(liveParsed.message);
    return;
  }

  loading.value = true;
  try {
    const res = await listAudiences(props.activityId, {
      page: page.value,
      pageSize: pageSize.value,
      keywordType: filters.keywordType,
      keyword: filters.keyword.trim() || undefined,
      tagMatch: filters.tagMatch,
      tagIds: filters.tagIds.length ? [...filters.tagIds] : undefined,
      totalWatchDurationOp: totalParsed.sec !== undefined ? filters.totalWatchOp : undefined,
      totalWatchDurationSec: totalParsed.sec,
      liveWatchDurationOp: liveParsed.sec !== undefined ? filters.liveWatchOp : undefined,
      liveWatchDurationSec: liveParsed.sec,
      sort: sort.value,
      order: order.value,
    });
    rows.value = (res.list ?? []).map((row) => ({
      ...row,
      tagIds: row.tagIds ?? [],
      tagLabels: row.tagLabels ?? [],
    }));
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
  filters.keywordType = "nickname";
  filters.keyword = "";
  filters.tagMatch = "any";
  filters.tagIds = [];
  filters.totalWatchOp = "gte";
  filters.totalWatchMin = "";
  filters.totalWatchSec = "";
  filters.liveWatchOp = "gte";
  filters.liveWatchMin = "";
  filters.liveWatchSec = "";
  page.value = 1;
  sort.value = undefined;
  order.value = undefined;
  void fetchList();
}

function onPageSizeChange() {
  page.value = 1;
  void fetchList();
}

async function loadFilterTags() {
  try {
    const res = await listViewerTags({ page: 1, pageSize: 100 });
    filterTags.value = res.list ?? [];
  } catch {
    filterTags.value = [];
  }
}

function onSortChange(payload: { prop: string; order: string | null }) {
  const map: Record<string, string> = {
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

const addVisible = ref(false);
const addTab = ref<"single" | "bulk" | "tag">("single");
const addMethod = ref<"phone" | "viewerId">("phone");
const addPhone = ref("");
const addPhoneCode = ref("+86");
const addViewerId = ref("");
const addSaving = ref(false);

const PHONE_CODE_OPTIONS = [{ label: "+86 中国", value: "+86" }] as const;

/** 全屏：根节点加 class，不用 ElDialog / 双挂载 */
const isFullscreen = ref(false);
const tableRef = ref<TableInstance>();

async function relayoutTable() {
  await nextTick();
  tableRef.value?.doLayout();
}

function exitFullscreen() {
  if (!isFullscreen.value) return;
  isFullscreen.value = false;
}

function toggleFullscreen(e?: MouseEvent) {
  isFullscreen.value = !isFullscreen.value;
  // 点击后去掉 ElButton :focus 蓝晕，与旁侧「导出」一致
  (e?.currentTarget as HTMLElement | null)?.blur();
}

function onFullscreenKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    exitFullscreen();
  }
}

watch(isFullscreen, (on) => {
  if (on) {
    document.addEventListener("keydown", onFullscreenKeydown);
  } else {
    document.removeEventListener("keydown", onFullscreenKeydown);
  }
  void relayoutTable();
});

function resetAddForm() {
  addTab.value = "single";
  addMethod.value = "phone";
  addPhone.value = "";
  addPhoneCode.value = "+86";
  addViewerId.value = "";
}

function openAdd() {
  resetAddForm();
  addVisible.value = true;
}

function onAddMethodChange() {
  addPhone.value = "";
  addViewerId.value = "";
}

async function submitAdd() {
  if (addTab.value !== "single") return;

  let body: { phone: string } | { viewerId: number };
  if (addMethod.value === "phone") {
    const phone = addPhone.value.trim().replace(/\D/g, "");
    if (!phone) {
      ElMessage.warning("请输入学员手机号");
      return;
    }
    body = { phone };
  } else {
    const raw = addViewerId.value.trim();
    if (!raw) {
      ElMessage.warning("请输入学员用户ID");
      return;
    }
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      ElMessage.warning("用户ID须为正整数");
      return;
    }
    body = { viewerId: Number(raw) };
  }

  addSaving.value = true;
  try {
    const result = await createAudience(props.activityId, body);
    if (result.created) {
      ElMessage.success("添加成功");
      // 不关弹窗，便于连续添加；清空当前输入
      addPhone.value = "";
      addViewerId.value = "";
    } else {
      ElMessage.warning("该用户已存在");
    }
    await fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "添加失败");
  } finally {
    addSaving.value = false;
  }
}

const exporting = ref(false);
const csvInput = ref<HTMLInputElement | null>(null);
const importHistory = ref<AudienceImportHistoryItem[]>([]);
const importHistoryLoading = ref(false);
const bulkImporting = ref(false);

const UPLOAD_NOTICE =
  "文本当前仅支持CSV格式文件，请使用Office2010或以上版本，否则可能会出现乱码。必须严格按照模板内容填写数据，否则可能会出现导入异常。";

watch([addVisible, addTab], ([visible, tab]) => {
  if (visible && tab === "bulk") {
    void fetchImportHistory();
  }
});

async function fetchImportHistory() {
  importHistoryLoading.value = true;
  try {
    const res = await listAudienceImports(props.activityId);
    importHistory.value = res.list ?? [];
  } catch (e) {
    importHistory.value = [];
    ElMessage.error(e instanceof Error ? e.message : "加载导入记录失败");
  } finally {
    importHistoryLoading.value = false;
  }
}

function currentFilterQuery() {
  const totalParsed = parseDurationFilter(
    "累计观看时长",
    filters.totalWatchMin,
    filters.totalWatchSec,
  );
  if (!totalParsed.ok) {
    return { ok: false as const, message: totalParsed.message };
  }
  const liveParsed = parseDurationFilter("直播观看时长", filters.liveWatchMin, filters.liveWatchSec);
  if (!liveParsed.ok) {
    return { ok: false as const, message: liveParsed.message };
  }
  return {
    ok: true as const,
    params: {
      keywordType: filters.keywordType,
      keyword: filters.keyword.trim() || undefined,
      tagMatch: filters.tagMatch,
      tagIds: filters.tagIds.length ? [...filters.tagIds] : undefined,
      totalWatchDurationOp: totalParsed.sec !== undefined ? filters.totalWatchOp : undefined,
      totalWatchDurationSec: totalParsed.sec,
      liveWatchDurationOp: liveParsed.sec !== undefined ? filters.liveWatchOp : undefined,
      liveWatchDurationSec: liveParsed.sec,
      sort: sort.value,
      order: order.value,
    },
  };
}

async function onExport() {
  const parsed = currentFilterQuery();
  if (!parsed.ok) {
    ElMessage.warning(parsed.message);
    return;
  }
  exporting.value = true;
  try {
    await exportAudiences(props.activityId, parsed.params);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function pickCsv() {
  csvInput.value?.click();
}

async function onCsvPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!/\.(csv|txt)$/i.test(file.name)) {
    ElMessage.warning("请选择 CSV 文件");
    return;
  }
  bulkImporting.value = true;
  try {
    const result = await importAudiences(props.activityId, file);
    ElMessage.success(
      `导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`,
    );
    await Promise.all([fetchList(), fetchImportHistory()]);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "导入失败");
  } finally {
    bulkImporting.value = false;
  }
}

async function onDownloadTemplate() {
  try {
    await downloadAudienceImportTemplate();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "下载模板失败");
  }
}

async function onDownloadFailures(row: AudienceImportHistoryItem) {
  try {
    await downloadAudienceImportFailures(row.id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "下载失败明细失败");
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
  void loadFilterTags();
  void fetchList();
});

onUnmounted(() => {
  document.removeEventListener("keydown", onFullscreenKeydown);
});
</script>

<template>
  <div
    class="user-manage"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <header
      v-if="isFullscreen"
      class="fs-header"
    >
      <span class="fs-title">用户运营</span>
      <button
        type="button"
        class="fs-close"
        aria-label="关闭"
        @click="exitFullscreen"
      >
        <ElIcon :size="16">
          <Close />
        </ElIcon>
      </button>
    </header>

    <div class="user-manage-body">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">用户</span>
        <ElSelect
          v-model="filters.keywordType"
          style="width: 110px"
        >
          <ElOption
            label="昵称"
            value="nickname"
          />
          <ElOption
            label="用户ID"
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
        <span class="filter-label">标签</span>
        <ElSelect
          v-model="filters.tagMatch"
          style="width: 110px"
        >
          <ElOption
            label="满足其一"
            value="any"
          />
          <ElOption
            label="不包含"
            value="none"
          />
          <ElOption
            label="同时满足"
            value="all"
          />
        </ElSelect>
        <ElSelect
          v-model="filters.tagIds"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择"
          style="width: 200px"
        >
          <ElOption
            v-for="t in filterTags"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </ElSelect>
      </div>
      <div class="filter-item">
        <span class="filter-label">累计观看时长</span>
        <ElSelect
          v-model="filters.totalWatchOp"
          style="width: 110px"
        >
          <ElOption
            label="大于等于"
            value="gte"
          />
          <ElOption
            label="小于等于"
            value="lte"
          />
        </ElSelect>
        <ElInput
          :model-value="filters.totalWatchMin"
          class="duration-unit-input"
          inputmode="numeric"
          @update:model-value="onDurationMinInput('totalWatchMin', $event)"
          @keyup.enter="onSearch"
        >
          <template #append>分</template>
        </ElInput>
        <ElInput
          :model-value="filters.totalWatchSec"
          class="duration-unit-input"
          inputmode="numeric"
          @update:model-value="onDurationSecInput('totalWatchSec', $event)"
          @keyup.enter="onSearch"
        >
          <template #append>秒</template>
        </ElInput>
      </div>
      <div class="filter-item">
        <span class="filter-label">直播观看时长</span>
        <ElSelect
          v-model="filters.liveWatchOp"
          style="width: 110px"
        >
          <ElOption
            label="大于等于"
            value="gte"
          />
          <ElOption
            label="小于等于"
            value="lte"
          />
        </ElSelect>
        <ElInput
          :model-value="filters.liveWatchMin"
          class="duration-unit-input"
          inputmode="numeric"
          @update:model-value="onDurationMinInput('liveWatchMin', $event)"
          @keyup.enter="onSearch"
        >
          <template #append>分</template>
        </ElInput>
        <ElInput
          :model-value="filters.liveWatchSec"
          class="duration-unit-input"
          inputmode="numeric"
          @update:model-value="onDurationSecInput('liveWatchSec', $event)"
          @keyup.enter="onSearch"
        >
          <template #append>秒</template>
        </ElInput>
      </div>
      <ElButton @click="onReset">重置</ElButton>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <div class="toolbar">
      <UiButton
        variant="primary"
        @click="openAdd"
      >
        + 添加用户
      </UiButton>
      <ElButton
        :loading="exporting"
        @click="onExport"
      >
        导出
      </ElButton>
      <ElButton @click="toggleFullscreen($event)">
        {{ isFullscreen ? "退出全屏" : "全屏" }}
      </ElButton>
    </div>

    <div class="table-wrap">
      <ElTable
        ref="tableRef"
        v-loading="loading"
        :data="rows"
        row-key="id"
        height="100%"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          label="用户"
          min-width="160"
        >
          <template #default="{ row }">
            <div class="user-cell">
              <img
                v-if="row.avatarUrl"
                class="avatar"
                :src="row.avatarUrl"
                alt=""
              >
              <span
                v-else
                class="avatar avatar-ph"
              />
              <span>{{ row.nickname }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="权益状态"
          width="100"
        >
          <template #default="{ row }">
            <span class="entitlement">
              <i :class="row.entitlementStatus === 1 ? 'dot on' : 'dot off'" />
              {{ row.entitlementStatus === 1 ? "有效" : "无权益" }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="所属邀请人"
          min-width="140"
        >
          <template #default="{ row }">
            <span v-if="row.inviterDisplayName">{{ row.inviterDisplayName }}</span>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="导入人"
          min-width="120"
        >
          <template #default="{ row }">
            <span v-if="row.importerName">{{ row.importerName }}</span>
            <span v-else>—</span>
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
                  :key="`${row.id}-${row.tagIds?.[idx] ?? idx}`"
                  class="tag-pill"
                >{{ label }}</span>
              </div>
            </ElTooltip>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="totalWatchDurationSec"
          width="168"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              累计观看时长
              <ElTooltip
                content="用户观看直播的时长，播放时计算。统计直播中 + 直播回放，开播前不算。"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">{{ formatDurationSec(row.totalWatchDurationSec) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="liveWatchDurationSec"
          width="168"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              直播观看时长
              <ElTooltip
                content="用户观看直播的时长，播放时计算。只统计直播中，不包括开播前和回放。"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">{{ formatDurationSec(row.liveWatchDurationSec) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="replayWatchDurationSec"
          width="168"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              回放观看时长
              <ElTooltip
                content="用户观看直播的时长，播放时计算。只统计回放。"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">{{ formatDurationSec(row.replayWatchDurationSec) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="commentCount"
          label="评论次数"
          width="120"
          sortable="custom"
        />
        <ElTableColumn
          prop="dealAmount"
          label="直播间成交金额(元)"
          width="180"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.dealAmount || "0.00" }}</template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="130"
          fixed="right"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="link-btn"
              @click="toggleEntitlement(row)"
            >
              {{ row.entitlementStatus === 1 ? "取消观看权限" : "开启观看权限" }}
            </button>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchList"
        @size-change="onPageSizeChange"
      />
    </div>

    <ElDialog
      v-model="addVisible"
      title="添加用户"
      :width="addTab === 'bulk' ? '760px' : '560px'"
      append-to-body
      destroy-on-close
      class="add-audience-dialog"
    >
      <ElTabs
        v-model="addTab"
        class="add-tabs"
      >
        <ElTabPane
          label="单个添加"
          name="single"
        >
          <ElForm
            label-width="96px"
            @submit.prevent="submitAdd"
          >
            <ElFormItem
              label="添加方式"
              required
            >
              <ElRadioGroup
                v-model="addMethod"
                @change="onAddMethodChange"
              >
                <ElRadio value="phone">手机号</ElRadio>
                <ElRadio value="viewerId">用户ID</ElRadio>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem
              label="学员"
              required
            >
              <ElInput
                v-if="addMethod === 'phone'"
                v-model="addPhone"
                placeholder="请输入学员手机号"
                maxlength="20"
              >
                <template #prepend>
                  <ElSelect
                    v-model="addPhoneCode"
                    style="width: 110px"
                  >
                    <ElOption
                      v-for="opt in PHONE_CODE_OPTIONS"
                      :key="opt.value"
                      :label="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </ElOption>
                  </ElSelect>
                </template>
              </ElInput>
              <ElInput
                v-else
                v-model="addViewerId"
                placeholder="请输入学员用户ID"
                maxlength="20"
              />
            </ElFormItem>
          </ElForm>
        </ElTabPane>
        <ElTabPane
          label="批量导入"
          name="bulk"
        >
          <div class="bulk-toolbar">
            <input
              ref="csvInput"
              type="file"
              accept=".csv,.txt"
              class="csv-input"
              @change="onCsvPicked"
            >
            <ElButton
              type="primary"
              :loading="bulkImporting"
              @click="pickCsv"
            >
              + 批量导入
            </ElButton>
            <button
              type="button"
              class="link-btn"
              @click="onDownloadTemplate"
            >
              下载模板
            </button>
            <span class="upload-notice">
              上传须知
              <ElTooltip
                placement="top"
                :show-after="200"
              >
                <template #content>
                  <div class="upload-notice-tip">{{ UPLOAD_NOTICE }}</div>
                </template>
                <ElIcon class="info-icon">
                  <InfoFilled />
                </ElIcon>
              </ElTooltip>
            </span>
          </div>
          <ElTable
            v-loading="importHistoryLoading"
            :data="importHistory"
            row-key="id"
            max-height="360"
          >
            <ElTableColumn
              prop="importTime"
              label="导入时间"
              min-width="170"
            />
            <ElTableColumn
              label="导入人"
              min-width="120"
            >
              <template #default="{ row }">{{ row.importerName || "—" }}</template>
            </ElTableColumn>
            <ElTableColumn
              label="成功数"
              width="90"
            >
              <template #default="{ row }">
                <span class="success-count">{{ row.successCount }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="失败数"
              width="90"
            >
              <template #default="{ row }">
                <span :class="{ 'fail-count': row.failCount > 0 }">{{ row.failCount }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="操作"
              width="130"
              fixed="right"
            >
              <template #default="{ row }">
                <button
                  type="button"
                  class="link-btn"
                  @click="onDownloadFailures(row)"
                >
                  下载失败明细
                </button>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane
          label="标签导入"
          name="tag"
        >
          <p class="add-tab-placeholder">标签导入即将支持</p>
        </ElTabPane>
      </ElTabs>
      <template #footer>
        <template v-if="addTab === 'single'">
          <ElButton @click="addVisible = false">取消</ElButton>
          <ElButton
            type="primary"
            :loading="addSaving"
            @click="submitAdd"
          >
            确定
          </ElButton>
        </template>
        <ElButton
          v-else
          @click="addVisible = false"
        >
          关闭
        </ElButton>
      </template>
    </ElDialog>
    </div>
  </div>
</template>

<style scoped>
.user-manage {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  height: 100%;
}
.user-manage-body {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}
.user-manage.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  width: 100vw;
  height: 100vh;
  background: #fff;
}
.user-manage.is-fullscreen .user-manage-body {
  padding: 16px 20px;
}
.fs-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 54px;
  padding: 0 20px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}
.fs-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--el-text-color-primary, #303133);
}
.fs-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-color-info, #909399);
  cursor: pointer;
  outline: none;
}
.fs-close:hover {
  color: var(--el-color-primary, #409eff);
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
.duration-unit-input {
  width: 120px;
}
.toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
}
.table-wrap :deep(.el-table th.el-table__cell > .cell) {
  white-space: nowrap;
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
  flex: none;
  justify-content: flex-end;
}
.add-tab-placeholder {
  margin: 24px 0 8px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;
  text-align: center;
}
.add-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}
.bulk-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}
.csv-input {
  display: none;
}
.upload-notice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
}
.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
.success-count {
  color: #22c55e;
}
.fail-count {
  color: #f56c6c;
}
.upload-notice-tip {
  max-width: 320px;
  line-height: 1.6;
  font-size: 12px;
}
</style>
