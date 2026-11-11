<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  listSalerOrders,
  ORDER_STATUS,
  ORDER_STATUS_TABS,
  orderStatusLabel,
  orderStatusTone,
  type OrderUserKeywordType,
  type SalerOrderItem,
} from "@/api/orderCenter";
import { exportOrderRows } from "./exportOrderRows";

const AVATAR_COLORS = [
  "#3B82F6",
  "#0EA5A4",
  "#8B5CF6",
  "#F59E0B",
  "#64748B",
  "#2563EB",
  "#E11D48",
  "#0284C7",
];

const loading = ref(false);
const error = ref("");
const list = ref<SalerOrderItem[]>([]);
const total = ref(0);
const selectedKeys = ref<string[]>([]);

const filters = reactive({
  keywordType: "nickname" as OrderUserKeywordType,
  keyword: "",
  orderNo: "",
  productName: "",
  /** 与 Tab 同步；0=全部 */
  orderStatus: ORDER_STATUS.ALL as number,
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

const keywordPlaceholder: Record<OrderUserKeywordType, string> = {
  nickname: "请输入用户昵称",
  id: "请输入用户ID",
  phone: "请输入手机号",
};

/** 状态下拉选项（含全部） */
const statusSelectOptions = ORDER_STATUS_TABS;

function rowKey(row: SalerOrderItem) {
  return row.orderId || row.orderNo;
}

function displayName(row: SalerOrderItem) {
  return row.nickname || row.customerName || row.customerAccount || "--";
}

function nameInitial(row: SalerOrderItem) {
  const name = displayName(row);
  if (!name || name === "--") return "?";
  return name.slice(0, 1);
}

function avatarColor(row: SalerOrderItem) {
  const key = displayName(row) + (row.userId || row.orderId || "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function displayPayTime(row: SalerOrderItem) {
  const t = row.payTime?.trim();
  return t || "";
}

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listSalerOrders({
      page: query.page,
      pageSize: query.pageSize,
      userKeyWord: filters.keyword.trim() || undefined,
      orderNo: filters.orderNo.trim() || undefined,
      productName: filters.productName.trim() || undefined,
      orderStatus: filters.orderStatus,
    });
    list.value = res.list;
    total.value = res.total;
    selectedKeys.value = [];
  } catch (e) {
    list.value = [];
    total.value = 0;
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void fetchList();
}

function resetFilter() {
  filters.keywordType = "nickname";
  filters.keyword = "";
  filters.orderNo = "";
  filters.productName = "";
  filters.orderStatus = ORDER_STATUS.ALL;
  query.page = 1;
  void fetchList();
}

function onTabChange(status: number) {
  if (filters.orderStatus === status) return;
  filters.orderStatus = status;
  query.page = 1;
  void fetchList();
}

function onStatusSelectChange() {
  query.page = 1;
  void fetchList();
}

function onSelectionChange(rows: SalerOrderItem[]) {
  selectedKeys.value = rows.map(rowKey);
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

function onExport() {
  if (!selectedKeys.value.length) {
    ElMessage.warning("请先勾选要导出的订单");
    return;
  }
  const keys = new Set(selectedKeys.value);
  const rows = list.value.filter((i) => keys.has(rowKey(i)));
  exportOrderRows(rows);
}

function onDetailClick() {
  ElMessage.info("订单详情开发中");
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <div class="admin-panel admin-panel--row-64 order-all">
    <div class="admin-filter-bar">
      <div class="admin-filter-fields">
      <div class="admin-filter-item">
        <span class="admin-filter-label">用户</span>
        <ElSelect
          v-model="filters.keywordType"
          style="width: 88px"
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
          style="width: 148px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">订单号</span>
        <ElInput
          v-model="filters.orderNo"
          clearable
          placeholder="请输入订单号"
          style="width: 168px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">商品名称</span>
        <ElInput
          v-model="filters.productName"
          clearable
          placeholder="请输入商品名称"
          style="width: 148px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">订单状态</span>
        <ElSelect
          v-model="filters.orderStatus"
          style="width: 112px"
          @change="onStatusSelectChange"
        >
          <ElOption
            v-for="opt in statusSelectOptions"
            :key="opt.key"
            :label="opt.label"
            :value="opt.key"
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

    <div class="admin-tabs">
      <button
        v-for="tab in ORDER_STATUS_TABS"
        :key="tab.key"
        type="button"
        class="admin-tab"
        :class="{ 'is-active': filters.orderStatus === tab.key }"
        @click="onTabChange(tab.key)"
      >
        {{ tab.label }}
      </button>
      <div class="admin-tabs__extra">
        <button
          type="button"
          class="admin-btn admin-btn--ghost"
          @click="onExport"
        >
          导出
        </button>
      </div>
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
        row-key="orderId"
        height="100%"
        empty-text="暂无订单"
        @selection-change="onSelectionChange"
      >
        <ElTableColumn
          type="selection"
          width="44"
        />
        <ElTableColumn
          label="用户"
          width="148"
        >
          <template #default="{ row }">
            <div class="user-cell">
              <img
                v-if="row.avatar"
                class="user-av"
                :src="row.avatar"
                alt=""
              >
              <span
                v-else
                class="user-av user-av-ph"
                :style="{ background: avatarColor(row as SalerOrderItem) }"
              >{{ nameInitial(row as SalerOrderItem) }}</span>
              <span class="user-name">{{ displayName(row as SalerOrderItem) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="用户ID"
          width="120"
        >
          <template #default="{ row }">
            <span class="mono">{{ row.userId || "--" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="订单号"
          width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="mono">{{ row.orderNo || "--" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="商品名称"
          min-width="160"
        >
          <template #default="{ row }">
            <span class="goods">{{ row.productName || "--" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="下单时间"
          width="168"
        >
          <template #default="{ row }">
            {{ row.createTime || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="支付时间"
          width="168"
        >
          <template #default="{ row }">
            <span
              v-if="displayPayTime(row as SalerOrderItem)"
            >{{ displayPayTime(row as SalerOrderItem) }}</span>
            <span
              v-else
              class="pay-empty"
            >—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="订单状态"
          width="108"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${orderStatusTone(row.orderStatus)}`"
            >
              <i class="dot" />
              {{ orderStatusLabel(row.orderStatus) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="88"
          fixed="right"
        >
          <template #default>
            <button
              type="button"
              class="admin-op is-strong"
              @click="onDetailClick"
            >
              详情
            </button>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="admin-pager">
      <span class="admin-pager__total">共 {{ total }} 条</span>
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
  </div>
</template>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.user-av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.user-av-ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}
.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.mono {
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}
.goods {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.pay-empty {
  color: var(--text-4);
}
</style>
