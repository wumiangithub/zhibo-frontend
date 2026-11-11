<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { ViewerOrderPaidDetail, ViewerPrepayResult } from "@/api/orderCenter";
import OrderPayOverlay from "@/components/watch/OrderPayOverlay.vue";
import { usePayResultWait } from "@/composables/usePayResultWait";
import { useToast } from "@/composables/useToast";
import { watchRoomRoute } from "@/composables/useViewerOrderFlow";
import {
  isLikelyMiniProgramWebView,
  navigateToOrderCheckout,
} from "@/utils/miniProgram";
import { backOrReplace } from "@/utils/navigation";
import { loadViewerOrderCheckoutSession } from "@/utils/viewerOrderCheckoutSession";
import {
  saveViewerPendingPaySession,
  type ViewerPendingPaySession,
} from "@/utils/viewerPendingPaySession";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const activityId = String(route.params.id ?? "").trim();
const resolvedOrderId = ref("");
const ready = ref(false);
const coverImg = ref<string | undefined>();
const riskGrade = ref("");
const riskGradeName = ref("");

const {
  timeoutDialogOpen,
  confirming,
  markAwaitingAfterInvoke,
  onConfirmPaid,
  onCancelPay,
} = usePayResultWait({
  activityId,
  onPaid: goPaySuccess,
  onStillUnpaid: () => toast("暂未查到支付结果，请稍后再试"),
});

onMounted(() => {
  const session = loadViewerOrderCheckoutSession(activityId);
  const id =
    String(route.query.orderId ?? "").trim() ||
    session?.pendingOrderId?.trim() ||
    "";
  if (!id) {
    toast("订单无效，请从直播间重新下单");
    void router.replace(
      watchRoomRoute(activityId, session?.watchMode ?? "live"),
    );
    return;
  }
  coverImg.value = session?.coverImg || session?.checkoutDetail?.coverImg;
  riskGrade.value = session?.riskGrade ?? "";
  riskGradeName.value = session?.riskGradeName ?? "";
  resolvedOrderId.value = id;

  // 深链/回退落到 H5 支付路由时，小程序内仍改走原生收银台
  if (isLikelyMiniProgramWebView()) {
    void navigateToOrderCheckout({
      orderId: id,
      activityId,
      coverImg: coverImg.value,
      riskGrade: riskGrade.value,
      riskGradeName: riskGradeName.value,
    }).then((ok) => {
      if (!ok) {
        toast("无法打开支付页，请重试");
        ready.value = true;
        return;
      }
      leavePay();
    });
    return;
  }

  ready.value = true;
});

function leavePay() {
  const session = loadViewerOrderCheckoutSession(activityId);
  const mode = session?.watchMode ?? "live";
  backOrReplace(router, watchRoomRoute(activityId, mode));
}

function goPaySuccess(pending: ViewerPendingPaySession) {
  void router.replace({
    name: "watch-order-pay-success",
    params: { id: activityId },
    query: { orderId: pending.orderId },
  });
}

function onConfirmPay(payload: {
  orderId: string;
  payChannel: "wechat" | "alipay";
  detail: ViewerOrderPaidDetail;
  prepay: ViewerPrepayResult;
  deferredAlipayCopy?: boolean;
}) {
  if (!payload.prepay.chargeId) return;

  saveViewerPendingPaySession({
    activityId,
    orderId: payload.orderId,
    chargeId: payload.prepay.chargeId,
    channel: payload.prepay.channel,
  });

  if (payload.deferredAlipayCopy) {
    toast("链接已复制，请在浏览器中打开并完成支付");
    markAwaitingAfterInvoke();
    return;
  }

  const willRedirect =
    payload.prepay.channel.includes("wap") ||
    payload.prepay.channel === "alipay" ||
    payload.prepay.channel === "wx";

  if (!willRedirect) {
    // 未跳转收银台（如 stub）：页内开始轮询
    markAwaitingAfterInvoke();
  }

  toast(
    willRedirect || payload.prepay.credential
      ? "已跳转收银台，请完成支付"
      : `支付单已创建（${payload.prepay.chargeId}）`,
  );
}

function handleConfirmPaid() {
  void onConfirmPaid();
}
</script>

<template>
  <OrderPayOverlay
    v-if="ready"
    :open="true"
    :order-id="resolvedOrderId"
    :cover-img="coverImg"
    :risk-grade="riskGrade"
    :risk-grade-name="riskGradeName"
    @close="leavePay"
    @pay="onConfirmPay"
  />

  <Teleport to="body">
    <div
      v-if="timeoutDialogOpen"
      class="pay-wait-mask"
      role="dialog"
      aria-modal="true"
      aria-label="支付确认"
    >
      <div class="pay-wait-card">
        <h3>未查到支付结果</h3>
        <p>若你已完成付款，可点「我已支付」再次确认；也可取消本次等待。</p>
        <div class="pay-wait-actions">
          <button
            type="button"
            class="pay-wait-cancel"
            :disabled="confirming"
            @click="onCancelPay"
          >
            取消支付
          </button>
          <button
            type="button"
            class="pay-wait-ok"
            :disabled="confirming"
            @click="handleConfirmPaid"
          >
            {{ confirming ? "查询中…" : "我已支付" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pay-wait-mask {
  position: fixed;
  inset: 0;
  z-index: 260;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}

.pay-wait-card {
  width: 100%;
  max-width: 360px;
  padding: 20px 18px 16px;
  border-radius: 12px;
  background: #fff;
  color: #1f2329;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
}

.pay-wait-card h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  text-align: center;
}

.pay-wait-card p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #5c6570;
  text-align: center;
}

.pay-wait-actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.pay-wait-cancel,
.pay-wait-ok {
  flex: 1;
  height: 42px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.pay-wait-cancel {
  border: 1px solid #d5dbe6;
  background: #fff;
  color: #5c6570;
}

.pay-wait-ok {
  border: 0;
  background: #2f6bff;
  color: #fff;
}

.pay-wait-cancel:disabled,
.pay-wait-ok:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
