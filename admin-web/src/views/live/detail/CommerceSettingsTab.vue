<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, ElTable, ElTableColumn } from "element-plus";
import {
  updateActivity,
  type ActivityDetail,
  type ActivityId,
  type ActivityProduct,
} from "@/api/activity";
import {
  isOrderCenterOnShelf,
  orderCenterShelfLabel,
  type OrderCenterProduct,
} from "@/api/orderCenter";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import UiButton from "@/components/ui/UiButton.vue";
import ProductPickerDialog from "../components/ProductPickerDialog.vue";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const leave = useLeaveConfirm({
  routeLeave: false,
  message: "当前修改尚未保存，确认离开？",
});

const products = ref<ActivityProduct[]>([]);
/** 弹窗/列表展示用的扩展字段（不落本站） */
const displayMap = ref<Record<string, OrderCenterProduct>>({});
const pickerVisible = ref(false);
const saving = ref(false);

/** 待审核或未写风控状态时不可改（与基本信息一致） */
const auditLocked = computed(() => {
  const status = props.detail.riskStatus;
  return !status || status === "pending";
});

function applyDetail(d: ActivityDetail) {
  products.value = (d.products ?? []).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName,
  }));
  leave.markClean();
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

function openPicker() {
  if (auditLocked.value) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  if (products.value.length >= 20) {
    ElMessage.warning("关联商品最多 20 个");
    return;
  }
  pickerVisible.value = true;
}

function onPickerConfirm(items: OrderCenterProduct[]) {
  const next = items.slice(0, 20).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName.trim() || String(p.spuId),
  }));
  const map = { ...displayMap.value };
  for (const p of items) map[p.spuId] = p;
  displayMap.value = map;
  products.value = next;
  leave.markDirty();
}

function removeProduct(spuId: string) {
  if (auditLocked.value) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  products.value = products.value.filter((p) => p.spuId !== spuId);
  leave.markDirty();
}

async function onSave() {
  if (auditLocked.value) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  if (products.value.length > 20) {
    ElMessage.warning("关联商品最多 20 个");
    return;
  }
  saving.value = true;
  try {
    await updateActivity(props.activityId, {
      products: products.value.map((p) => ({
        spuId: String(p.spuId),
        productName: p.productName.trim(),
      })),
    });
    ElMessage.success("保存成功，重新进入审核");
    leave.markClean();
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

defineExpose({
  isDirty: () => leave.dirty.value,
  confirmLeave: leave.confirmLeave,
});
</script>

<template>
  <div class="commerce-tab">
    <h3 class="panel-title">直播带货</h3>

    <p
      v-if="auditLocked"
      class="lock-tip"
    >
      审核中不可编辑关联商品；审核通过或驳回后方可修改。
    </p>

    <div class="assoc-head">
      <span class="assoc-label">关联商品</span>
      <UiButton
        variant="outline"
        :disabled="auditLocked"
        @click="openPicker"
      >
        + 添加商品
      </UiButton>
    </div>

    <ElTable
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
        <template #default="{ row }">{{ row.productName }}</template>
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
            :disabled="auditLocked"
            @click="removeProduct(row.spuId)"
          >
            移除
          </button>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="footer">
      <UiButton
        variant="primary"
        :disabled="auditLocked || saving"
        @click="onSave"
      >
        {{ saving ? "保存中…" : "保存" }}
      </UiButton>
    </div>

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
.lock-tip {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: #ad6800;
  background: #fff7e6;
  border-radius: 4px;
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
.footer {
  margin-top: 24px;
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
