<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getWatchSummary, type WatchSummaryData } from "@/api/watch";
import { listWatchRecords, type WatchRecordItem } from "@/api/replayWatch";
import NativeReplayPlayer from "@/components/watch/NativeReplayPlayer.vue";
import WatchRoomShell from "@/components/watch/WatchRoomShell.vue";
import WatchSidePanel from "@/components/watch/WatchSidePanel.vue";
import ProductSheet from "@/components/watch/ProductSheet.vue";
import CheckoutSheet from "@/components/watch/CheckoutSheet.vue";
import CouponSheet from "@/components/watch/CouponSheet.vue";
import AccessPasswordDialog from "@/components/watch/AccessPasswordDialog.vue";
import AccessBlockedScreen from "@/components/watch/AccessBlockedScreen.vue";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { useReplayWatch } from "@/composables/useReplayWatch";
import { useChatHistory } from "@/composables/useChatHistory";
import { useWatchCart } from "@/composables/useWatchCart";
import { useWatchCoupons } from "@/composables/useWatchCoupons";
import { useWatchTheme } from "@/composables/useWatchTheme";
import { useWatchAccessGate } from "@/composables/useWatchAccessGate";
import {
  isViewerAuthQueryKey,
  isViewerLoggedIn,
  readNicknameFromSearch,
  syncViewerAccessTokenFromUrl,
  syncViewerUsernameFromUrl,
} from "@/utils/viewerAuth";
import { storeNickname } from "@/api/watch";
import { ensureWxJsSdk, isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import {
  goViewerLogin,
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";
import { purgeOrphanUiSheets } from "@/utils/purgeUiSheets";

const route = useRoute();
const router = useRouter();
/** 小程序 web-view 已有原生顶栏，不再叠一层返回 Header */
const inMiniProgram = isLikelyMiniProgramWebView();

const { theme } = useWatchTheme();
const activityId = computed(() => String(route.params.id ?? ""));
const recordIdParam = computed(() => {
  const raw = route.query.recordId;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const loading = ref(true);
const error = ref("");
const summary = ref<WatchSummaryData | null>(null);
const record = ref<WatchRecordItem | null>(null);

const routeQuery = route.query as Record<string, unknown>;
syncViewerUsernameFromUrl(routeQuery);
syncViewerAccessTokenFromUrl(routeQuery);
const urlNickname = readNicknameFromSearch(routeQuery);
if (urlNickname) storeNickname(urlNickname);

const speedAllow = computed(() => summary.value?.playbackSpeedAllow !== false);
const fastForwardAllow = computed(
  () => summary.value?.playbackFastForwardAllow !== false,
);

const gate = useWatchAccessGate(() => activityId.value);
const {
  checking: accessChecking,
  passwordOpen,
  passwordSubmitting,
  passwordError,
  blockedTitle,
  blockedMessage,
  ensureAccess,
  submitPassword,
} = gate;

const replayWatch = useReplayWatch({
  activityId: () => activityId.value,
  recordId: () => record.value?.id ?? recordIdParam.value,
  active: () => {
    const d = summary.value;
    if (!d || d.playbackEnabled === false || d.playbackExpired) return false;
    return !!record.value?.tosUrl;
  },
});

const chatHistory = useChatHistory(() => activityId.value);
const {
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
  closeCheckout,
  openCouponPicker,
  closeCouponPicker,
  selectCoupon,
  submitCheckoutOrder,
  checkoutSubmitting,
} = useWatchCart(() => activityId.value, { watchMode: "replay" });
const {
  couponOpen,
  couponLoading,
  couponError,
  coupons,
  showCouponIcon,
  claimingCouponId,
  openCoupons,
  closeCoupons,
  claimCoupon,
} = useWatchCoupons(
  () => activityId.value,
  () => summary.value?.title,
);

function preservedQuery(): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(route.query)) {
    if (k === "recordId") continue;
    if (isViewerAuthQueryKey(k)) continue;
    if (v == null) continue;
    q[k] = v as string | string[];
  }
  return q;
}

function goBackToWatch() {
  purgeOrphanUiSheets();
  void router.replace({
    name: "watch",
    params: { id: activityId.value },
    query: preservedQuery(),
  });
}

async function loadContent() {
  loading.value = true;
  error.value = "";
  record.value = null;
  try {
    await ensureWxJsSdk();
    const id = activityId.value;
    if (!id) {
      error.value = "活动无效";
      return;
    }
    const rid = recordIdParam.value;
    if (rid == null) {
      error.value = "请选择回放";
      return;
    }

    const [shell, records] = await Promise.all([
      getWatchSummary(id),
      listWatchRecords(id),
    ]);
    summary.value = shell;

    if (shell.playbackEnabled === false) {
      error.value = "回放未开启";
      return;
    }
    if (shell.playbackExpired) {
      error.value = "回放已过期";
      return;
    }

    const hit = (records.list ?? []).find((row) => Number(row.id) === rid);
    if (!hit?.tosUrl) {
      error.value = "回放不存在或未就绪";
      return;
    }
    record.value = hit;
    void chatHistory.loadFirstPage();
  } catch (e) {
    if (isViewerLoginRequiredError(e)) {
      await recoverViewerAuth();
      return;
    }
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function enterReplay() {
  if (!isViewerLoggedIn()) {
    await goViewerLogin();
    return;
  }
  const ok = await ensureAccess();
  if (!ok) {
    loading.value = false;
    return;
  }
  await loadContent();
}

async function onPasswordSubmit(password: string) {
  const ok = await submitPassword(password);
  if (ok) await loadContent();
}

watch(
  () => [activityId.value, recordIdParam.value] as const,
  () => {
    void enterReplay();
  },
);

onMounted(() => {
  purgeOrphanUiSheets();
  void enterReplay();
});
</script>

<template>
  <div
    class="lw-theme flex h-dvh flex-col bg-[var(--lw-bg-canvas)] text-[var(--lw-text-primary)]"
    :data-lw-theme="theme"
  >
    <UiPageHeader
      v-if="!inMiniProgram"
      :title="record?.title || summary?.title || '回放'"
      @back="goBackToWatch"
    />

    <div class="flex min-h-0 flex-1 flex-col">
      <AccessBlockedScreen
        v-if="blockedTitle"
        :title="blockedTitle"
        :message="blockedMessage"
      />

      <div
        v-else-if="accessChecking || (passwordOpen && !record)"
        class="flex flex-1 items-center justify-center text-sm text-[var(--lw-text-secondary)]"
      >
        {{ accessChecking ? "校验观看权限…" : "请输入观看密码" }}
      </div>

      <p
        v-else-if="loading"
        class="py-16 text-center text-sm text-[var(--lw-text-secondary)]"
      >
        加载中…
      </p>
      <div
        v-else-if="error"
        class="flex flex-col items-center gap-4 px-6 py-16 text-center"
      >
        <p class="text-sm text-[var(--lw-color-warning)]">
          {{ error }}
        </p>
        <button
          type="button"
          class="rounded-lg bg-[var(--lw-bg-elevated)] px-4 py-2 text-sm text-[var(--lw-text-primary)] hover:opacity-90"
          @click="goBackToWatch"
        >
          返回直播间
        </button>
      </div>
      <WatchRoomShell v-else-if="record?.tosUrl">
        <template #media>
          <NativeReplayPlayer
            embed-in-room
            :src="record.tosUrl"
            :title="record.title"
            :speed-allow="speedAllow"
            :fast-forward-allow="fastForwardAllow"
            @play="replayWatch.onPlay()"
            @pause="replayWatch.onPause()"
            @ended="replayWatch.onEnded()"
          />
        </template>
        <template #side>
          <WatchSidePanel
            mode="replay"
            :chat="chatHistory.chat"
            :intro-title="summary?.title || record.title || '回放'"
            :intro-start-time="summary?.startTime"
            :intro-end-time="summary?.endTime"
            :show-coupon-icon="showCouponIcon"
            @cart="openCart"
            @coupon="openCoupons"
            @claim-coupon="claimCoupon"
            @chat-scroll-top="chatHistory.onScrollNearTop()"
          />
        </template>
      </WatchRoomShell>
    </div>

    <AccessPasswordDialog
      :open="passwordOpen"
      :submitting="passwordSubmitting"
      :error="passwordError"
      @submit="onPasswordSubmit"
    />

    <ProductSheet
      :open="cartOpen"
      :loading="cartLoading"
      :error="cartError"
      :products="cartProducts"
      @close="closeCart"
      @buy="buyProduct"
    />

    <CheckoutSheet
      :open="checkoutOpen"
      :loading="checkoutLoading"
      :error="checkoutError"
      :product-name="checkoutProductName"
      :cover-img="checkoutCoverImg"
      :validity-text="checkoutValidityText"
      :pay-price-text="checkoutPayPriceText"
      :coupons="checkoutCoupons"
      :coupons-loading="checkoutCouponsLoading"
      :selected-coupon-user-id="selectedCouponUserId"
      :coupon-picker-open="couponPickerOpen"
      :submitting="checkoutSubmitting"
      @close="closeCheckout"
      @open-coupons="openCouponPicker"
      @close-coupons="closeCouponPicker"
      @select-coupon="selectCoupon"
      @submit="submitCheckoutOrder"
    />

    <CouponSheet
      :open="couponOpen"
      :loading="couponLoading"
      :error="couponError"
      :coupons="coupons"
      :claiming-coupon-id="claimingCouponId"
      @close="closeCoupons"
      @claim="claimCoupon"
    />
  </div>
</template>
