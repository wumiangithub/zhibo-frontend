<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { attributeAudience } from "@/api/audienceAttribute";
import {
  getStoredNickname,
  storeNickname,
} from "@/api/watch";
import { useToast } from "@/composables/useToast";
import NicknameForm from "@/components/watch/NicknameForm.vue";
import PreviewScreen from "@/components/watch/PreviewScreen.vue";
import EndedScreen from "@/components/watch/EndedScreen.vue";
import RecordPickerSheet from "@/components/watch/RecordPickerSheet.vue";
import PlayerStage from "@/components/watch/PlayerStage.vue";
import WatchRoomShell from "@/components/watch/WatchRoomShell.vue";
import WatchSidePanel from "@/components/watch/WatchSidePanel.vue";
import AccessPasswordDialog from "@/components/watch/AccessPasswordDialog.vue";
import AccessBlockedScreen from "@/components/watch/AccessBlockedScreen.vue";
import ProductSheet from "@/components/watch/ProductSheet.vue";
import CheckoutSheet from "@/components/watch/CheckoutSheet.vue";
import CouponSheet from "@/components/watch/CouponSheet.vue";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { listWatchRecords, type WatchRecordItem } from "@/api/replayWatch";
import { useWatchSession } from "@/composables/useWatchSession";
import { useWatchAccessGate } from "@/composables/useWatchAccessGate";
import { useWatchCart } from "@/composables/useWatchCart";
import { useWatchCoupons } from "@/composables/useWatchCoupons";
import { useWatchTheme } from "@/composables/useWatchTheme";
import { decodeAudienceInviteToken } from "@/utils/audienceInviteToken";
import { pingViewerPresence } from "@/api/presence";
import {
  clearViewerSession,
  getViewerAccessToken,
  getViewerUsername,
  isViewerAuthQueryKey,
  isViewerLoggedIn,
  readNicknameFromSearch,
  syncViewerAccessTokenFromUrl,
  syncViewerUsernameFromUrl,
} from "@/utils/viewerAuth";
import { ensureWxJsSdk, isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { goViewerLogin, recoverViewerAuth } from "@/utils/viewerLogin";
import { reportLessonProgress } from "@/api/learning";
import {
  hasCourseLessonContext,
  reportCourseLessonProgress,
} from "@/utils/courseLessonProgressReport";
import { purgeOrphanUiSheets } from "@/utils/purgeUiSheets";
import { backOrHome } from "@/utils/navigation";

const route = useRoute();
const router = useRouter();
/** 小程序 web-view 已有原生顶栏，不再叠一层返回 Header */
const inMiniProgram = isLikelyMiniProgramWebView();
const id = String(route.params.id);
const courseContextId = String(route.query.courseId ?? "").trim().toLowerCase();
const courseLessonNodeId = Number(route.query.lessonNodeId);
/** 课程直播小节：结束页只上报一次 live_ended */
let courseLiveEndedReported = false;
const { toast } = useToast();
const { theme } = useWatchTheme();
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
} = useWatchCart(() => id);
/** session 的发券自定义消息回调会用到；在 useWatchCoupons 初始化后赋值 */
let refreshCoupons: () => Promise<void> = async () => {};

const routeQuery = route.query as Record<string, unknown>;
/** 小程序 web-view：username + JWT + nickname 写入本地，再拉 /watch/sdk-sign */
syncViewerUsernameFromUrl(routeQuery);
syncViewerAccessTokenFromUrl(routeQuery);
const urlNickname = readNicknameFromSearch(routeQuery);
if (urlNickname) {
  storeNickname(urlNickname);
}

const INVITE_STORAGE_PREFIX = "zhibo.audienceInvite.";

function captureInviteFromQuery() {
  // 只解密 query `c`；`kind`/`inviterId` 等人读 hint 可被乱改，禁止当业务来源
  const raw = String(route.query.c ?? "").trim();
  const decoded = decodeAudienceInviteToken(raw);
  if (!decoded) return;
  try {
    sessionStorage.setItem(
      `${INVITE_STORAGE_PREFIX}${id}`,
      JSON.stringify(decoded),
    );
  } catch {
    /* ignore */
  }
}

function tryAttributeInvite() {
  // D97：被邀请观众 id 只从 JWT；邀请人只来自上方解密后的 `c` 缓存，不读 hint query
  if (!getViewerAccessToken()) return;
  let payload: { kind: "employee"; inviterId: number } | null = null;
  try {
    const raw = sessionStorage.getItem(`${INVITE_STORAGE_PREFIX}${id}`);
    if (!raw) return;
    payload = JSON.parse(raw) as { kind: "employee"; inviterId: number };
  } catch {
    return;
  }
  if (!payload?.inviterId || payload.kind !== "employee") {
    return;
  }
  void attributeAudience(id, {
    inviterId: payload.inviterId,
  }).catch((e) => {
    console.warn("邀请归因失败", e);
  });
}

/** 已登录且无展示昵称时才填；未登录先走 /login，不挡在昵称表单 */
const showNicknameForm = ref(
  !!getViewerAccessToken() && !getViewerUsername() && !getStoredNickname(),
);
const nicknameSaving = ref(false);

/** 防止 refresh 后仍鉴权失败时反复 recover↔load */
let authRecovering = false;

/** summary/sdk-sign「请先登录」或聊天未登录：先 refresh，否则清票跳 /login?redirect= */
async function onViewerAuthRequired() {
  if (authRecovering) {
    // 换票后仍鉴权失败：不再死循环，强制清票去登录
    clearViewerSession();
    await goViewerLogin();
    return;
  }
  authRecovering = true;
  try {
    const outcome = await recoverViewerAuth();
    if (outcome === "refreshed") {
      await enterWatch();
    }
  } finally {
    authRecovering = false;
  }
}

const session = useWatchSession({
  activityId: id,
  getNickname: () => getStoredNickname().trim(),
  onUnauthenticatedChat: () => {
    void onViewerAuthRequired();
  },
  onViewerAuthRequired: () => onViewerAuthRequired(),
  onCouponCustomEvent: () => {
    void refreshCoupons();
  },
});

const {
  loading,
  error,
  data,
  sign,
  countdown,
  barrage,
  chat,
  stats,
  notice,
  player,
  isLive,
  isPreview,
  isEnded,
  isReplay,
  isAudioLive,
  load,
  shareWatch,
} = session;

const {
  couponOpen,
  couponLoading,
  couponError,
  coupons,
  showCouponIcon,
  claimingCouponId,
  refreshCoupons: refreshCouponsImpl,
  openCoupons,
  closeCoupons,
  claimCoupon,
} = useWatchCoupons(
  () => id,
  () => data.value?.title,
);
refreshCoupons = refreshCouponsImpl;

const gate = useWatchAccessGate(() => id);
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

async function enterWatch() {
  if (!isViewerLoggedIn()) {
    await goViewerLogin();
    return;
  }
  const ok = await ensureAccess();
  if (!ok) return;
  await load();
}

/** 重试：无 token 直接登录；有 token 再走门禁+加载（失效票由 load/auth 回调清掉并跳登录） */
async function onRetryEnter() {
  if (!isViewerLoggedIn()) {
    await goViewerLogin();
    return;
  }
  await enterWatch();
}

async function onPasswordSubmit(password: string) {
  const ok = await submitPassword(password);
  if (ok) await load();
}

const hasViewerUsername = computed(() => !!getViewerUsername());

const displayNickname = computed(() => getStoredNickname() || "观众");

/** D89：结束页回放入口 */
const showReplayEntry = computed(
  () => !!data.value && data.value.playbackEnabled !== false,
);
const playbackExpired = computed(() => !!data.value?.playbackExpired);
const replayLoading = ref(false);
const recordPickerOpen = ref(false);
const recordCandidates = ref<WatchRecordItem[]>([]);

function preservedWatchQuery(): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(route.query)) {
    if (v == null) continue;
    if (isViewerAuthQueryKey(k)) continue;
    q[k] = v as string | string[];
  }
  return q;
}

/** H5 顶栏返回：有课程上下文回课程详情，否则站内上一页，再否则首页 */
function goBackFromWatch() {
  if (courseContextId) {
    void router.replace({
      name: "learning-course",
      params: { id: courseContextId },
    });
    return;
  }
  backOrHome(router);
}

function goReplay(recordId: number) {
  recordPickerOpen.value = false;
  purgeOrphanUiSheets();
  void router.push({
    name: "watch-replay",
    params: { id },
    query: { ...preservedWatchQuery(), recordId: String(recordId) },
  });
}

/** 结束页小遮罩盖住内容区时，退出伪全屏，避免 fixed 层和弹层抢点击 */
function exitFullscreenOnEndedShell() {
  if (player.pseudoFullscreen) player.pseudoFullscreen = false;
}

/** D101：课程进房后进入结束壳（含云侧 4/5）→ live_ended，记小节学完 */
function maybeReportCourseLiveEnded() {
  if (courseLiveEndedReported) return;
  if (!hasCourseLessonContext(courseContextId, courseLessonNodeId)) return;
  if (!(isEnded.value || isReplay.value)) return;
  courseLiveEndedReported = true;
  reportCourseLessonProgress(courseContextId, courseLessonNodeId, "live_ended");
}

watch(
  () => isEnded.value || isReplay.value,
  (on) => {
    if (on) {
      exitFullscreenOnEndedShell();
      maybeReportCourseLiveEnded();
    }
  },
  { immediate: true },
);

async function onViewReplay() {
  if (!showReplayEntry.value || playbackExpired.value) return;
  replayLoading.value = true;
  try {
    const res = await listWatchRecords(id);
    const list = (res.list ?? []).filter(
      (row) => Number(row.id) > 0 && !!row.tosUrl,
    );
    if (list.length === 0) {
      toast("回放生成中，请稍后再试");
      return;
    }
    if (list.length === 1) {
      goReplay(Number(list[0].id));
      return;
    }
    recordCandidates.value = list;
    recordPickerOpen.value = true;
  } catch (e) {
    toast(e instanceof Error ? e.message : "加载回放失败");
  } finally {
    replayLoading.value = false;
  }
}

function onPickRecord(row: WatchRecordItem) {
  goReplay(Number(row.id));
}

async function saveNickname(name: string) {
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await enterWatch();
}

function skipNickname() {
  showNicknameForm.value = false;
  void enterWatch();
}

function changeNickname() {
  showNicknameForm.value = true;
}

onMounted(() => {
  purgeOrphanUiSheets();
  // 预热微信 JS-SDK，聊天跳登录时不必等首屏脚本
  void ensureWxJsSdk().catch(() => {});
  if (!isViewerLoggedIn()) {
    void goViewerLogin();
    return;
  }
  captureInviteFromQuery();
  tryAttributeInvite();
  pingViewerPresence("live");
  if (hasCourseLessonContext(courseContextId, courseLessonNodeId)) {
    void reportLessonProgress(courseContextId, {
      lessonNodeId: courseLessonNodeId,
      event: "open",
    }).catch(() => {});
  }
  if (!showNicknameForm.value) void enterWatch();
});
</script>

<template>
  <div
    class="lw-theme pc-watch-page flex h-dvh flex-col md:overflow-hidden bg-[var(--lw-bg-canvas)] text-[var(--lw-text-primary)]"
    :data-lw-theme="theme"
  >
    <UiPageHeader
      v-if="!inMiniProgram"
      class="md:hidden watch-mobile-header"
      :title="data?.title || '直播'"
      @back="goBackFromWatch"
    />

    <div class="pc-watch-body flex min-h-0 flex-1 flex-col">
    <div class="pc-watch-frame flex min-h-0 flex-1 flex-col">
    <header
      v-if="!inMiniProgram"
      class="pc-watch-topbar hidden flex-none items-center border-b border-[var(--lw-border)] bg-[var(--lw-bg-chrome)] md:flex"
    >
      <div class="pc-watch-topbar-inner">
      <button
        type="button"
        class="pc-watch-back"
        @click="goBackFromWatch"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <div class="min-w-0 truncate text-[15px] font-semibold tracking-tight text-[var(--lw-text-primary)]">
        {{ data?.title || '直播' }}
      </div>
      <span
        v-if="data && isLive"
        class="inline-flex h-[22px] flex-none items-center gap-[5px] rounded-full bg-[var(--lw-color-live)] py-0 pl-[7px] pr-2 text-[11px] font-semibold text-white"
      >
        <i class="h-[5px] w-[5px] rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,.35)]" />
        直播中
      </span>
      <div class="flex-1" />
      <button
        type="button"
        class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-transparent text-[var(--lw-text-secondary)] hover:text-[var(--lw-text-primary)]"
        title="分享"
        @click="shareWatch"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="18" cy="5" r="2.4" stroke-width="1.8" />
          <circle cx="6" cy="12" r="2.4" stroke-width="1.8" />
          <circle cx="18" cy="19" r="2.4" stroke-width="1.8" />
          <path stroke-linecap="round" stroke-width="1.8" d="M8.2 13.2l5.7 3.3M13.9 7.5l-5.7 3.3" />
        </svg>
      </button>
      <div class="flex h-9 flex-none items-center gap-1.5 pl-2.5 pr-1.5 text-[13px] text-[var(--lw-text-secondary)]">
        <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
        在线 <b class="font-semibold text-[var(--lw-text-primary)]">{{ stats.onlineCount }}</b>
      </div>
      <button
        type="button"
        class="flex h-9 flex-none items-center gap-2 rounded-full py-0 pl-1 pr-2.5 text-[13px] text-[var(--lw-text-primary)]"
        :title="hasViewerUsername ? undefined : '修改昵称'"
        @click="!hasViewerUsername && changeNickname()"
      >
        <span class="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--lw-bg-elevated)] text-[var(--lw-text-secondary)]">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        </span>
        {{ displayNickname }}
      </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col">
      <NicknameForm
        v-if="showNicknameForm"
        :saving="nicknameSaving"
        @save="saveNickname"
        @skip="skipNickname"
      />

      <template v-else>
        <AccessBlockedScreen
          v-if="blockedTitle"
          :title="blockedTitle"
          :message="blockedMessage"
        />

        <div
          v-else-if="accessChecking || (passwordOpen && !data)"
          class="flex flex-1 items-center justify-center text-sm text-[var(--lw-text-secondary)]"
        >
          {{ accessChecking ? "校验观看权限…" : "请输入观看密码" }}
        </div>

        <template v-else>
        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-[var(--lw-text-secondary)]"
        >
          加载中…
        </div>

        <div
          v-else-if="error"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-[var(--lw-color-danger)]">{{ error }}</p>
          <div class="flex gap-3">
            <button
              type="button"
              class="rounded-md border border-[var(--lw-border-strong)] bg-[var(--lw-bg-elevated)] px-4 py-2 text-sm text-[var(--lw-text-primary)] hover:opacity-90"
              @click="onRetryEnter"
            >
              重试
            </button>
          </div>
        </div>

        <!-- 预告 / 直播 / 结束同一页：PlayerStage 常挂，overlay 只改壳；不因结束拆 SDK -->
        <div
          v-else-if="data && (isPreview || isLive || isEnded || isReplay)"
          class="relative flex min-h-0 flex-1 flex-col"
        >
          <PreviewScreen
            v-if="isPreview"
            class="absolute inset-0 z-40"
            :data="data"
            :countdown="countdown"
            :host-player="false"
          />

          <EndedScreen
            v-if="isEnded || isReplay"
            class="absolute inset-0 z-40"
            :data="data"
            :show-replay-entry="showReplayEntry"
            :playback-expired="playbackExpired"
            :replay-loading="replayLoading"
            :host-player="false"
            @replay="onViewReplay"
          />

          <div
            v-show="isLive && notice.text"
            class="flex flex-none items-center gap-2 bg-amber-600/90 px-4 py-2 text-sm text-white"
          >
            <span class="font-medium">公告</span>
            <span class="flex-1 truncate">{{ notice.text }}</span>
            <button
              class="bg-transparent text-white/70 hover:text-white"
              @click="notice.clear"
            >
              ✕
            </button>
          </div>

          <WatchRoomShell class="min-h-0 flex-1">
            <template #media>
              <PlayerStage
                class="transition-opacity"
                :class="{ 'opacity-0': isPreview || isEnded || isReplay }"
                :player="player"
                :barrage="barrage"
                :stats="stats"
                :title="data.title"
                :is-audio-live="isAudioLive"
                mobile-aspect-video
                hide-mobile-bar-actions
                @retry="load"
              />
            </template>
            <template #side>
              <WatchSidePanel
                v-show="isLive"
                mode="live"
                :chat="chat"
                :intro-title="data.title"
                :intro-start-time="data.startTime"
                :intro-end-time="data.endTime"
                :like-count="stats.likeCount"
                :show-coupon-icon="showCouponIcon"
                @cart="openCart"
                @coupon="openCoupons"
                @claim-coupon="claimCoupon"
                @like="stats.handleLike"
              />
            </template>
          </WatchRoomShell>
        </div>
        </template>
      </template>
    </div>
    </div>
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

    <RecordPickerSheet
      :open="recordPickerOpen"
      :records="recordCandidates"
      @close="recordPickerOpen = false"
      @select="onPickRecord"
    />
  </div>
</template>

<style scoped>
.pc-watch-topbar {
  height: 56px;
  padding: 0;
}
.pc-watch-topbar-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 0 16px 0 8px;
}
@media (min-width: 1601px) {
  .pc-watch-frame {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    overflow: visible;
    box-shadow: var(--lw-block-outline);
  }
}
.pc-watch-back {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 36px;
  padding: 0 10px 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--lw-text-primary);
  font: 500 14px/20px inherit;
  cursor: pointer;
}
.pc-watch-back svg {
  width: 18px;
  height: 18px;
}
/* 小屏直播间顶栏与聊天 Tab 同色，浅色/暗色都走 --lw-bg-chrome */
:deep(.watch-mobile-header) {
  background-color: var(--lw-bg-chrome);
}
</style>
