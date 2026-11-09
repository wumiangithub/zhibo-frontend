<script setup lang="ts">
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import type { WatchCouponItem } from "@/api/watchCoupons";

defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  coupons: WatchCouponItem[];
  /** 正在领取的券 id；有值时禁点，防连点 */
  claimingCouponId?: number | null;
}>();

const emit = defineEmits<{
  close: [];
  claim: [item: WatchCouponItem];
}>();

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n)) return n.toFixed(2);
  return raw.trim() || "0.00";
}

function formatValidity(start?: string, end?: string): string {
  const a = (start || "").replace(/-/g, ".").slice(0, 10);
  const b = (end || "").replace(/-/g, ".").slice(0, 10);
  if (!a && !b) return "";
  return `${a || "—"}至${b || "—"}`;
}
</script>

<template>
  <UiBottomSheet
    :open="open"
    title="本场优惠券"
    show-handle
    @close="emit('close')"
  >
    <div class="px-4 py-2">
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-3 py-14 text-[var(--lw-text-muted)]"
      >
        <span class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--lw-border-strong)] border-t-[var(--lw-text-secondary)]" />
        <p class="text-sm">
          加载中…
        </p>
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center gap-2 py-14"
      >
        <p class="text-sm text-[var(--lw-color-danger)]">
          {{ error }}
        </p>
      </div>

      <div
        v-else-if="coupons.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-14 text-[var(--lw-text-secondary)]"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9a3c] to-[#e85d1c] text-lg font-bold text-[var(--lw-text-on-brand)]"
          aria-hidden="true"
        >
          券
        </span>
        <p class="text-sm">
          本场暂无优惠券
        </p>
      </div>

      <ul
        v-else
        class="m-0 list-none divide-y divide-[var(--lw-border)] p-0"
      >
        <li
          v-for="item in coupons"
          :key="item.couponId"
          class="py-3"
        >
          <button
            type="button"
            class="coupon-ticket active:scale-[0.99] disabled:opacity-60"
            aria-label="领取优惠券"
            :disabled="claimingCouponId != null"
            @click="emit('claim', item)"
          >
            <div class="coupon-ticket-main">
              <span class="coupon-ticket-tag">优惠券</span>
              <div class="coupon-ticket-amount">
                <span class="yen">¥</span>{{ formatAmount(item.couponAmount) }}
              </div>
              <div class="coupon-ticket-name">
                {{ item.couponName }}
              </div>
              <div
                v-if="item.couponStartDate || item.couponEndDate"
                class="coupon-ticket-valid"
              >
                {{ formatValidity(item.couponStartDate, item.couponEndDate) }}
              </div>
            </div>
            <div
              class="coupon-ticket-action"
              aria-hidden="true"
            >
              <span class="coupon-ticket-claim">领取</span>
            </div>
          </button>
        </li>
      </ul>
    </div>
  </UiBottomSheet>
</template>

<style scoped>
.coupon-ticket {
  display: flex;
  width: 100%;
  align-items: stretch;
  padding: 0;
  border: none;
  border-radius: 10px;
  /* 深橙实底，白字对比清晰 */
  background: #e85a0c;
  color: #fff;
  text-align: left;
  text-shadow: 0 1px 2px rgb(80 25 0 / 32%);
  box-shadow: 0 6px 16px rgb(240 120 40 / 24%);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.coupon-ticket-main {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 12px 12px 12px 14px;
  overflow: hidden;
}

.coupon-ticket-main::after {
  content: "";
  position: absolute;
  right: -8px;
  top: -28px;
  width: 90px;
  height: 70px;
  border-radius: 50%;
  background: rgb(255 197 110 / 25%);
  pointer-events: none;
  z-index: 0;
}

.coupon-ticket-tag {
  position: relative;
  z-index: 1;
  display: inline-block;
  margin-bottom: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 28%);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.coupon-ticket-amount {
  position: relative;
  z-index: 1;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.coupon-ticket-amount .yen {
  margin-right: 2px;
  font-size: 14px;
  font-weight: 600;
}

.coupon-ticket-name {
  position: relative;
  z-index: 1;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 600;
  word-break: break-word;
}

.coupon-ticket-valid {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 96%);
}

.coupon-ticket-action {
  position: relative;
  display: flex;
  flex: none;
  width: 48px;
  align-items: center;
  justify-content: center;
  border-left: 1px dashed rgb(255 255 255 / 65%);
  background: rgb(255 255 255 / 14%);
}

.coupon-ticket-action::before,
.coupon-ticket-action::after {
  content: "";
  position: absolute;
  left: -6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--lw-bg-panel);
}

.coupon-ticket-action::before {
  top: -6px;
}

.coupon-ticket-action::after {
  bottom: -6px;
}

.coupon-ticket-claim {
  writing-mode: vertical-rl;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.28em;
  line-height: 1;
}
</style>
