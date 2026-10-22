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
    `从钱坤云商品库多选绑定，最多 ${props.max} 个；已选 ${picked.value.length}`,
);

function dash(v: string | number | undefined | null): string {
  if (v == null || v === "") return "--";
  return String(v);
}

/** 有关键字时本地缓存全量（对方无商品名入参）；无关键字走服务端分页 */
const allCache = ref<OrderCenterProduct[] | null>(null);

async function loadAllProducts(): Promise<OrderCenterProduct[]> {
  const all: OrderCenterProduct[] = [];
  let p = 1;
  let totalCount = Infinity;
  while (all.length < totalCount && p <= 20) {
    const res = await listSalerProductsPage({ page: p, pageSize: 50 });
    all.push(...res.list);
    totalCount = res.total;
    if (!res.list.length) break;
    p += 1;
  }
  return all;
}

async function fetchPage() {
  loading.value = true;
  try {
    const kw = nameKeyword.value.trim();
    if (kw) {
      if (!allCache.value) allCache.value = await loadAllProducts();
      const filtered = allCache.value.filter((item) =>
        item.productName.includes(kw),
      );
      total.value = filtered.length;
      const start = (page.value - 1) * pageSize.value;
      list.value = filtered.slice(start, start + pageSize.value);
    } else {
      allCache.value = null;
      const res = await listSalerProductsPage({
        page: page.value,
        pageSize: pageSize.value,
      });
      list.value = res.list;
      total.value = res.total;
      page.value = res.page;
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
    if (idSet.has(row.spuId)) table.toggleRowSelection(row, true);
  }
  syncingSelection.value = false;
}

function onSelectionChange(rows: OrderCenterProduct[]) {
  if (syncingSelection.value) return;
  const pageIds = new Set(list.value.map((p) => p.spuId));
  const kept = picked.value.filter((p) => !pageIds.has(p.spuId));
  const merged = [...kept];
  for (const row of rows) {
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
  emit("confirm", [...picked.value]);
  visible.value = false;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    draftKeyword.value = "";
    nameKeyword.value = "";
    allCache.value = null;
    page.value = 1;
    pageSize.value = 10;
    picked.value = (props.selectedProducts ?? []).map((p) => ({
      spuId: String(p.spuId),
      productName: p.productName,
    }));
    void fetchPage().then(() => {
      const map = new Map(list.value.map((p) => [p.spuId, p]));
      picked.value = picked.value.map((p) => map.get(p.spuId) ?? p);
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
      @selection-change="onSelectionChange"
    >
      <ElTableColumn
        type="selection"
        width="48"
        :reserve-selection="true"
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
        label="有效sku"
        width="88"
        align="center"
      >
        <template #default="{ row }">{{ row.validSkuCount ?? 0 }}</template>
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
</style>
