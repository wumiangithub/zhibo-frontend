import { computed, ref, watch } from "vue";
import { receiveViewerCoupon } from "@/api/orderCenter";
import { listWatchCoupons, type WatchCouponItem } from "@/api/watchCoupons";
import { useToast } from "@/composables/useToast";
import { getViewerAccessToken, isViewerLoggedIn } from "@/utils/viewerAuth";
import { goViewerLogin } from "@/utils/viewerLogin";

export type ClaimCouponInput = {
  couponId: number;
  employeeId?: number;
  employeeName?: string;
  deptId?: number;
  deptName?: string;
  /** 侧栏列表项字段（与聊天卡同义） */
  lastSenderEmployeeId?: number;
  lastSenderNickname?: string;
  lastSenderDeptId?: number;
  lastSenderDeptName?: string;
};

/** 直播 / 回放共用优惠券图标、弹层与领取。 */
export function useWatchCoupons(
  getActivityId: () => string,
  getActivityTitle?: () => string | undefined | null,
) {
  const { toast } = useToast();
  const couponOpen = ref(false);
  const couponLoading = ref(false);
  const couponError = ref("");
  const coupons = ref<WatchCouponItem[]>([]);
  const claimingCouponId = ref<number | null>(null);
  let fetchSeq = 0;

  const showCouponIcon = computed(() => coupons.value.length > 0);

  async function refreshCoupons() {
    const id = getActivityId()?.trim();
    if (!id) {
      coupons.value = [];
      return;
    }
    const seq = ++fetchSeq;
    couponLoading.value = true;
    couponError.value = "";
    try {
      const res = await listWatchCoupons(id);
      if (seq !== fetchSeq) return;
      coupons.value = res.list ?? [];
    } catch (e) {
      if (seq !== fetchSeq) return;
      coupons.value = [];
      couponError.value = e instanceof Error ? e.message : "加载优惠券失败";
    } finally {
      if (seq === fetchSeq) couponLoading.value = false;
    }
  }

  async function openCoupons() {
    couponOpen.value = true;
    await refreshCoupons();
  }

  function closeCoupons() {
    couponOpen.value = false;
  }

  async function claimCoupon(item: ClaimCouponInput) {
    const couponId = Number(item?.couponId);
    if (!Number.isInteger(couponId) || couponId <= 0) {
      toast("优惠券无效");
      return;
    }
    if (claimingCouponId.value != null) return;

    if (!isViewerLoggedIn() || !getViewerAccessToken()) {
      toast("请先登录后再领取");
      await goViewerLogin();
      return;
    }

    claimingCouponId.value = couponId;
    try {
      const employeeId = item.employeeId ?? item.lastSenderEmployeeId;
      const employeeName =
        item.employeeName?.trim() || item.lastSenderNickname?.trim() || undefined;
      const deptId = item.deptId ?? item.lastSenderDeptId;
      const deptName = item.deptName?.trim() || item.lastSenderDeptName?.trim() || undefined;
      const res = await receiveViewerCoupon({
        couponId,
        receiveName: getActivityTitle?.()?.trim() || undefined,
        employeeId,
        employeeName,
        deptId,
        deptName,
      });
      toast(res.message?.trim() || "领取成功");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "领取失败";
      toast(msg);
      if (/登录|未登录|失效/.test(msg)) {
        await goViewerLogin();
      }
    } finally {
      claimingCouponId.value = null;
    }
  }

  watch(
    () => getActivityId()?.trim() ?? "",
    (id) => {
      if (!id) {
        coupons.value = [];
        return;
      }
      void refreshCoupons();
    },
    { immediate: true },
  );

  return {
    couponOpen,
    couponLoading,
    couponError,
    coupons,
    showCouponIcon,
    claimingCouponId,
    refreshCoupons,
    openCoupons,
    closeCoupons,
    claimCoupon,
  };
}
