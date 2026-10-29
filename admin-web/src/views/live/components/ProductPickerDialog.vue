<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  canBindOrderCenterProduct,
  isOrderCenterOnShelf,
  listSalerProductsPage,
  orderCenterShelfLabel,
  type OrderCenterProduct,
} from "@/api/orderCenter";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 已关联商品（勾选回显；至少含 spuId / productName） */
    selectedProducts?: Array<Pick<OrderCenterProduct, "spuId" | "productName">>;
    /** 最多可选（含已关联） */
    max?: number;
    title?: string;
  }>(),
  {
    selectedProducts: () => [],
    max: 20,
    title: "钱坤云商品库",
  },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  confirm: [items: OrderCenterProduct[]];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const nameKeyword = ref("");
const draftKeyword = ref("");
const loading = ref(false);
const list = ref<OrderCenterProduct[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const picked = ref<OrderCenterProduct[]>([]);
const tableRef = ref<{
  clearSelection: () => void;
  toggleRowSelection: (row: OrderCenterProduct, selected?: boolean) => void;
} | null>(null);
const syncingSelection = ref(false);

const hint = computed(
  () =>
    `从钱坤云商品库多选绑定，最多 ${props.max} 个；已选 ${picked.value.length}。无 SKU 的商品仅展示，不可勾选`,
);

function dash(v: string | number | undefined | null): string {
  if (v == null || v === "") return "--";
  return String(v);
}

/** skuList 缺失或 []：禁勾，只展示 */
function rowSelectable(row: OrderCenterProduct): boolean {
  return canBindOrderCenterProduct(row);
}

function rowClassName({ row }: { row: OrderCenterProduct }): string {
  return canBindOrderCenterProduct(row) ? "" : "is-unbindable";
}

/** 服务端分页；商品名走对方 body.productName 模糊搜 */
async function fetchPage() {
  loading.value = true;
  try {
    const kw = nameKeyword.value.trim();
    const res = await listSalerProductsPage({
      page: page.value,
      pageSize: pageSize.value,
      ...(kw ? { productName: kw } : {}),
    });
    list.value = res.list;
    total.value = res.total;
    page.value = res.page;
    // 本页无 sku 的商品若已在已选里，剔除（只展示不可绑）
    const blocked = new Set(
      list.value.filter((r) => !canBindOrderCenterProduct(r)).map((r) => r.spuId),
    );
    if (blocked.size) {
      picked.value = picked.value.filter((p) => !blocked.has(p.spuId));
    }
    await nextTick();
    syncTableSelection();
  } catch (e) {
    list.value = [];
    total.value = 0;
    ElMessage.error(e instanceof Error ? e.message : "拉取商品列表失败");
  } finally {
    loading.value = false;
  }
}

function syncTableSelection() {
  const table = tableRef.value;
  if (!table) return;
  syncingSelection.value = true;
  table.clearSelection();
  const idSet = new Set(picked.value.map((p) => p.spuId));
  for (const row of list.value) {
    if (idSet.has(row.spuId) && canBindOrderCenterProduct(row)) {
      table.toggleRowSelection(row, true);
    }
  }
  syncingSelection.value = false;
}

function onSelectionChange(rows: OrderCenterProduct[]) {
  if (syncingSelection.value) return;
  const pageIds = new Set(list.value.map((p) => p.spuId));
  const kept = picked.value.filter((p) => !pageIds.has(p.spuId));
  const merged = [...kept];
  for (const row of rows) {
    if (!canBindOrderCenterProduct(row)) continue;
    if (!merged.some((p) => p.spuId === row.spuId)) merged.push(row);
  }
  if (merged.length > props.max) {
    ElMessage.warning(`最多关联 ${props.max} 个商品`);
    picked.value = merged.slice(0, props.max);
    void nextTick(() => syncTableSelection());
    return;
  }
  picked.value = merged;
}

function onSearch() {
  nameKeyword.value = draftKeyword.value.trim();
  page.value = 1;
  void fetchPage();
}

function onReset() {
  draftKeyword.value = "";
  nameKeyword.value = "";
  page.value = 1;
  void fetchPage();
}

function onPageChange(p: number) {
  page.value = p;
  void fetchPage();
}

function onPageSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  void fetchPage();
}

function onConfirm() {
  emit(
    "confirm",
    picked.value.filter((p) => canBindOrderCenterProduct(p)),
  );
  visible.value = false;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    draftKeyword.value = "";
    nameKeyword.value = "";
    page.value = 1;
    pageSize.value = 10;
    picked.value = (props.selectedProducts ?? []).map((p) => ({
      spuId: String(p.spuId),
      productName: p.productName,
    }));
    void fetchPage().then(() => {
      const map = new Map(list.value.map((p) => [p.spuId, p]));
      picked.value = picked.value
        .map((p) => map.get(p.spuId) ?? p)
        .filter((p) => canBindOrderCenterProduct(p));
    });
  },
);
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="960px"
    destroy-on-close
    append-to-body
    class="product-picker-dialog"
  >
    <p class="hint">{{ hint }}</p>
    <div class="toolbar">
      <span class="label">商品名称</span>
      <ElInput
        v-model="draftKeyword"
        clearable
        placeholder="请输入商品名称"
        style="width: 220px"
        @keyup.enter="onSearch"
      />
      <ElButton @click="onReset">重置</ElButton>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="list"
      row-key="spuId"
      max-height="420"
      empty-text="暂无商品"
      :row-class-name="rowClassName"
      @selection-change="onSelectionChange"
    >
      <ElTableColumn
        type="selection"
        width="48"
        :reserve-selection="true"
        :selectable="rowSelectable"
      />
      <ElTableColumn
        label="商品ID"
        min-width="110"
      >
        <template #default="{ row }">{{ row.spuId }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="商品名称"
        min-width="160"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ row.productName }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="商品别名"
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ dash(row.productAlias) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="分类"
        min-width="90"
      >
        <template #default="{ row }">{{ dash(row.categoryName) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="上架状态"
        min-width="100"
      >
        <template #default="{ row }">
          <span
            class="shelf"
            :class="{ 'is-on': isOrderCenterOnShelf(row.status) }"
          >
            <i class="dot" />
            {{ orderCenterShelfLabel(row.status) }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="有效sku"
        width="88"
        align="center"
      >
        <template #default="{ row }">
          <span
            class="sku-count"
            :class="{ 'is-none': !canBindOrderCenterProduct(row) }"
            :title="canBindOrderCenterProduct(row) ? undefined : '无 SKU，不可绑定'"
          >{{ row.validSkuCount ?? 0 }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="归属部门"
        min-width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ dash(row.belongDeptName) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="售卖部门"
        min-width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ dash(row.salesDeptName) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="关联老师"
        min-width="100"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ dash(row.teacherNames) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="有效活动"
        width="88"
        align="center"
      >
        <template #default="{ row }">{{ row.validActivityCount ?? 0 }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="更新时间"
        min-width="150"
      >
        <template #default="{ row }">{{ dash(row.updateTime) }}</template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <ElPagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton
        type="primary"
        @click="onConfirm"
      >
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.label {
  font-size: 13px;
  color: var(--color-text);
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.shelf {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
}
.shelf .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c4cc;
}
.shelf.is-on {
  color: #389e0d;
}
.shelf.is-on .dot {
  background: #52c41a;
}
.sku-count.is-none {
  color: #c0c4cc;
}
:deep(.el-table__body tr.is-unbindable > td.el-table__cell) {
  background: #f5f7fa;
  color: #a8abb2;
  cursor: not-allowed;
}
:deep(.el-table__body tr.is-unbindable:hover > td.el-table__cell) {
  background: #f0f2f5;
}
:deep(.is-unbindable .el-checkbox),
:deep(.is-unbindable .el-checkbox__input),
:deep(.is-unbindable .el-checkbox__inner) {
  cursor: not-allowed;
}
:deep(.is-unbindable .el-checkbox) {
  pointer-events: none;
}
:deep(.is-unbindable .el-checkbox__input.is-disabled .el-checkbox__inner) {
  background-color: #f5f7fa;
  border-color: #e4e7ed;
}
</style>
