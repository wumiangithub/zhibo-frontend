<script setup lang="ts">
import { computed } from "vue";
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import type { SelectableCouponItem } from "@/api/orderCenter";

const props = defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  productName: string;
  coverImg?: string;
  validityText?: string;
  /** 实付（扣券后），两位小数文案，无 ¥ 前缀 */
  payPriceText: string;
  coupons: SelectableCouponItem[];
  couponsLoading: boolean;
  selectedCouponUserId: string | null;
  couponPickerOpen: boolean;
  /** 创建订单中 */
  submitting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  openCoupons: [];
  closeCoupons: [];
  selectCoupon: [couponUserId: string | null];
  submit: [];
}>();

const selectedCoupon = computed(() => {
  if (!props.selectedCouponUserId) return null;
  return props.coupons.find((c) => c.couponUserId === props.selectedCouponUserId) ?? null;
});

const couponRowText = computed(() => {
  if (props.couponsLoading) return "加载中…";
  if (selectedCoupon.value) {
    return `-¥${formatAmount(selectedCoupon.value.couponAmount)}`;
  }
  if (props.coupons.length > 0) return `${props.coupons.length}张可用`;
  return "无可用优惠券";
});

/** 有券 / 已选券时右侧用品牌色，无券保持弱化 */
const couponValueTone = computed(() => {
  if (props.couponsLoading) return "muted";
  if (selectedCoupon.value || props.coupons.length > 0) return "accent";
  return "muted";
});

const headerTitle = computed(() => props.productName || "确认订单");

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n)) return n.toFixed(2);
  return raw.trim() || "0.00";
}
</script>

<template>
  <UiBottomSheet
    :open="open"
    :aria-label="headerTitle"
    max-height-class="max-h-[78dvh]"
    @close="emit('close')"
  >
    <template #header>
      <div class="checkout-header">
        <h2 class="checkout-header-title">
          {{ headerTitle }}
        </h2>
        <button
          type="button"
          class="checkout-header-close"
          aria-label="关闭"
          @click="emit('close')"
        >
          <svg
            class="checkout-header-x"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </template>

    <div class="checkout">
      <div
        v-if="loading"
        class="checkout-state"
      >
        <span class="checkout-spinner" />
        <p>加载中…</p>
      </div>

      <div
        v-else-if="error"
        class="checkout-state"
      >
        <p class="checkout-error">
          {{ error }}
        </p>
      </div>

      <template v-else>
        <div class="checkout-product">
          <div class="checkout-cover">
            <img
              v-if="coverImg"
              :src="coverImg"
              alt=""
              class="checkout-cover-img"
            >
            <div
              v-else
              class="checkout-cover-empty"
              aria-hidden="true"
            >
              <svg
                class="checkout-cover-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke-width="1.5"
                />
                <circle
                  cx="8.5"
                  cy="10"
                  r="1.5"
                  stroke-width="1.5"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21 16l-5.5-5.5L7 19"
                />
              </svg>
            </div>
          </div>
          <div class="checkout-meta">
            <p class="checkout-pay-row">
              <span class="checkout-pay-label">实付价</span>
              <span class="checkout-pay-price">
                <span class="checkout-yen">¥</span>
                <span class="checkout-pay-num">{{ payPriceText }}</span>
              </span>
            </p>
            <p class="checkout-name">
              {{ productName || "商品" }}
            </p>
            <p
              v-if="validityText"
              class="checkout-validity"
            >
              {{ validityText }}
            </p>
          </div>
        </div>

        <div class="checkout-coupon-wrap">
          <button
            type="button"
            class="checkout-coupon-row"
            :disabled="couponsLoading"
            @click="emit('openCoupons')"
          >
            <span class="checkout-coupon-label">优惠券/码</span>
            <span
              class="checkout-coupon-value"
              :class="couponValueTone"
            >
              <span class="checkout-coupon-text">{{ couponRowText }}</span>
              <svg
                class="checkout-chevron"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </button>
        </div>
      </template>
    </div>

    <template
      v-if="!loading && !error"
      #footer
    >
      <div class="checkout-bar">
        <p class="checkout-bar-price">
          <span class="checkout-bar-label">合计</span>
          <span class="checkout-bar-yen">¥</span>
          <span class="checkout-bar-num">{{ payPriceText }}</span>
        </p>
        <button
          type="button"
          class="checkout-submit"
          :disabled="submitting"
          @click="emit('submit')"
        >
          {{ submitting ? "提交中…" : "提交订单" }}
        </button>
      </div>
    </template>
  </UiBottomSheet>

  <UiBottomSheet
    :open="couponPickerOpen"
    title="选择优惠券"
    z-index-class="z-[120]"
    @close="emit('closeCoupons')"
  >
    <div class="coupon-picker">
      <button
        type="button"
        class="coupon-pick-item"
        :class="{ active: !selectedCouponUserId }"
        @click="emit('selectCoupon', null)"
      >
        <span>不使用优惠券</span>
        <span
          v-if="!selectedCouponUserId"
          class="coupon-check"
        >✓</span>
      </button>
      <button
        v-for="c in coupons"
        :key="c.couponUserId"
        type="button"
        class="coupon-pick-item"
        :class="{ active: selectedCouponUserId === c.couponUserId }"
        @click="emit('selectCoupon', c.couponUserId)"
      >
        <span class="coupon-pick-main">
          <span class="coupon-pick-top">
            <span class="coupon-pick-name">{{ c.couponName }}</span>
            <span class="coupon-pick-amount">-¥{{ formatAmount(c.couponAmount) }}</span>
          </span>
          <span
            v-if="c.validPeriodText"
            class="coupon-pick-period"
          >{{ c.validPeriodText }}</span>
        </span>
        <span
          v-if="selectedCouponUserId === c.couponUserId"
          class="coupon-check"
        >✓</span>
      </button>
      <p
        v-if="coupons.length === 0"
        class="coupon-pick-empty"
      >
        无可用优惠券
      </p>
    </div>
  </UiBottomSheet>
</template>

<style scoped>
.checkout-header {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 12px 18px;
  border-bottom: 1px solid var(--lw-border);
}

.checkout-header-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--lw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkout-header-close {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: -2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.checkout-header-close:active {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
}

.checkout-header-x {
  width: 18px;
  height: 18px;
}

.checkout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 0;
}

.checkout-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 16px;
  color: var(--lw-text-secondary);
  font-size: 14px;
}

.checkout-error {
  margin: 0;
  color: var(--lw-color-danger);
}

.checkout-spinner {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid var(--lw-border-strong);
  border-top-color: var(--lw-text-secondary);
  animation: checkout-spin 0.8s linear infinite;
}

@keyframes checkout-spin {
  to {
    transform: rotate(360deg);
  }
}

.checkout-product {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 4px 16px 18px;
  background: var(--lw-bg-chrome);
}

.checkout-cover {
  flex: none;
  width: 80px;
  height: 80px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--lw-bg-elevated);
}

.checkout-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.checkout-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--lw-text-muted);
}

.checkout-cover-icon {
  width: 28px;
  height: 28px;
  opacity: 0.55;
}

.checkout-meta {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.checkout-pay-row {
  margin: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 2px;
  line-height: 1.15;
}

.checkout-pay-label {
  margin-right: 2px;
  font-size: 13px;
  font-weight: 400;
  color: var(--lw-text-secondary);
}

.checkout-pay-price {
  display: inline-flex;
  align-items: baseline;
  color: var(--lw-color-brand);
}

.checkout-yen {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  margin-right: 1px;
}

.checkout-pay-num {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
}

.checkout-name {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--lw-text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}

.checkout-validity {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--lw-text-muted);
}

.checkout-coupon-wrap {
  flex: 1;
  padding: 12px 12px 16px;
  background: var(--lw-bg-panel);
}

.checkout-coupon-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  background: var(--lw-bg-chrome);
  color: var(--lw-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.checkout-coupon-row:disabled {
  opacity: 0.75;
  cursor: default;
}

.checkout-coupon-row:not(:disabled):active {
  background: var(--lw-bg-bubble);
}

.checkout-coupon-label {
  flex: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--lw-text-primary);
}

.checkout-coupon-value {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}

.checkout-coupon-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkout-coupon-value.muted {
  color: var(--lw-text-muted);
}

.checkout-coupon-value.accent {
  color: var(--lw-color-brand);
  font-weight: 500;
}

.checkout-chevron {
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--lw-text-muted);
}

.checkout-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--lw-bg-chrome);
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.04);
}

.checkout-bar-price {
  margin: 0;
  min-width: 0;
  display: flex;
  align-items: baseline;
  color: var(--lw-color-brand);
  font-variant-numeric: tabular-nums;
}

.checkout-bar-label {
  margin-right: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--lw-text-secondary);
}

.checkout-bar-yen {
  font-size: 14px;
  font-weight: 600;
  margin-right: 1px;
}

.checkout-bar-num {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}

.checkout-submit {
  flex: none;
  height: 44px;
  min-width: 132px;
  padding: 0 28px;
  border: 0;
  border-radius: 22px;
  background: var(--lw-color-brand);
  color: var(--lw-text-on-brand);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.checkout-submit:disabled {
  opacity: 0.65;
  cursor: default;
}

.checkout-submit:not(:disabled):active {
  background: var(--lw-color-brand-hover);
}

.coupon-picker {
  padding: 4px 8px 16px;
}

.coupon-pick-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px;
  border: 0;
  border-bottom: 1px solid var(--lw-border);
  background: transparent;
  color: var(--lw-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.coupon-pick-item:last-of-type {
  border-bottom: 0;
}

.coupon-pick-item.active {
  color: var(--lw-color-brand);
}

.coupon-pick-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.coupon-pick-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.coupon-pick-name {
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.coupon-pick-amount {
  flex: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--lw-color-brand);
  font-variant-numeric: tabular-nums;
}

.coupon-pick-period {
  font-size: 12px;
  color: var(--lw-text-muted);
}

.coupon-check {
  flex: none;
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-color-brand);
}

.coupon-pick-empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: var(--lw-text-muted);
}
</style>
