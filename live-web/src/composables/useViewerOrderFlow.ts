import type { RouteLocationRaw, Router } from "vue-router";
import { getAudienceSalesman } from "@/api/audienceAttribute";
import {
  createViewerOrder,
  submitRiskTest,
  VIEWER_ORDER_SOURCE_LIVE,
  type RiskAnswerItem,
  type SelectableCouponItem,
} from "@/api/orderCenter";
import { useToast } from "@/composables/useToast";
import {
  isLikelyMiniProgramWebView,
  navigateToOrderCheckout,
} from "@/utils/miniProgram";
import { clearRiskQuizProgress } from "@/utils/riskQuizProgress";
import {
  loadViewerOrderCheckoutSession,
  patchViewerOrderCheckoutSession,
  saveViewerOrderCheckoutSession,
  type ViewerOrderCheckoutSession,
  type WatchOrderRoomMode,
} from "@/utils/viewerOrderCheckoutSession";
import { getViewerOrderCenterUsername } from "@/utils/viewerAuth";

async function resolveSalesman(
  activityId: string,
): Promise<{ salesmanId?: string; salesmanDeptId?: number }> {
  const id = activityId?.trim();
  if (!id) return {};
  try {
    const row = await getAudienceSalesman(id);
    if (!row?.salesmanId) return {};
    return {
      salesmanId: row.salesmanId,
      salesmanDeptId: row.salesmanDeptId,
    };
  } catch {
    return {};
  }
}

/** 创建订单 customerName：用观众 JWT 的 username（订单中心账号），不是展示昵称。 */
function resolveCustomerName(): string {
  return getViewerOrderCenterUsername().trim();
}

export function watchRoomRoute(
  activityId: string,
  mode: WatchOrderRoomMode,
): RouteLocationRaw {
  if (mode === "replay") {
    return { name: "watch-replay", params: { id: activityId } };
  }
  return { name: "watch", params: { id: activityId } };
}

export function useViewerOrderFlow() {
  const { toast } = useToast();

  async function createOrderFromSession(
    session: ViewerOrderCheckoutSession,
    coupons: SelectableCouponItem[],
  ): Promise<string> {
    const detail = session.checkoutDetail;
    if (!detail?.sku) throw new Error("商品信息已失效，请返回重新下单");
    const selected = session.selectedCouponUserId
      ? coupons.find((c) => c.couponUserId === session.selectedCouponUserId)
      : null;
    const salesman = await resolveSalesman(session.activityId);
    const created = await createViewerOrder({
      productId: detail.spuId,
      productSkuId: detail.sku.skuId,
      customerName: resolveCustomerName(),
      orderSource: VIEWER_ORDER_SOURCE_LIVE,
      couponId: selected?.couponId,
      salesmanId: salesman.salesmanId,
      salesmanDeptId: salesman.salesmanDeptId,
    });
    patchViewerOrderCheckoutSession(session.activityId, {
      pendingOrderId: created.orderId,
    });
    return created.orderId;
  }

  function goToRisk(router: Router, session: ViewerOrderCheckoutSession): void {
    saveViewerOrderCheckoutSession(session);
    void router.push({
      name: "watch-order-risk",
      params: { id: session.activityId },
    });
  }

  function goToPay(
    router: Router,
    session: ViewerOrderCheckoutSession,
    orderId: string,
    risk?: { riskGrade: string; riskGradeName: string },
  ): void {
    const riskGrade = risk?.riskGrade ?? session.riskGrade;
    const riskGradeName = risk?.riskGradeName ?? session.riskGradeName;
    saveViewerOrderCheckoutSession({
      ...session,
      pendingOrderId: orderId,
      riskGrade,
      riskGradeName,
    });

    // 小程序 web-view：整页跳原生收银台，勿再进 H5 OrderPayOverlay
    if (isLikelyMiniProgramWebView()) {
      void navigateToOrderCheckout({
        orderId,
        activityId: session.activityId,
        coverImg: session.coverImg || session.checkoutDetail?.coverImg,
        riskGrade,
        riskGradeName,
      }).then((ok) => {
        if (!ok) toast("无法打开支付页，请重试");
      });
      return;
    }

    void router.push({
      name: "watch-order-pay",
      params: { id: session.activityId },
      query: { orderId },
    });
  }

  async function submitRiskAnswers(
    activityId: string,
    answers: RiskAnswerItem[],
    coupons?: SelectableCouponItem[],
  ): Promise<
    | { ok: true; orderId: string; riskGrade: string; riskGradeName: string }
    | { ok: false; error: string }
  > {
    const session = loadViewerOrderCheckoutSession(activityId);
    if (!session?.checkoutDetail?.sku) {
      return { ok: false, error: "商品信息已失效，请返回重新下单" };
    }

    const couponList = coupons ?? session.checkoutCoupons ?? [];

    let orderId = session.pendingOrderId?.trim() || "";
    try {
      if (!orderId) {
        orderId = await createOrderFromSession(session, couponList);
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "创建订单失败",
      };
    }

    if (!orderId) {
      return { ok: false, error: "创建订单失败，请重试" };
    }

    try {
      const result = await submitRiskTest({ answers, orderId });
      const riskGrade = result.riskGrade?.trim() || "";
      const riskGradeName = result.riskGradeName?.trim() || "";
      clearRiskQuizProgress();
      patchViewerOrderCheckoutSession(activityId, {
        pendingOrderId: orderId,
        riskGrade,
        riskGradeName,
      });
      return { ok: true, orderId, riskGrade, riskGradeName };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交风测失败";
      toast(msg);
      return { ok: false, error: msg };
    }
  }

  return {
    createOrderFromSession,
    goToRisk,
    goToPay,
    submitRiskAnswers,
    watchRoomRoute,
  };
}
