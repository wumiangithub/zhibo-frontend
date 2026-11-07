<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import {
  listSalerCouponsPage,
  type OrderCenterCoupon,
} from "@/api/orderCenter";
import { ApiError } from "@/api/http";
import {
  sendConsoleCoupon,
  type ConsoleSendCouponResult,
} from "./api/console";

const props = defineProps<{
  open: boolean;
  activityId: string;
}>();

const emit = defineEmits<{
  close: [];
  /** 本站落库成功后交给会话发 IM + 上屏 */
  sent: [payload: ConsoleSendCouponResult];
  fail: [message: string];
}>();

const loading = ref(false);
const sendingId = ref<number | null>(null);
const error = ref("");
const list = ref<OrderCenterCoupon[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const empty = computed(() => !loading.value && !error.value && list.value.length === 0);

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n)) return `¥ ${n.toFixed(2)}`;
  const t = raw.trim();
  return t ? (t.startsWith("¥") ? t : `¥ ${t}`) : "—";
}

function formatValidity(start: string, end: string): string {
  const a = (start || "").replace(/\//g, "-").slice(0, 10);
  const b = (end || "").replace(/\//g, "-").slice(0, 10);
  if (!a && !b) return "—";
  return `${a || "—"} -- ${b || "—"}`;
}

function formatDepts(c: OrderCenterCoupon): string {
  return c.deptNames.length ? c.deptNames.join("、") : "—";
}

function formatSkus(c: OrderCenterCoupon): string {
  if (c.allSku) return "全部商品";
  return c.skuNames.length ? c.skuNames.join("、") : "—";
}

async function load(resetPage = false) {
  const id = props.activityId.trim();
  if (!id) {
    error.value = "活动无效";
    return;
  }
  if (resetPage) page.value = 1;
  loading.value = true;
  error.value = "";
  try {
    const res = await listSalerCouponsPage({ page: page.value, pageSize });
    list.value = res.list;
    total.value = res.total;
  } catch (e) {
    list.value = [];
    total.value = 0;
    error.value = e instanceof Error ? e.message : "加载优惠券失败";
  } finally {
    loading.value = false;
  }
}

async function onSend(row: OrderCenterCoupon) {
  if (sendingId.value != null) return;
  try {
    await ElMessageBox.confirm("是否确认发送优惠券？", "发送优惠券", {
      confirmButtonText: "确认发送",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }

  const activityId = props.activityId.trim();
  if (!activityId) return;

  sendingId.value = row.couponId;
  try {
    const res = await sendConsoleCoupon(activityId, {
      couponId: row.couponId,
      couponNo: row.couponNo,
      couponName: row.couponName,
      couponAmount: row.couponAmount,
      couponStartDate: row.couponStartDate,
      couponEndDate: row.couponEndDate,
      allSku: row.allSku,
      deptNames: row.deptNames,
      skuNames: row.skuNames,
    });
    emit("sent", res);
  } catch (e) {
    const msg =
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "发送失败";
    emit("fail", msg);
  } finally {
    sendingId.value = null;
  }
}

watch(
  () => [props.open, props.activityId] as const,
  ([open]) => {
    if (open) void load(true);
  },
  { immediate: true },
);

defineExpose({ reload: () => load(true) });
</script>

<template>
  <Teleport to="body">
    <div
      v-show="open"
      class="coupon-layer"
      @click.self="emit('close')"
    >
      <aside
        class="coupon-drawer"
        role="dialog"
        aria-label="优惠券"
      >
        <header class="coupon-head">
          <h2>优惠券</h2>
          <button
            type="button"
            class="coupon-close"
            aria-label="关闭优惠券"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <div class="coupon-body hover-scrollbar">
          <div
            v-if="loading && !list.length"
            class="coupon-state"
          >
            加载中…
          </div>
          <div
            v-else-if="error"
            class="coupon-state is-err"
          >
            <p>{{ error }}</p>
            <button
              type="button"
              class="retry"
              @click="load(true)"
            >
              重试
            </button>
          </div>
          <div
            v-else-if="empty"
            class="coupon-empty"
          >
            <div class="empty-art" aria-hidden="true" />
            <p>暂无优惠券数据</p>
          </div>
          <table
            v-else
            class="coupon-table"
          >
            <thead>
              <tr>
                <th>券ID</th>
                <th>券名称</th>
                <th>金额</th>
                <th>有效期</th>
                <th>可用事业部</th>
                <th>可用商品</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in list"
                :key="row.couponId"
              >
                <td class="mono">{{ row.couponNo || row.couponId }}</td>
                <td>
                  <span
                    class="ellipsis"
                    :title="row.couponName"
                  >{{ row.couponName }}</span>
                </td>
                <td class="amount">{{ formatAmount(row.couponAmount) }}</td>
                <td class="validity">{{ formatValidity(row.couponStartDate, row.couponEndDate) }}</td>
                <td>
                  <span
                    class="ellipsis"
                    :title="formatDepts(row)"
                  >{{ formatDepts(row) }}</span>
                </td>
                <td>
                  <span
                    class="ellipsis"
                    :title="formatSkus(row)"
                  >{{ formatSkus(row) }}</span>
                </td>
                <td>
                  <button
                    type="button"
                    class="send-btn"
                    :disabled="sendingId != null"
                    @click="onSend(row)"
                  >

                    {{ sendingId === row.couponId ? "发送中…" : "发送" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="list.length && total > list.length"
            class="coupon-more"
          >
            共 {{ total }} 条，当前展示前 {{ list.length }} 条
          </p>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.coupon-layer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(0 0 0 / 28%);
}

.coupon-drawer {
  display: flex;
  flex-direction: column;
  width: min(1100px, 96vw);
  height: 100%;
  overflow: hidden;
  background: #fff;
  box-shadow: 8px 0 28px rgb(0 0 0 / 16%);
  animation: coupon-slide-in 0.22s ease-out;
}

@keyframes coupon-slide-in {
  from {
    transform: translateX(-12px);
    opacity: 0.6;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.coupon-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eef0f3;
}

.coupon-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.coupon-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #646a73;
  cursor: pointer;
}

.coupon-close:hover {
  background: #f2f3f5;
}

.coupon-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 24px;
}

.coupon-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 240px;
  color: #8f959e;
  font-size: 14px;
}

.coupon-state.is-err {
  color: #d83931;
}

.retry {
  border: 1px solid #d0d3d6;
  border-radius: 6px;
  background: #fff;
  padding: 6px 14px;
  cursor: pointer;
}

.coupon-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 280px;
  color: #8f959e;
  font-size: 14px;
}

.empty-art {
  width: 88px;
  height: 64px;
  border-radius: 12px;
  background:
    linear-gradient(135deg, #ffe8c8 0%, #ffb45c 48%, #f07828 100%);
  box-shadow: inset 0 -10px 0 rgb(0 0 0 / 6%);
  position: relative;
}

.empty-art::after {
  content: "券";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.coupon-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
  color: #1f2329;
}

.coupon-table th {
  padding: 10px 8px;
  background: #f5f6f7;
  color: #646a73;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid #e8eaed;
  white-space: nowrap;
}

.coupon-table td {
  padding: 12px 8px;
  border-bottom: 1px solid #f0f1f2;
  vertical-align: middle;
}

.coupon-table th:nth-child(1),
.coupon-table td:nth-child(1) {
  width: 100px;
}

.coupon-table th:nth-child(3),
.coupon-table td:nth-child(3) {
  width: 100px;
}

.coupon-table th:nth-child(4),
.coupon-table td:nth-child(4) {
  width: 180px;
}

.coupon-table th:nth-child(7),
.coupon-table td:nth-child(7) {
  width: 72px;
}

.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-variant-numeric: tabular-nums;
  color: #4e5969;
}

.amount {
  font-weight: 600;
  color: #d97706;
  font-variant-numeric: tabular-nums;
}

.validity {
  font-variant-numeric: tabular-nums;
  color: #4e5969;
  white-space: nowrap;
}

.send-btn {
  border: none;
  background: transparent;
  color: #3370ff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.send-btn:hover:not(:disabled) {
  color: #245bdb;
  text-decoration: underline;
}

.send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.coupon-more {
  margin: 12px 0 0;
  color: #8f959e;
  font-size: 12px;
  text-align: center;
}
</style>
