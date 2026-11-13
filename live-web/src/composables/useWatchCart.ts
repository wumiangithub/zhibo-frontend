import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { listWatchProducts, reportWatchProductClick } from "@/api/watchProducts";
import {
  getViewerProductDetail,
  getViewerRiskStatus,
  listSelectableCoupons,
  listViewerProductsForBoundSpus,
  VIEWER_ORDER_SOURCE_LIVE,
  type SelectableCouponItem,
  type ViewerProductDetail,
} from "@/api/orderCenter";
import type { CartProductDisplay } from "@/components/watch/ProductSheet.vue";
import { useToast } from "@/composables/useToast";
import { useViewerOrderFlow } from "@/composables/useViewerOrderFlow";
import { isViewerLoggedIn } from "@/utils/viewerAuth";
import {
  saveViewerOrderCheckoutSession,
  type WatchOrderRoomMode,
} from "@/utils/viewerOrderCheckoutSession";

function formatYuan(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

/** 直播 / 回放共用小黄车拉数 + 去抢购确认单；风测 / 支付走独立路由。 */
export function useWatchCart(
  getActivityId: () => string,
  opts?: { watchMode?: WatchOrderRoomMode },
) {
  const router = useRouter();
  const { toast } = useToast();
  const { goToRisk, goToPay, createOrderFromSession } = useViewerOrderFlow();
  const watchMode = opts?.watchMode ?? "live";

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

    const activityId = getActivityId();
    void reportWatchProductClick(activityId, spuId).catch((e) => {
      console.warn("[watch] product click report failed", e);
    });

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

  function buildCheckoutSession() {
    const activityId = getActivityId()?.trim();
    const detail = checkoutDetail.value;
    if (!activityId || !detail?.sku) return null;
    return {
      activityId,
      watchMode,
      checkoutDetail: detail,
      selectedCouponUserId: selectedCouponUserId.value,
      coverImg: checkoutCoverImg.value,
    };
  }

  /**
   * 确认单「提交订单」：先查风测状态。
   * 满足风测 → 建单后进支付独立页；否则进风测独立页（仍不建单，答完再建）。
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

    try {
      const status = await getViewerRiskStatus(detail.sku.skuId);
      const skipRisk = status.riskValid && status.riskMatchProduct;

      const baseSession = buildCheckoutSession();
      if (!baseSession) {
        toast("活动或商品无效");
        return;
      }

      const couponsSnapshot = [...checkoutCoupons.value];

      if (skipRisk) {
        const riskGrade =
          status.riskLevelId > 0 ? `C${status.riskLevelId}` : "";
        const riskGradeName = status.riskLevelName;
        const session = {
          ...baseSession,
          riskGrade,
          riskGradeName,
          checkoutCoupons: couponsSnapshot,
        };
        saveViewerOrderCheckoutSession(session);
        checkoutOpen.value = false;
        couponPickerOpen.value = false;
        try {
          const orderId = await createOrderFromSession(session, couponsSnapshot);
          resetCheckout();
          goToPay(router, session, orderId, {
            riskGrade,
            riskGradeName,
          });
        } catch (e) {
          checkoutOpen.value = true;
          toast(e instanceof Error ? e.message : "创建订单失败");
        }
        return;
      }

      checkoutOpen.value = false;
      couponPickerOpen.value = false;
      resetCheckout();
      goToRisk(router, {
        ...baseSession,
        checkoutCoupons: couponsSnapshot,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败");
    } finally {
      checkoutSubmitting.value = false;
    }
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
  };
}
