import { computed, ref } from "vue";
import { getAudienceSalesman } from "@/api/audienceAttribute";
import { listWatchProducts } from "@/api/watchProducts";
import { getStoredNickname } from "@/api/watch";
import {
  createViewerOrder,
  getViewerProductDetail,
  getViewerRiskStatus,
  listSelectableCoupons,
  listViewerProductsForBoundSpus,
  submitRiskTest,
  VIEWER_ORDER_SOURCE_LIVE,
  type RiskAnswerItem,
  type SelectableCouponItem,
  type ViewerProductDetail,
} from "@/api/orderCenter";
import type { CartProductDisplay } from "@/components/watch/ProductSheet.vue";
import { useToast } from "@/composables/useToast";
import {
  getViewerProfile,
  isViewerLoggedIn,
} from "@/utils/viewerAuth";
import { clearRiskQuizProgress } from "@/utils/riskQuizProgress";

function formatYuan(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

/** 本场业务员：activity_audience 邀请人优先，否则导入人；失败/皆无则不下传。 */
async function resolveSalesmanId(activityId: string): Promise<string | undefined> {
  const id = activityId?.trim();
  if (!id) return undefined;
  try {
    const salesmanId = await getAudienceSalesman(id);
    if (salesmanId != null && salesmanId > 0) return String(salesmanId);
  } catch {
    /* 无关系行或接口失败：订单中心 salesmanId 可选 */
  }
  return undefined;
}

function resolveCustomerName(): string {
  const nick = getStoredNickname()?.trim();
  if (nick) return nick;
  const profileNick = getViewerProfile().nickname?.trim();
  if (profileNick) return profileNick;
  return "微信用户";
}

/** 直播 / 回放共用小黄车拉数 + 去抢购确认单 + 风测 + 支付页。 */
export function useWatchCart(getActivityId: () => string) {
  const { toast } = useToast();
  const cartOpen = ref(false);
  const cartLoading = ref(false);
  const cartError = ref("");
  const cartProducts = ref<CartProductDisplay[]>([]);
  let cartFetchSeq = 0;

  const checkoutOpen = ref(false);
  const checkoutLoading = ref(false);
  const checkoutError = ref("");
  const checkoutDetail = ref<ViewerProductDetail | null>(null);
  const checkoutCoupons = ref<SelectableCouponItem[]>([]);
  const checkoutCouponsLoading = ref(false);
  const selectedCouponUserId = ref<string | null>(null);
  const couponPickerOpen = ref(false);
  const checkoutSubmitting = ref(false);
  let checkoutSeq = 0;

  const checkoutProductName = computed(
    () => checkoutDetail.value?.productName?.trim() || "",
  );
  const checkoutCoverImg = computed(() => checkoutDetail.value?.coverImg);
  const checkoutValidityText = computed(() => checkoutDetail.value?.validityText);

  const checkoutBasePrice = computed(() => {
    const p = checkoutDetail.value?.sku?.payPrice;
    return p != null && Number.isFinite(p) && p > 0 ? p : 0;
  });

  const selectedCouponAmount = computed(() => {
    const id = selectedCouponUserId.value;
    if (!id) return 0;
    const c = checkoutCoupons.value.find((x) => x.couponUserId === id);
    if (!c) return 0;
    const n = Number(c.couponAmount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });

  const checkoutPayPriceText = computed(() => {
    const pay = Math.max(0, checkoutBasePrice.value - selectedCouponAmount.value);
    return formatYuan(pay);
  });

  const riskOpen = ref(false);
  const riskSubmitting = ref(false);
  const riskSubmitError = ref("");
  const pendingOrderId = ref("");
  const riskGrade = ref("");
  const riskGradeName = ref("");

  const payOpen = ref(false);

  async function openCart() {
    cartOpen.value = true;
    const seq = ++cartFetchSeq;
    cartLoading.value = true;
    cartError.value = "";
    cartProducts.value = [];

    if (!isViewerLoggedIn()) {
      cartLoading.value = false;
      cartError.value = "请先登录后再查看商品";
      return;
    }

    const id = getActivityId()?.trim();
    if (!id) {
      cartLoading.value = false;
      cartError.value = "活动无效";
      return;
    }

    try {
      const meta = await listWatchProducts(id);
      if (seq !== cartFetchSeq) return;

      const bound = meta.list ?? [];
      if (bound.length === 0) {
        cartProducts.value = [];
        return;
      }

      const boundIds = bound.map((b) => String(b.spuId)).filter(Boolean);
      const fromOc = await listViewerProductsForBoundSpus(boundIds);
      if (seq !== cartFetchSeq) return;

      // by-ids 只回上架；绑定但未出现 → 仍展示，标下架（用本站快照名）
      const bySpu = new Map(fromOc.map((p) => [p.spuId, p]));
      cartProducts.value = bound.map((b) => {
        const oc = bySpu.get(String(b.spuId));
        if (oc) {
          return {
            spuId: oc.spuId,
            productName: oc.productName || b.productName || "未命名商品",
            coverImg: oc.coverImg,
            priceText: oc.priceText,
            validityText: oc.validityText,
            typeLabel: oc.typeLabel || "课程",
            offShelf: false,
          };
        }
        return {
          spuId: String(b.spuId),
          productName: b.productName || "未命名商品",
          typeLabel: "课程",
          offShelf: true,
        };
      });
    } catch (e) {
      if (seq !== cartFetchSeq) return;
      cartProducts.value = [];
      cartError.value = e instanceof Error ? e.message : "加载商品失败";
    } finally {
      if (seq === cartFetchSeq) cartLoading.value = false;
    }
  }

  function closeCart() {
    cartOpen.value = false;
  }

  function resetCheckout() {
    checkoutDetail.value = null;
    checkoutCoupons.value = [];
    checkoutCouponsLoading.value = false;
    selectedCouponUserId.value = null;
    couponPickerOpen.value = false;
    checkoutError.value = "";
    checkoutLoading.value = false;
    checkoutSubmitting.value = false;
  }

  function closeCheckout() {
    checkoutOpen.value = false;
    couponPickerOpen.value = false;
    checkoutSeq += 1;
    resetCheckout();
  }

  async function loadSelectableCoupons(skuId: string, seq: number) {
    checkoutCouponsLoading.value = true;
    try {
      const list = await listSelectableCoupons({
        skuId,
        orderSource: VIEWER_ORDER_SOURCE_LIVE,
      });
      if (seq !== checkoutSeq) return;
      checkoutCoupons.value = list;
      if (
        selectedCouponUserId.value &&
        !list.some((c) => c.couponUserId === selectedCouponUserId.value)
      ) {
        selectedCouponUserId.value = null;
      }
    } catch (e) {
      if (seq !== checkoutSeq) return;
      checkoutCoupons.value = [];
      selectedCouponUserId.value = null;
      toast(e instanceof Error ? e.message : "拉取可用券失败");
    } finally {
      if (seq === checkoutSeq) checkoutCouponsLoading.value = false;
    }
  }

  /**
   * 去抢购：关小黄车 → 商品详情取 SKU → 可用券 → 确认单弹层。
   */
  async function buyProduct(item: CartProductDisplay) {
    if (item.offShelf) {
      toast("该商品已下架");
      return;
    }
    if (!isViewerLoggedIn()) {
      toast("请先登录后再购买");
      return;
    }
    const spuId = item.spuId?.trim();
    if (!spuId) {
      toast("商品无效");
      return;
    }

    cartOpen.value = false;
    const seq = ++checkoutSeq;
    checkoutOpen.value = true;
    resetCheckout();
    checkoutLoading.value = true;

    checkoutDetail.value = {
      spuId,
      productName: item.productName || "未命名商品",
      coverImg: item.coverImg,
      sku: null,
      skuList: [],
      validityText: item.validityText,
    };

    try {
      const detail = await getViewerProductDetail(spuId);
      if (seq !== checkoutSeq) return;
      checkoutDetail.value = {
        ...detail,
        coverImg: detail.coverImg || item.coverImg,
        validityText: detail.validityText || item.validityText,
        productName: detail.productName || item.productName || "未命名商品",
      };

      if (!detail.sku) {
        checkoutError.value = "该商品暂无可购规格";
        return;
      }

      await loadSelectableCoupons(detail.sku.skuId, seq);
      if (seq !== checkoutSeq) return;
    } catch (e) {
      if (seq !== checkoutSeq) return;
      checkoutError.value = e instanceof Error ? e.message : "加载商品失败";
    } finally {
      if (seq === checkoutSeq) checkoutLoading.value = false;
    }
  }

  function openCouponPicker() {
    if (checkoutLoading.value || checkoutError.value) return;
    couponPickerOpen.value = true;
  }

  function closeCouponPicker() {
    couponPickerOpen.value = false;
  }

  function selectCoupon(couponUserId: string | null) {
    selectedCouponUserId.value = couponUserId;
    couponPickerOpen.value = false;
  }

  /** 用确认单缓存建单；成功写入 pendingOrderId */
  async function createOrderFromCheckout(): Promise<string> {
    const detail = checkoutDetail.value;
    if (!detail?.sku) throw new Error("商品信息已失效，请返回重新下单");
    const selected = selectedCouponUserId.value
      ? checkoutCoupons.value.find((c) => c.couponUserId === selectedCouponUserId.value)
      : null;
    const salesmanId = await resolveSalesmanId(getActivityId());
    const created = await createViewerOrder({
      productId: detail.spuId,
      productSkuId: detail.sku.skuId,
      customerName: resolveCustomerName(),
      orderSource: VIEWER_ORDER_SOURCE_LIVE,
      couponId: selected?.couponId,
      salesmanId,
    });
    pendingOrderId.value = created.orderId;
    return created.orderId;
  }

  /**
   * 确认单「提交订单」：先查风测状态。
   * risk_valid && risk_match_product → 跳过风测，直接建单进支付页；
   * 否则关确认单、开风测（仍不建单，答完再建）。
   */
  async function submitCheckoutOrder() {
    if (checkoutSubmitting.value || checkoutLoading.value || checkoutError.value) {
      return;
    }
    const detail = checkoutDetail.value;
    if (!detail?.sku) {
      toast("暂无可购规格");
      return;
    }

    checkoutSubmitting.value = true;
    pendingOrderId.value = "";
    riskGrade.value = "";
    riskGradeName.value = "";
    riskSubmitError.value = "";
    riskSubmitting.value = false;

    try {
      const status = await getViewerRiskStatus(detail.sku.skuId);
      const skipRisk = status.riskValid && status.riskMatchProduct;

      checkoutOpen.value = false;
      couponPickerOpen.value = false;

      if (skipRisk) {
        riskGrade.value = status.riskLevelId > 0 ? `C${status.riskLevelId}` : "";
        riskGradeName.value = status.riskLevelName;
        await createOrderFromCheckout();
        if (!pendingOrderId.value) {
          toast("创建订单失败，请重试");
          checkoutOpen.value = true;
          return;
        }
        payOpen.value = true;
        return;
      }

      riskOpen.value = true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败");
    } finally {
      checkoutSubmitting.value = false;
    }
  }

  function closeRiskAssessment() {
    riskOpen.value = false;
    riskSubmitting.value = false;
    riskSubmitError.value = "";
  }

  /**
   * 风测答完提交：无 orderId 时先 create，再 submitRisk；已有 orderId 则只重试风测。
   * 建单失败留在风测页；风测失败保留 orderId 可再试。
   */
  async function onRiskAnswersSubmit(answers: RiskAnswerItem[]) {
    if (riskSubmitting.value) return;
    if (!checkoutDetail.value?.sku) {
      riskSubmitError.value = "商品信息已失效，请返回重新下单";
      return;
    }

    riskSubmitting.value = true;
    riskSubmitError.value = "";
    try {
      if (!pendingOrderId.value) {
        await createOrderFromCheckout();
      }

      const orderId = pendingOrderId.value;
      if (!orderId) {
        riskSubmitError.value = "创建订单失败，请重试";
        return;
      }

      try {
        const result = await submitRiskTest({ answers, orderId });
        riskGrade.value = result.riskGrade?.trim() || "";
        riskGradeName.value = result.riskGradeName?.trim() || "";
        clearRiskQuizProgress();
        riskOpen.value = false;
        riskSubmitError.value = "";
        payOpen.value = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "提交风测失败";
        riskSubmitError.value = msg;
        toast(msg);
      }
    } catch (e) {
      riskSubmitError.value = e instanceof Error ? e.message : "创建订单失败";
    } finally {
      riskSubmitting.value = false;
    }
  }

  function closePay() {
    payOpen.value = false;
  }

  function onConfirmPay() {
    // 后续接 prepay
    toast("支付功能开发中");
  }

  return {
    cartOpen,
    cartLoading,
    cartError,
    cartProducts,
    openCart,
    closeCart,
    buyProduct,

    checkoutOpen,
    checkoutLoading,
    checkoutError,
    checkoutProductName,
    checkoutCoverImg,
    checkoutValidityText,
    checkoutPayPriceText,
    checkoutCoupons,
    checkoutCouponsLoading,
    selectedCouponUserId,
    couponPickerOpen,
    checkoutSubmitting,
    closeCheckout,
    openCouponPicker,
    closeCouponPicker,
    selectCoupon,
    submitCheckoutOrder,

    riskOpen,
    riskSubmitting,
    riskSubmitError,
    pendingOrderId,
    riskGrade,
    riskGradeName,
    closeRiskAssessment,
    onRiskAnswersSubmit,

    payOpen,
    closePay,
    onConfirmPay,
  };
}
