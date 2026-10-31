import { ref } from "vue";
import { listWatchProducts } from "@/api/watchProducts";
import { listViewerProductsForBoundSpus } from "@/api/orderCenter";
import type { CartProductDisplay } from "@/components/watch/ProductSheet.vue";
import { isViewerLoggedIn } from "@/utils/viewerAuth";

/** 直播 / 回放共用小黄车拉数。 */
export function useWatchCart(getActivityId: () => string) {
  const cartOpen = ref(false);
  const cartLoading = ref(false);
  const cartError = ref("");
  const cartProducts = ref<CartProductDisplay[]>([]);
  let cartFetchSeq = 0;

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
          };
        }
        return {
          spuId: String(b.spuId),
          productName: b.productName || "未命名商品",
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

  return {
    cartOpen,
    cartLoading,
    cartError,
    cartProducts,
    openCart,
    closeCart,
  };
}
