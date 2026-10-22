<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox, ElTable, ElTableColumn } from "element-plus";
import {
  updateActivity,
  type ActivityDetail,
  type ActivityId,
  type ActivityProduct,
} from "@/api/activity";
import {
  batchGetSalerProductDetails,
  isOrderCenterOnShelf,
  orderCenterShelfLabel,
  type OrderCenterProduct,
} from "@/api/orderCenter";
import UiButton from "@/components/ui/UiButton.vue";
import ProductPickerDialog from "../components/ProductPickerDialog.vue";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const products = ref<ActivityProduct[]>([]);
/** 弹窗/列表展示用的扩展字段（不落本站；来自批量详情或选品） */
const displayMap = ref<Record<string, OrderCenterProduct>>({});
const pickerVisible = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
/** 避免详情刷新时串台覆盖 */
let detailFetchSeq = 0;

async function hydrateDisplayFromOrderCenter(items: ActivityProduct[]) {
  const ids = items.map((p) => String(p.spuId)).filter(Boolean);
  if (!ids.length) {
    displayMap.value = {};
    return;
  }
  const seq = ++detailFetchSeq;
  detailLoading.value = true;
  try {
    const map = await batchGetSalerProductDetails(ids);
    if (seq !== detailFetchSeq) return;
    displayMap.value = map;
  } catch (e) {
    if (seq !== detailFetchSeq) return;
    // 详情补齐失败不挡编辑；仍展示本站快照名称
    displayMap.value = {};
    ElMessage.warning(e instanceof Error ? e.message : "商品详情加载失败");
  } finally {
    if (seq === detailFetchSeq) detailLoading.value = false;
  }
}

function applyDetail(d: ActivityDetail) {
  products.value = (d.products ?? []).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName,
  }));
  void hydrateDisplayFromOrderCenter(products.value);
}

watch(
  () => props.detail,
  (d) => applyDetail(d),
  { immediate: true },
);

function dash(v: string | number | undefined | null): string {
  if (v == null || v === "") return "--";
  return String(v);
}

function displayOf(spuId: string): OrderCenterProduct | undefined {
  return displayMap.value[spuId];
}

/** 名称优先用订单中心实时详情，否则本站绑定快照 */
function displayName(row: ActivityProduct): string {
  return displayOf(row.spuId)?.productName || row.productName || row.spuId;
}

function openPicker() {
  if (saving.value) return;
  if (products.value.length >= 20) {
    ElMessage.warning("关联商品最多 20 个");
    return;
  }
  pickerVisible.value = true;
}

/** 全量覆盖落库；成功后刷新详情 */
async function persistProducts(
  next: ActivityProduct[],
  okMessage: string,
): Promise<boolean> {
  if (next.length > 20) {
    ElMessage.warning("关联商品最多 20 个");
    return false;
  }
  saving.value = true;
  try {
    await updateActivity(props.activityId, {
      products: next.map((p) => ({
        spuId: String(p.spuId),
        productName: p.productName.trim() || String(p.spuId),
      })),
    });
    products.value = next;
    ElMessage.success(okMessage);
    emit("refreshed");
    return true;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
    return false;
  } finally {
    saving.value = false;
  }
}

async function onPickerConfirm(items: OrderCenterProduct[]) {
  const next = items.slice(0, 20).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName.trim() || String(p.spuId),
  }));
  const ok = await persistProducts(next, "添加成功");
  if (!ok) return;
  const map = { ...displayMap.value };
  for (const p of items) map[p.spuId] = p;
  displayMap.value = map;
}

async function removeProduct(spuId: string) {
  if (saving.value) return;
  const row = products.value.find((p) => p.spuId === spuId);
  if (!row) return;
  const name = displayName(row);
  try {
    await ElMessageBox.confirm(
      `确认将【${name}】移出本场直播吗？移出后观众将无法看到该商品。`,
      "移除商品",
      {
        type: "warning",
        confirmButtonText: "确认移除",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  const next = products.value.filter((p) => p.spuId !== spuId);
  await persistProducts(next, "已移除");
}

/** 即时落库，无未保存脏态；供父页切 Tab / 离开兼容 */
defineExpose({
  isDirty: () => false,
  confirmLeave: async () => true,
});
</script>

<template>
  <div
    v-loading="saving"
    class="commerce-tab"
  >
    <h3 class="panel-title">直播带货</h3>

    <div class="assoc-head">
      <span class="assoc-label">关联商品</span>
      <UiButton
        variant="outline"
        :disabled="saving"
        @click="openPicker"
      >
        + 添加商品
      </UiButton>
    </div>

    <ElTable
      v-loading="detailLoading"
      :data="products"
      empty-text="暂无关联商品，点击「添加商品」从钱坤云商品库选择"
      class="assoc-table"
    >
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
        <template #default="{ row }">{{ displayName(row) }}</template>
      </ElTableColumn>
      <ElTableColumn
        label="商品别名"
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ dash(displayOf(row.spuId)?.productAlias) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="分类"
        min-width="90"
      >
        <template #default="{ row }">
          {{ dash(displayOf(row.spuId)?.categoryName) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="上架状态"
        min-width="100"
      >
        <template #default="{ row }">
          <template v-if="displayOf(row.spuId)">
            <span
              class="shelf"
              :class="{ 'is-on': isOrderCenterOnShelf(displayOf(row.spuId)?.status) }"
            >
              <i class="dot" />
              {{ orderCenterShelfLabel(displayOf(row.spuId)?.status) }}
            </span>
          </template>
          <span v-else>--</span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="归属部门"
        min-width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ dash(displayOf(row.spuId)?.belongDeptName) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="售卖部门"
        min-width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ dash(displayOf(row.spuId)?.salesDeptName) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="关联老师"
        min-width="100"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ dash(displayOf(row.spuId)?.teacherNames) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="有效sku"
        width="88"
        align="center"
      >
        <template #default="{ row }">
          {{ displayOf(row.spuId)?.validSkuCount ?? "--" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="有效活动"
        width="88"
        align="center"
      >
        <template #default="{ row }">
          {{ displayOf(row.spuId)?.validActivityCount ?? "--" }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="操作"
        width="80"
        fixed="right"
      >
        <template #default="{ row }">
          <button
            type="button"
            class="link-btn"
            :disabled="saving"
            @click="removeProduct(row.spuId)"
          >
            移除
          </button>
        </template>
      </ElTableColumn>
    </ElTable>

    <ProductPickerDialog
      v-model="pickerVisible"
      :selected-products="products"
      :max="20"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<style scoped>
.commerce-tab {
  padding: 4px 8px 24px;
  min-height: 120px;
}
.panel-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  padding-bottom: 12px;
  border-bottom: 2px solid var(--color-primary, #2f6bff);
  display: inline-block;
}
.assoc-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.assoc-label {
  font-size: 14px;
  color: var(--color-text);
}
.assoc-table {
  width: 100%;
}
.link-btn {
  border: none;
  background: none;
  padding: 0;
  font-size: 13px;
  color: var(--color-primary, #2f6bff);
  cursor: pointer;
}
.link-btn:disabled {
  color: #bfbfbf;
  cursor: not-allowed;
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
