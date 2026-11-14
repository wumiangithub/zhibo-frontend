<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, ElMessageBox, ElSwitch } from "element-plus";
import { updateActivity } from "@/api/activity";
import {
  batchGetSalerProductDetails,
  type OrderCenterProduct,
} from "@/api/orderCenter";
import {
  listConsoleProducts,
  setConsoleCartEnabled,
  setConsoleProductVisible,
  type ConsoleProductItem,
} from "./api/console";

const props = defineProps<{
  activityId: string;
}>();

const emit = defineEmits<{
  toast: [message: string];
}>();

const loading = ref(false);
const savingCart = ref(false);
const removingId = ref<string | null>(null);
const togglingId = ref<string | null>(null);
const error = ref("");
const cartEnabled = ref(true);
const list = ref<ConsoleProductItem[]>([]);
const displayMap = ref<Record<string, OrderCenterProduct>>({});
let loadSeq = 0;

const empty = computed(
  () => !loading.value && !error.value && list.value.length === 0,
);

function displayOf(spuId: string): OrderCenterProduct | undefined {
  return displayMap.value[spuId];
}

function displayName(row: ConsoleProductItem): string {
  return displayOf(row.spuId)?.productName || row.productName || row.spuId;
}

function priceText(row: ConsoleProductItem): string {
  return displayOf(row.spuId)?.priceText || "--";
}

function servicePeriod(row: ConsoleProductItem): string {
  return displayOf(row.spuId)?.servicePeriodText || "--";
}

function productType(row: ConsoleProductItem): string {
  return displayOf(row.spuId)?.categoryName || "--";
}

function coverUrl(row: ConsoleProductItem): string | undefined {
  const url = displayOf(row.spuId)?.coverImg?.trim();
  return url || undefined;
}

async function hydrateDisplay(items: ConsoleProductItem[]) {
  const ids = items.map((p) => String(p.spuId)).filter(Boolean);
  if (!ids.length) {
    displayMap.value = {};
    return;
  }
  try {
    displayMap.value = await batchGetSalerProductDetails(ids);
  } catch (e) {
    displayMap.value = {};
    ElMessage.warning(e instanceof Error ? e.message : "商品详情加载失败");
  }
}

async function load() {
  const id = props.activityId.trim();
  if (!id) {
    list.value = [];
    error.value = "活动无效";
    return;
  }
  const seq = ++loadSeq;
  loading.value = true;
  error.value = "";
  try {
    const res = await listConsoleProducts(id);
    if (seq !== loadSeq) return;
    cartEnabled.value = !!res.cartEnabled;
    list.value = res.list ?? [];
    await hydrateDisplay(list.value);
  } catch (e) {
    if (seq !== loadSeq) return;
    list.value = [];
    error.value = e instanceof Error ? e.message : "加载商品失败";
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

async function onCartChange(next: boolean) {
  const id = props.activityId.trim();
  if (!id || savingCart.value) return;
  const prev = cartEnabled.value;
  if (next === prev) return;
  try {
    await ElMessageBox.confirm(
      next
        ? "确认开启小黄车？开启后观众端将展示本场商品。"
        : "确认关闭小黄车？关闭后观众端将无法看到商品。",
      "小黄车",
      {
        type: "warning",
        confirmButtonText: next ? "确认开启" : "确认关闭",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  savingCart.value = true;
  try {
    const res = await setConsoleCartEnabled(id, next);
    cartEnabled.value = !!res.cartEnabled;
    emit("toast", cartEnabled.value ? "已开启小黄车" : "已关闭小黄车");
  } catch (e) {
    cartEnabled.value = prev;
    emit("toast", e instanceof Error ? e.message : "小黄车开关失败");
  } finally {
    savingCart.value = false;
  }
}

async function onVisibleChange(row: ConsoleProductItem, next: boolean) {
  const id = props.activityId.trim();
  if (!id || togglingId.value) return;
  const prev = row.visible;
  row.visible = next;
  togglingId.value = row.spuId;
  try {
    const res = await setConsoleProductVisible(id, {
      spuId: row.spuId,
      visible: next,
    });
    row.visible = !!res.visible;
  } catch (e) {
    row.visible = prev;
    emit("toast", e instanceof Error ? e.message : "更新显示状态失败");
  } finally {
    togglingId.value = null;
  }
}

function onExplain() {
  emit("toast", "讲解功能暂未开放");
}

async function onRemove(row: ConsoleProductItem) {
  const id = props.activityId.trim();
  if (!id || removingId.value) return;
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
  const next = list.value
    .filter((p) => p.spuId !== row.spuId)
    .map((p) => ({
      spuId: String(p.spuId),
      productName: (p.productName || p.spuId).trim() || String(p.spuId),
    }));
  removingId.value = row.spuId;
  try {
    await updateActivity(id, { products: next });
    list.value = list.value.filter((p) => p.spuId !== row.spuId);
    const map = { ...displayMap.value };
    delete map[row.spuId];
    displayMap.value = map;
    ElMessage.success("已移除");
  } catch (e) {
    emit("toast", e instanceof Error ? e.message : "移除失败");
  } finally {
    removingId.value = null;
  }
}

watch(
  () => props.activityId,
  () => {
    void load();
  },
  { immediate: true },
);

defineExpose({ reload: load });
</script>

<template>
  <section
    class="product-panel"
    aria-label="商品"
  >
    <header class="product-head">
      <span class="head-title">商品</span>
      <div class="cart-switch">
        <span class="cart-label">小黄车</span>
        <ElSwitch
          :model-value="cartEnabled"
          :disabled="loading || savingCart || !!error"
          @change="(v: string | number | boolean) => onCartChange(!!v)"
        />
      </div>
    </header>

    <div
      v-if="loading && !list.length"
      class="product-state"
    >
      加载中…
    </div>
    <div
      v-else-if="error"
      class="product-state is-err"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="retry"
        @click="load"
      >
        重试
      </button>
    </div>
    <div
      v-else-if="empty"
      class="product-state"
    >
      暂无关联商品，请先在直播设置 · 直播带货中绑定
    </div>
    <div
      v-else
      class="table-wrap hover-scrollbar"
    >
      <table class="product-table">
        <thead>
          <tr>
            <th class="col-name">商品名称</th>
            <th class="col-period">服务期</th>
            <th class="col-sold">已售</th>
            <th class="col-type">商品类型</th>
            <th class="col-visible">显示状态</th>
            <th class="col-explain">讲解状态</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in list"
            :key="row.spuId"
          >
            <td class="col-name">
              <div class="name-cell">
                <div
                  class="thumb"
                  aria-hidden="true"
                >
                  <img
                    v-if="coverUrl(row)"
                    :src="coverUrl(row)"
                    alt=""
                  >
                </div>
                <div class="name-meta">
                  <div
                    class="title"
                    :title="displayName(row)"
                  >
                    {{ displayName(row) }}
                  </div>
                  <div class="price">{{ priceText(row) }}</div>
                </div>
              </div>
            </td>
            <td class="col-period">{{ servicePeriod(row) }}</td>
            <td class="col-sold">{{ row.soldCount ?? 0 }}</td>
            <td class="col-type">{{ productType(row) }}</td>
            <td class="col-visible">
              <div class="visible-cell">
                <ElSwitch
                  :model-value="row.visible"
                  :disabled="togglingId === row.spuId || removingId != null"
                  @change="(v: string | number | boolean) => onVisibleChange(row, !!v)"
                />
                <span
                  class="visible-text"
                  :class="{ 'is-on': row.visible }"
                >{{ row.visible ? "显示" : "隐藏" }}</span>
              </div>
            </td>
            <td class="col-explain">
              <span class="explain-status">
                <i class="dot" />
                待讲解
              </span>
            </td>
            <td class="col-ops">
              <button
                type="button"
                class="link-btn"
                @click="onExplain"
              >
                讲解
              </button>
              <span class="sep">|</span>
              <button
                type="button"
                class="link-btn"
                :disabled="removingId != null"
                @click="onRemove(row)"
              >
                {{ removingId === row.spuId ? "移除中…" : "移除" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.product-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 0 16px 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}

.product-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.head-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.cart-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cart-label {
  font-size: 13px;
  color: #333;
}

.product-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 24px;
  color: #999;
  font-size: 13px;
}

.product-state.is-err {
  color: #f56c6c;
}

.retry {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  background: #fff;
  color: var(--color-primary);
  cursor: pointer;
}

.table-wrap {
  flex: 1;
  min-height: 160px;
  max-height: 320px;
  overflow: auto;
}

.product-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
  color: #333;
}

.product-table th,
.product-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
  vertical-align: middle;
}

.product-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fafafa;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.col-name {
  width: 28%;
  min-width: 180px;
}

.col-period {
  width: 10%;
}

.col-sold {
  width: 8%;
}

.col-type {
  width: 10%;
}

.col-visible {
  width: 14%;
}

.col-explain {
  width: 12%;
}

.col-ops {
  width: 18%;
  white-space: nowrap;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.thumb {
  flex: none;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 4px;
  background: #f2f3f5;
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.name-meta {
  min-width: 0;
}

.title {
  overflow: hidden;
  color: #333;
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  margin-top: 2px;
  color: #f56c6c;
  font-size: 12px;
  line-height: 1.3;
}

.visible-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.visible-text {
  color: #999;
  font-size: 12px;
}

.visible-text.is-on {
  color: var(--color-primary);
}

.explain-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #999;
  font-size: 12px;
}

.explain-status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c4cc;
}

.link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.sep {
  margin: 0 6px;
  color: #dcdfe6;
}

@media (max-width: 1100px) {
  .col-period,
  .col-type {
    width: 12%;
  }

  .col-name {
    width: 32%;
  }
}
</style>
