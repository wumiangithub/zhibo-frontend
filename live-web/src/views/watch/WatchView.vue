<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { attributeAudience } from "@/api/audienceAttribute";
import { getOrCreateDevSocketId, simulateDevPresence } from "@/api/devPresence";
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
import { listWatchRecords, type WatchRecordItem } from "@/api/replayWatch";
import { useWatchSession } from "@/composables/useWatchSession";
import { useWatchAccessGate } from "@/composables/useWatchAccessGate";
import { useWatchCart } from "@/composables/useWatchCart";
import { decodeAudienceInviteToken } from "@/utils/audienceInviteToken";
import { pingViewerPresence } from "@/api/presence";
import {
  getViewerId,
  isViewerAuthQueryKey,
  readNicknameFromSearch,
  syncViewerAccessTokenFromUrl,
  syncViewerIdFromUrl,
} from "@/utils/viewerAuth";
import { ensureWxJsSdk, navigateToViewerLogin } from "@/utils/miniProgram";

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const { toast } = useToast();
const {
  cartOpen,
  cartLoading,
  cartError,
  cartProducts,
  openCart,
  closeCart,
} = useWatchCart(() => id);

const routeQuery = route.query as Record<string, unknown>;
/** 小程序 web-view：viewerId + JWT + nickname 写入本地，再拉 /watch/sdk-sign */
const syncedViewerId = syncViewerIdFromUrl(routeQuery);
syncViewerAccessTokenFromUrl(routeQuery);
const urlNickname = readNicknameFromSearch(routeQuery);
if (urlNickname) {
  storeNickname(urlNickname);
}

const INVITE_STORAGE_PREFIX = "zhibo.audienceInvite.";

function captureInviteFromQuery() {
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
  const viewerId = getViewerId();
  if (viewerId == null) return;
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
    viewerId,
    inviterId: payload.inviterId,
  }).catch((e) => {
    console.warn("邀请归因失败", e);
  });
}

/** 小程序已带 viewerId+nickname 时跳过随意昵称表单 */
const showNicknameForm = ref(syncedViewerId == null && !getStoredNickname());
const nicknameSaving = ref(false);

const session = useWatchSession({
  activityId: id,
  getNickname: () => getStoredNickname().trim(),
  onUnauthenticatedChat: () => {
    void navigateToViewerLogin().then((ok) => {
      if (!ok) toast("请先登录后再参与聊天");
    });
  },
});

const {
  loading,
  error,
  data,
  showLiveStartPopup,
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
  enterLiveFromPreview,
  shareWatch,
} = session;

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
  const ok = await ensureAccess();
  if (!ok) return;
  await load();
}

async function onPasswordSubmit(password: string) {
  const ok = await submitPassword(password);
  if (ok) await load();
}

const hasViewerId = computed(() => getViewerId() != null);

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

function goReplay(recordId: number) {
  void router.push({
    name: "watch-replay",
    params: { id },
    query: { ...preservedWatchQuery(), recordId: String(recordId) },
  });
}

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
  recordPickerOpen.value = false;
  goReplay(Number(row.id));
}

/** Vite 开发构建才显示。生产包里这两个按钮不存在。 */
const showDevPresence = import.meta.env.DEV;
const devPresenceBusy = ref(false);
/** 点过上线后才露出离线；离线成功后回到上线。 */
const devPresenceOnline = ref(false);

async function simulatePresence(type: "Join" | "Leave") {
  const email = (data.value?.sdk?.email || "").trim();
  if (!email) {
    toast("还没有观众身份，请先进入直播间");
    return;
  }
  const socketId = getOrCreateDevSocketId(id);
  devPresenceBusy.value = true;
  try {
    await simulateDevPresence(id, {
      type,
      email,
      socketId,
      nickname: displayNickname.value,
    });
    devPresenceOnline.value = type === "Join";
    toast(type === "Join" ? "已模拟上线回调" : "已模拟离线回调");
  } catch (e) {
    toast(e instanceof Error ? e.message : "模拟回调失败");
  } finally {
    devPresenceBusy.value = false;
  }
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
  // 预热微信 JS-SDK，聊天跳登录时不必等首屏脚本
  void ensureWxJsSdk().catch(() => {});
  captureInviteFromQuery();
  tryAttributeInvite();
  pingViewerPresence("live");
  if (!showNicknameForm.value) void enterWatch();
});
</script>

<template>
  <div class="flex h-dvh flex-col bg-black text-white">
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
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          {{ accessChecking ? "校验观看权限…" : "请输入观看密码" }}
        </div>

        <template v-else>
        <div
          v-if="showDevPresence"
          class="flex flex-none items-center gap-2 border-b border-amber-800 bg-amber-950 px-3 py-1.5 text-xs text-amber-100"
        >
          <span class="flex-none font-medium text-amber-300">本地开发</span>
          <span class="hidden min-w-0 flex-1 truncate text-amber-200/80 sm:inline">
            模拟微吼上下线回调
          </span>
          <button
            v-if="!devPresenceOnline"
            type="button"
            class="rounded bg-emerald-700 px-2.5 py-1 text-white hover:bg-emerald-600 disabled:opacity-50"
            :disabled="devPresenceBusy"
            @click="simulatePresence('Join')"
          >
            上线
          </button>
          <button
            v-else
            type="button"
            class="rounded bg-gray-700 px-2.5 py-1 text-white hover:bg-gray-600 disabled:opacity-50"
            :disabled="devPresenceBusy"
            @click="simulatePresence('Leave')"
          >
            离线
          </button>
        </div>

        <!-- PC 顶栏 -->
        <div class="hidden flex-none items-center justify-between gap-4 border-b border-gray-800 px-4 py-2 md:flex">
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="truncate text-sm font-semibold text-white">
              {{ data?.title || '直播' }}
            </h1>
            <span
              v-if="data && isLive"
              class="inline-flex flex-none items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
              直播中
            </span>
          </div>
          <div class="flex flex-none items-center gap-3">
            <button
              type="button"
              class="flex h-7 w-7 flex-none items-center justify-center rounded bg-transparent text-white hover:text-red-500"
              title="分享"
              @click="shareWatch"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
            <span class="flex items-center gap-1 text-xs text-gray-300">
              <span class="h-2 w-2 rounded-full bg-green-500"></span>
              {{ stats.onlineCount }}
            </span>
            <p class="text-xs text-gray-400">
              昵称：<span class="text-gray-200">{{ displayNickname }}</span>
            </p>
            <button
              v-if="!hasViewerId"
              class="bg-transparent text-xs text-gray-500 hover:text-gray-300"
              @click="changeNickname"
            >
              修改
            </button>
          </div>
        </div>

        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          加载中…
        </div>

        <div
          v-else-if="error"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
          <div class="flex gap-3">
            <button
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="enterWatch"
            >
              重试
            </button>
          </div>
        </div>

        <PreviewScreen
          v-else-if="data && isPreview"
          :data="data"
          :countdown="countdown"
          :show-live-start-popup="showLiveStartPopup"
          @enter="enterLiveFromPreview"
        />

        <EndedScreen
          v-else-if="data && (isEnded || isReplay)"
          :data="data"
          :show-replay-entry="showReplayEntry"
          :playback-expired="playbackExpired"
          :replay-loading="replayLoading"
          @replay="onViewReplay"
        />

        <div
          v-else-if="data && isLive"
          class="flex min-h-0 flex-1 flex-col"
        >
          <div
            v-if="notice.text"
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

          <WatchRoomShell>
            <template #media>
              <PlayerStage
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
                mode="live"
                :chat="chat"
                :barrage="barrage"
                :intro-title="data.title"
                :intro-start-time="data.startTime"
                :intro-end-time="data.endTime"
                :like-count="stats.likeCount"
                @cart="openCart"
                @like="stats.handleLike"
              />
            </template>
          </WatchRoomShell>
        </div>
        </template>
      </template>
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
    />

    <RecordPickerSheet
      :open="recordPickerOpen"
      :records="recordCandidates"
      @close="recordPickerOpen = false"
      @select="onPickRecord"
    />
  </div>
</template>
