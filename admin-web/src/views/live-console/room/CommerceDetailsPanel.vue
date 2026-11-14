<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Lock, Unlock, InfoFilled } from "@element-plus/icons-vue";
import {
  exportConsoleCommerceDetails,
  listConsoleCommerceDetails,
  type AudienceDetailKeywordType,
  type CommercePayStatusFilter,
  type ConsoleCommerceDetailItem,
  type ConsoleSessionInviterItem,
} from "./api/console";
import { appendViewerTags, getViewerPhonePlain } from "@/api/viewer";
import { listViewerTags, ViewerTagType, type ViewerTagItem } from "@/api/viewerTag";
import { nicknameInitial } from "./utils/nicknameInitial";
import UserKeywordCombo from "@/components/UserKeywordCombo.vue";

const props = defineProps<{
  activityId: string;
  inviters: ConsoleSessionInviterItem[];
  /** 父级触发表刷新（切换 Tab / 点刷新） */
  refreshToken: number;
}>();

/** 表格区固定高度：表头约 40px + 10 行 × 48px */
const TABLE_FIXED_HEIGHT = 40 + 10 * 48;
const loading = ref(false);
const exporting = ref(false);
const error = ref("");
const list = ref<ConsoleCommerceDetailItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const sort = ref("orderCount");
const order = ref<"asc" | "desc">("desc");
const selected = ref<ConsoleCommerceDetailItem[]>([]);
const revealedPhones = reactive<Record<string, string>>({});
const revealing = reactive<Record<string, boolean>>({});

const draft = reactive({
  productName: "",
  payStatus: "all" as CommercePayStatusFilter,
  followerEmployeeId: "" as string | number,
  keywordType: "nickname" as AudienceDetailKeywordType,
  keyword: "",
});
const applied = reactive({ ...draft });

const tagDialogVisible = ref(false);
const tagSaving = ref(false);
const tagDraftIds = ref<number[]>([]);
const manualTags = ref<ViewerTagItem[]>([]);
const selectedUserCount = computed(
  () => new Set(selected.value.map((r) => r.username)).size,
);

const SORT_PROP_TO_KEY: Record<string, string> = {
  clickCount: "clickCount",
  lastClickTime: "lastClickTime",
  orderCount: "orderCount",
  unpaidCount: "unpaidCount",
  paidSuccessCount: "paidSuccessCount",
  liveDealAmount: "liveDealAmount",
  totalPaidOrderCount: "totalPaidOrderCount",
  totalPaidAmount: "totalPaidAmount",
  productName: "productName",
  payStatus: "payStatus",
};

function rowKey(row: ConsoleCommerceDetailItem) {
  return `${row.username}\0${row.spuId}`;
}

function payStatusLabel(code: string) {
  if (code === "paid") return "已支付";
  if (code === "refunded") return "已退款";
  return "未支付";
}

function payStatusClass(code: string) {
  if (code === "paid") return "is-paid";
  if (code === "refunded") return "is-refunded";
  return "is-unpaid";
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
    const followerId =
      applied.followerEmployeeId === "" || applied.followerEmployeeId == null
        ? undefined
        : Number(applied.followerEmployeeId);
    const res = await listConsoleCommerceDetails(id, {
      page: page.value,
      pageSize: pageSize.value,
      productName: applied.productName.trim() || undefined,
      payStatus: applied.payStatus,
      followerEmployeeId: followerId && followerId > 0 ? followerId : undefined,
      keywordType: applied.keywordType,
      keyword: applied.keyword.trim() || undefined,
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
  draft.productName = "";
  draft.payStatus = "all";
  draft.followerEmployeeId = "";
  draft.keywordType = "nickname";
  draft.keyword = "";
  Object.assign(applied, { ...draft });
  page.value = 1;
  sort.value = "orderCount";
  order.value = "desc";
  void fetchList();
}

async function onExport() {
  const id = props.activityId.trim();
  if (!id) return;
  exporting.value = true;
  try {
    const followerId =
      applied.followerEmployeeId === "" || applied.followerEmployeeId == null
        ? undefined
        : Number(applied.followerEmployeeId);
    await exportConsoleCommerceDetails(id, {
      productName: applied.productName.trim() || undefined,
      payStatus: applied.payStatus,
      followerEmployeeId: followerId && followerId > 0 ? followerId : undefined,
      keywordType: applied.keywordType,
      keyword: applied.keyword.trim() || undefined,
      sort: sort.value,
      order: order.value,
    });
    ElMessage.success("已开始下载");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function onSortChange(payload: { prop: string; order: string | null }) {
  const key = SORT_PROP_TO_KEY[payload.prop];
  if (!key || !payload.order) {
    sort.value = "orderCount";
    order.value = "desc";
  } else {
    sort.value = key;
    order.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchList();
}

function onSelectionChange(rows: ConsoleCommerceDetailItem[]) {
  selected.value = rows;
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

async function togglePhone(row: ConsoleCommerceDetailItem) {
  if (revealedPhones[row.username]) {
    delete revealedPhones[row.username];
    return;
  }
  if (!row.phoneMasked) {
    ElMessage.warning("未绑定手机号");
    return;
  }
  if (revealing[row.username]) return;
  revealing[row.username] = true;
  try {
    const res = await getViewerPhonePlain(row.username);
    revealedPhones[row.username] = res.phone;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取手机号失败");
  } finally {
    revealing[row.username] = false;
  }
}

async function ensureManualTags() {
  if (manualTags.value.length) return;
  const res = await listViewerTags({ page: 1, pageSize: 100, type: ViewerTagType.MANUAL });
  manualTags.value = res.list ?? [];
}

async function openTagDialog() {
  if (!selected.value.length) {
    ElMessage.warning("请先勾选用户");
    return;
  }
  tagDraftIds.value = [];
  tagDialogVisible.value = true;
  try {
    await ensureManualTags();
  } catch (e) {
    tagDialogVisible.value = false;
    ElMessage.error(e instanceof Error ? e.message : "加载标签失败");
  }
}

async function confirmTags() {
  if (!tagDraftIds.value.length) {
    ElMessage.warning("请选择标签");
    return;
  }
  tagSaving.value = true;
  try {
    const usernames = [...new Set(selected.value.map((r) => r.username))];
    const res = await appendViewerTags(usernames, [...tagDraftIds.value]);
    ElMessage.success(`已为 ${res.updated} 名用户追加标签`);
    tagDialogVisible.value = false;
    tagDraftIds.value = [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "贴标签失败");
  } finally {
    tagSaving.value = false;
  }
}

function avatarBroken(row: ConsoleCommerceDetailItem) {
  row.avatarUrl = undefined;
}

watch(
  () => [props.activityId, props.refreshToken] as const,
  () => {
    page.value = 1;
    selected.value = [];
    Object.keys(revealedPhones).forEach((k) => delete revealedPhones[k]);
    void fetchList();
  },
  { immediate: true },
);

defineExpose({ fetchList, onRefresh: fetchList });
</script>

<template>
  <div class="commerce-body">
    <div class="filters">
      <ElInput
        v-model="draft.productName"
        clearable
        placeholder="商品名称"
        style="width: 160px"
        @keyup.enter="onQuery"
      />
      <span class="filter-label">支付状态</span>
      <ElSelect
        v-model="draft.payStatus"
        style="width: 110px"
      >
        <ElOption
          label="全部"
          value="all"
        />
        <ElOption
          label="未支付"
          value="unpaid"
        />
        <ElOption
          label="已支付"
          value="paid"
        />
        <ElOption
          label="已退款"
          value="refunded"
        />
      </ElSelect>
      <span class="filter-label">跟进人</span>
      <ElSelect
        v-model="draft.followerEmployeeId"
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
      <UserKeywordCombo
        v-model:keyword-type="draft.keywordType"
        v-model:keyword="draft.keyword"
        width="260px"
        type-width="100px"
        @enter="onQuery"
      />
      <ElButton
        type="primary"
        @click="onQuery"
      >
        查询
      </ElButton>
      <ElButton
        :loading="exporting"
        @click="onExport"
      >
        导出
      </ElButton>
      <button
        type="button"
        class="link-btn"
        @click="onReset"
      >
        重置筛选条件
      </button>
    </div>

    <div class="batch">
      <span>已选 {{ selected.length }} 行</span>
      <ElButton
        size="small"
        @click="openTagDialog"
      >
        贴标签
      </ElButton>
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
        :row-key="rowKey"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          type="selection"
          width="42"
          fixed
        />
        <ElTableColumn
          label="用户"
          min-width="140"
          fixed
        >
          <template #default="{ row }">
            <div class="user-cell">
              <img
                v-if="row.avatarUrl"
                class="avatar"
                :src="row.avatarUrl"
                alt=""
                @error="avatarBroken(row)"
              >
              <span
                v-else
                class="avatar is-fallback"
              >{{ nicknameInitial(row.nickname) }}</span>
              <span class="nick">{{ row.nickname || "—" }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="username"
          label="用户ID"
          min-width="140"
          show-overflow-tooltip
        />
        <ElTableColumn
          label="union ID"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.unionid || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="productName"
          label="商品名称"
          min-width="160"
          sortable="custom"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="clickCount"
          label="点击次数"
          min-width="112"
          sortable="custom"
        />
        <ElTableColumn
          prop="lastClickTime"
          label="最近点击"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.lastClickTime || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="orderCount"
          min-width="124"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              下单次数
              <ElTooltip
                content="对于该商品用户在直播间的下单次数"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="unpaidCount"
          min-width="148"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              未支付订单数
              <ElTooltip
                content="本场直播中用户下单未支付的订单数"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="paidSuccessCount"
          min-width="160"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              支付成功订单数
              <ElTooltip
                content="本场直播用户下单成功支付的订单数"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="payStatus"
          min-width="124"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              支付状态
              <ElTooltip
                content="用户对于该商品是否有成功支付订单，有支付订单则支付状态为已支付"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">
            <span
              class="pay-tag"
              :class="payStatusClass(row.payStatus)"
            >{{ payStatusLabel(row.payStatus) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="liveDealAmount"
          min-width="160"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              直播间成交金额
              <ElTooltip
                content="用户该直播间对该商品支付的总金额，不剔除退款订单（说明：仅计算在直播内当页支付的商品，如跳出直播间购买了该商品则不算）"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">
            {{ row.liveDealAmount }}元
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="totalPaidOrderCount"
          min-width="160"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              店铺总支付订单
              <ElTooltip
                content="用户针对该商品产生的所有成功支付订单数，不剔除退款"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="totalPaidAmount"
          min-width="160"
          sortable="custom"
        >
          <template #header>
            <span class="th-with-tip">
              店铺总成交金额
              <ElTooltip
                content="用户针对该商品产生的所有成功支付订单的金额总和，不剔除退款"
                placement="top"
                :show-after="200"
              >
                <ElIcon class="info-icon"><InfoFilled /></ElIcon>
              </ElTooltip>
            </span>
          </template>
          <template #default="{ row }">
            {{ row.totalPaidAmount }}元
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="手机号"
          min-width="140"
        >
          <template #default="{ row }">
            <span class="phone-cell">
              <span>{{ revealedPhones[row.username] || row.phoneMasked || "—" }}</span>
              <button
                v-if="row.phoneMasked"
                type="button"
                class="phone-lock"
                :title="revealedPhones[row.username] ? '隐藏明文' : '查看明文'"
                :disabled="!!revealing[row.username]"
                @click="togglePhone(row)"
              >
                <el-icon :size="14">
                  <Unlock v-if="revealedPhones[row.username]" />
                  <Lock v-else />
                </el-icon>
              </button>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="跟进人"
          width="100"
          fixed="right"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.followerName || "—" }}
          </template>
        </ElTableColumn>
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

    <ElDialog
      v-model="tagDialogVisible"
      title="贴标签"
      width="420px"
      append-to-body
      destroy-on-close
    >
      <p class="dlg-tip">
        将为已选 {{ selectedUserCount }} 名用户追加标签（按用户去重，保留原有标签）
      </p>
      <ElSelect
        v-model="tagDraftIds"
        multiple
        filterable
        placeholder="请选择标签"
        style="width: 100%"
      >
        <ElOption
          v-for="t in manualTags"
          :key="t.id"
          :label="t.name"
          :value="t.id"
        />
      </ElSelect>
      <template #footer>
        <ElButton @click="tagDialogVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="tagSaving"
          @click="confirmTags"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.commerce-body {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 12px 16px 16px;
  gap: 10px;
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

.batch {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  color: #666;
  font-size: 13px;
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

/* 表头文案与排序箭头同一行，不换行（对齐 AudienceDetailsPanel） */
.table-wrap :deep(th.el-table__cell > .cell) {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.table-wrap :deep(th.el-table__cell .caret-wrapper) {
  flex: none;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}

.avatar.is-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e8f3ff;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.nick {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pay-tag {
  display: inline-block;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 22px;
}

.pay-tag.is-unpaid {
  background: #f4f4f5;
  color: #909399;
}

.pay-tag.is-paid {
  background: #e1f3d8;
  color: #67c23a;
}

.pay-tag.is-refunded {
  background: #fde2e2;
  color: #f56c6c;
}

.phone-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.phone-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #999;
  cursor: pointer;
}

.phone-lock:hover:not(:disabled) {
  color: var(--color-primary);
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

.dlg-tip {
  margin: 0 0 12px;
  color: #666;
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
