<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElButton,
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
  orderStatusDotClass,
  orderStatusLabel,
  type OrderUserKeywordType,
  type SalerOrderItem,
} from "@/api/orderCenter";
import { exportOrderRows } from "./exportOrderRows";

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

function displayMoney(row: SalerOrderItem) {
  const m = row.orderMoney?.trim();
  if (!m) return "--";
  return `¥ ${m}`;
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
  <div class="order-all">
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
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">订单号</span>
        <ElInput
          v-model="filters.orderNo"
          clearable
          placeholder="请输入订单号"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">商品名称</span>
        <ElInput
          v-model="filters.productName"
          clearable
          placeholder="请输入商品名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">订单状态</span>
        <ElSelect
          v-model="filters.orderStatus"
          style="width: 140px"
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
      <ElButton @click="resetFilter">重置</ElButton>
      <ElButton
        type="primary"
        @click="search"
      >
        查询
      </ElButton>
    </div>

    <div class="status-tabs">
      <button
        v-for="tab in ORDER_STATUS_TABS"
        :key="tab.key"
        type="button"
        class="status-tab"
        :class="{ 'is-active': filters.orderStatus === tab.key }"
        @click="onTabChange(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="toolbar">
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
        row-key="orderId"
        height="100%"
        empty-text="暂无订单"
        @selection-change="onSelectionChange"
      >
        <ElTableColumn
          type="selection"
          width="48"
        />
        <ElTableColumn
          label="用户"
          min-width="160"
        >
          <template #default="{ row }">
            <div class="user-cell">
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
              <div class="user-meta">
                <span class="user-name">{{ displayName(row as SalerOrderItem) }}</span>
                <span
                  v-if="row.weComFriend"
                  class="wecom-tag"
                >企微好友</span>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="用户ID"
          min-width="140"
        >
          <template #default="{ row }">
            {{ row.userId || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="订单号"
          min-width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.orderNo || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="商品名称"
          min-width="220"
        >
          <template #default="{ row }">
            <div class="product-cell">
              <div class="cover">
                <img
                  v-if="row.coverImg"
                  :src="row.coverImg"
                  :alt="row.productName"
                >
                <span
                  v-else
                  class="cover-ph"
                >无图</span>
              </div>
              <div class="product-meta">
                <p class="product-name">{{ row.productName || "--" }}</p>
                <p class="validity">{{ row.validityLabel || "--" }}</p>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="下单时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ row.createTime || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="支付时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ row.payTime || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="支付金额"
          width="120"
        >
          <template #default="{ row }">
            {{ displayMoney(row as SalerOrderItem) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="支付方式"
          width="120"
        >
          <template #default="{ row }">
            {{ row.payWayText || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="订单状态"
          width="120"
        >
          <template #default="{ row }">
            <span class="status-dot">
              <i
                class="dot"
                :class="orderStatusDotClass(row.orderStatus)"
              />
              {{ orderStatusLabel(row.orderStatus) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="服务状态"
          width="110"
        >
          <template #default="{ row }">
            {{ row.serviceStatusText || row.serviceStatus || "--" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="100"
          fixed="right"
        >
          <template #default>
            <button
              type="button"
              class="op-link is-disabled"
              @click="onDetailClick"
            >
              订单详情
            </button>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="pager">
      <span class="pager-total">共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页</span>
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
  </div>
</template>

<style scoped>
.order-all {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
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
.status-tabs {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid #ebebeb;
}
.status-tab {
  margin: 0 0 -1px;
  padding: 8px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}
.status-tab:hover {
  color: var(--color-primary);
}
.status-tab.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}
.toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}
.err-banner {
  flex: none;
  margin: 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: #fff2f0;
  color: #cf1322;
  font-size: 13px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.avatar-ph {
  background: #e8e8e8;
}
.user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
  font-size: 13px;
  color: #1a1a1a;
}
.wecom-tag {
  display: inline-block;
  padding: 0 4px;
  border-radius: 2px;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 11px;
  line-height: 18px;
}
.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cover {
  width: 48px;
  height: 48px;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
  background: #f0f0f0;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-ph {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #bfbfbf;
}
.product-meta {
  min-width: 0;
}
.product-name {
  margin: 0;
  font-size: 13px;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}
.validity {
  margin: 2px 0 0;
  font-size: 12px;
  color: #999;
}
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #bfbfbf;
}
.dot--gray {
  background: #bfbfbf;
}
.dot--green {
  background: #52c41a;
}
.dot--red {
  background: #f5222d;
}
.op-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  outline: none;
}
.op-link.is-disabled {
  color: #bfbfbf;
}
.pager {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.pager-total {
  font-size: 13px;
  color: #666;
}
</style>
