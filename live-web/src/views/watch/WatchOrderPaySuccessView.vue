<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getViewerCustomerByOrderId,
  getViewerOrderPaidInfo,
  isViewerCustomerRealNamed,
  type ViewerOrderPaidInfo,
} from "@/api/orderCenter";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { watchRoomRoute } from "@/composables/useViewerOrderFlow";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { backOrHome, backOrReplace } from "@/utils/navigation";
import { loadViewerOrderCheckoutSession } from "@/utils/viewerOrderCheckoutSession";

const MERCHANT_NAME = "四川钱坤云智能科技有限公司";

const route = useRoute();
const router = useRouter();

const activityId = String(route.params.id ?? "").trim();
const orderId = String(route.query.orderId ?? "").trim();
const inMiniProgram = isLikelyMiniProgramWebView();

const loading = ref(true);
const error = ref("");
const paidInfo = ref<ViewerOrderPaidInfo | null>(null);
const realNamed = ref(false);

const moneyText = computed(() => {
  const raw = paidInfo.value?.orderMoney?.trim() || "";
  if (!raw) return "¥0.00";
  if (raw.startsWith("¥")) return raw;
  const n = Number(raw);
  if (Number.isFinite(n)) return `¥${n.toFixed(2)}`;
  return `¥${raw}`;
});

onMounted(() => {
  if (!orderId) {
    error.value = "订单无效";
    loading.value = false;
    return;
  }
  void loadPage();
});

async function loadPage() {
  loading.value = true;
  error.value = "";
  try {
    const [info, customer] = await Promise.all([
      getViewerOrderPaidInfo(orderId),
      getViewerCustomerByOrderId(orderId).catch(() => null),
    ]);
    paidInfo.value = info;
    realNamed.value = isViewerCustomerRealNamed(customer);
  } catch (e) {
    paidInfo.value = null;
    error.value = e instanceof Error ? e.message : "加载支付结果失败";
  } finally {
    loading.value = false;
  }
}

function goBack() {
  const session = loadViewerOrderCheckoutSession(activityId);
  backOrReplace(
    router,
    watchRoomRoute(activityId, session?.watchMode ?? "live"),
  );
}

function goHome() {
  backOrHome(router);
}

function goRealName() {
  void router.push({
    name: "watch-order-realname",
    params: { id: activityId },
    query: { orderId },
  });
}
</script>

<template>
  <div class="success-root">
    <UiPageHeader
      v-if="!inMiniProgram"
      title="支付成功"
      back-text=""
      @back="goBack"
    />

    <div class="success-body">
      <div
        v-if="loading"
        class="success-state"
      >
        <span class="success-spinner" />
        <p>加载中…</p>
      </div>

      <div
        v-else-if="error"
        class="success-state"
      >
        <p class="success-error">
          {{ error }}
        </p>
        <button
          type="button"
          class="success-retry"
          @click="loadPage"
        >
          重试
        </button>
      </div>

      <template v-else>
        <div class="success-hero">
          <span
            class="success-check"
            aria-hidden="true"
          >✓</span>
          <h2 class="success-title">
            支付成功
          </h2>
        </div>

        <p class="success-merchant">
          {{ MERCHANT_NAME }}
        </p>
        <p class="success-amount">
          {{ moneyText }}
        </p>

        <div
          v-if="!realNamed"
          class="success-notice"
        >
          <svg
            class="success-notice-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <path
              d="M9.5 12.2l1.8 1.8 3.4-3.6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <p>
            支付已完成，根据监管要求，您还需同步完成实名认证与签署合同，商品服务才会正式生效。
          </p>
        </div>

        <div class="success-actions">
          <button
            v-if="!realNamed"
            type="button"
            class="success-primary"
            @click="goRealName"
          >
            下一步：去实名认证
          </button>
          <button
            v-else
            type="button"
            class="success-primary"
            @click="goHome"
          >
            返回首页
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.success-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.success-body {
  flex: 1;
  padding: 48px 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 80px;
  color: #8a9199;
  font-size: 14px;
}

.success-spinner {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid #d5dbe6;
  border-top-color: #8a9199;
  animation: success-spin 0.8s linear infinite;
}

@keyframes success-spin {
  to {
    transform: rotate(360deg);
  }
}

.success-error {
  margin: 0;
  color: #f5222d;
  text-align: center;
}

.success-retry {
  height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #2f6bff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.success-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: #22c55e;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.success-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.success-merchant {
  margin: 28px 0 0;
  font-size: 14px;
  color: #5c6570;
}

.success-amount {
  margin: 10px 0 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.success-notice {
  margin-top: 28px;
  width: 100%;
  max-width: 420px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 10px;
  background: #eefaf2;
  color: #1a9f4b;
  font-size: 13px;
  line-height: 1.55;
  box-sizing: border-box;
}

.success-notice p {
  margin: 0;
}

.success-notice-icon {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 1px;
}

.success-actions {
  margin-top: auto;
  width: 100%;
  max-width: 420px;
  padding-top: 40px;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.success-primary {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #2f6bff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.success-primary:active {
  background: #2558db;
}
</style>
