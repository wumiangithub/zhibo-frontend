<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import "./player-theme.css";
import PlayerStage from "./components/PlayerStage.vue";
import PreviewScreen from "./components/PreviewScreen.vue";
import EndedScreen from "./components/EndedScreen.vue";
import { fetchChatFilterPageUrl } from "./api/console";
import { ApiError } from "@/api/http";
import { useConsoleSession } from "./composables/useConsoleSession";
import { presenceUserIdFromMessage } from "./utils/presenceEmail";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/auth";
import { buildAudienceWatchUrl } from "@/utils/liveLinks";
import ShareDialog from "@/components/share/ShareDialog.vue";
import AttendeePanel from "./AttendeePanel.vue";
import ChatFilterPanel from "./ChatFilterPanel.vue";
import CouponPanel from "./CouponPanel.vue";
import DiscussPanel from "./DiscussPanel.vue";
import WatchDataPanel from "./WatchDataPanel.vue";
import type { ConsoleSendCouponResult } from "./api/console";

const route = useRoute();
const id = computed(() => String(route.params.id ?? ""));
const auth = useAuthStore();
const shareVisible = ref(false);
const audienceWatchUrl = computed(() =>
  buildAudienceWatchUrl(id.value, auth.user?.id),
);

/** 单场中控台不嵌 LiveConsoleLayout，须自挂 toast 宿主（提问失败等） */
const { message, visible, toast } = useToast();
const panelRef = ref<InstanceType<typeof AttendeePanel> | null>(null);
const watchDataRef = ref<{
  refreshAndResetRange: () => Promise<void>;
} | null>(null);
const actions = ["数据", "评论审核", "商品", "优惠券"];

const chatFilterOpen = ref(false);
/** 首次打开后保持挂载，关闭只隐藏以复用 iframe */
const chatFilterKept = ref(false);
const chatFilterLoading = ref(false);
const chatFilterPageUrl = ref("");
let chatFilterSeq = 0;

/** 默认打开「数据」面板 */
const watchDataOpen = ref(true);
/** 首次打开后保持挂载，关闭只隐藏以复用走势图 */
const watchDataKept = ref(true);

const couponOpen = ref(false);
const couponKept = ref(false);

function presenceTime(raw: string | undefined): string | undefined {
  const text = raw?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text : undefined;
}

const session = useConsoleSession({
  activityId: () => id.value,
  // 昵称/头像由 console/sdk-sign 按「本场成员 → 员工资料」解析，勿写死「助理」
  onPresenceOnline: (msg) => {
    // 结束态不再吃 Join（与 D30 / attendees 全员 offline 对齐；回调晚于 session 赋值）
    const state = session.data.value?.state;
    if (state === 3 || state === 4 || state === 5) return;
    const uid = presenceUserIdFromMessage(msg);
    if (uid && msg.data?.type === "Join") {
      panelRef.value?.patchOnline(uid, true, {
        enterTime: presenceTime(msg.date_time),
        nickname: msg.context?.nickname,
        avatarUrl: msg.context?.avatar,
      });
    }
  },
  onPresenceOffline: (msg) => {
    const uid = presenceUserIdFromMessage(msg);
    if (uid && msg.data?.type === "Leave") {
      panelRef.value?.patchOnline(uid, false, {
        leaveTime: presenceTime(msg.date_time),
      });
    }
  },
});

const {
  loading,
  error,
  data,
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
  sdkFailed,
  sdkReady,
  load,
} = session;

const displayTitle = computed(() => data.value?.title || "直播中控台");
const shareTitle = computed(() => data.value?.title ?? "");
const activityEnded = computed(() => isEnded.value || isReplay.value);

function hideChatFilter() {
  chatFilterOpen.value = false;
}

function resetChatFilter() {
  chatFilterSeq += 1;
  chatFilterOpen.value = false;
  chatFilterKept.value = false;
  chatFilterLoading.value = false;
  chatFilterPageUrl.value = "";
}

function resetWatchData() {
  /** 换场次后仍默认选中「数据」 */
  watchDataOpen.value = true;
  watchDataKept.value = true;
}

function hideCoupon() {
  couponOpen.value = false;
}

function resetCoupon() {
  couponOpen.value = false;
  couponKept.value = false;
}

function openCoupon() {
  couponKept.value = true;
  couponOpen.value = true;
}

async function onCouponSent(res: ConsoleSendCouponResult) {
  try {
    await chat.broadcastCoupon(res);
    toast("优惠券发送成功");
  } catch (e) {
    toast(e instanceof Error ? e.message : "优惠券广播失败");
  }
}

function openWatchData() {
  watchDataKept.value = true;
  watchDataOpen.value = true;
}

async function openChatFilter() {
  const activityId = id.value.trim();
  if (!activityId) {
    toast("活动无效");
    return;
  }
  chatFilterKept.value = true;
  chatFilterOpen.value = true;
  if (chatFilterPageUrl.value) return;

  const seq = ++chatFilterSeq;
  chatFilterLoading.value = true;
  try {
    /** 省略 email/name：服务端用当前员工 e{id}@qkzb.com */
    const res = await fetchChatFilterPageUrl(activityId);
    if (seq !== chatFilterSeq) return;
    const pageUrl = res.pageUrl?.trim() ?? "";
    if (!pageUrl) {
      resetChatFilter();
      toast("未获取到审核页地址");
      return;
    }
    chatFilterPageUrl.value = pageUrl;
  } catch (e) {
    if (seq !== chatFilterSeq) return;
    resetChatFilter();
    if (e instanceof ApiError && e.code === 501) {
      toast(e.message || "未接入");
      return;
    }
    toast(e instanceof Error ? e.message : "加载评论审核失败");
  } finally {
    if (seq === chatFilterSeq) {
      chatFilterLoading.value = false;
    }
  }
}

function onAction(label: string) {
  if (label === "数据") {
    if (watchDataOpen.value) {
      /** 已打开再点：刷新 + 走势时间范围重置为默认 */
      void watchDataRef.value?.refreshAndResetRange?.();
      return;
    }
    openWatchData();
    return;
  }
  if (label === "评论审核") {
    if (chatFilterOpen.value) {
      hideChatFilter();
      return;
    }
    void openChatFilter();
    return;
  }
  if (label === "优惠券") {
    if (couponOpen.value) {
      hideCoupon();
      return;
    }
    openCoupon();
    return;
  }
  toast(`「${label}」暂未开放`);
}

async function boot() {
  resetChatFilter();
  resetWatchData();
  resetCoupon();
  await load();
}

watch(id, () => {
  void boot();
});

onMounted(() => {
  void boot();
});
</script>

<template>
  <div class="console">
    <AttendeePanel
      ref="panelRef"
      :activity-id="id"
      :activity-ended="activityEnded"
    />

    <section class="col stage">
      <header class="stage-head">
        <h1>{{ displayTitle }}</h1>
        <span
          v-if="sdkReady"
          class="sdk-tag is-on"
        >已进房</span>
        <span
          v-else-if="error || sdkFailed"
          class="sdk-tag is-err"
          :title="error"
        >进房异常</span>
        <span
          v-else-if="loading"
          class="sdk-tag"
        >进房中…</span>
        <span
          v-else-if="isEnded || isReplay"
          class="sdk-tag"
        >已结束</span>
        <button
          type="button"
          class="share-btn"
          title="分享"
          @click="shareVisible = true"
        >
          <svg
            class="share-btn-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>
      </header>

      <div
        v-if="notice.text && isLive"
        class="notice"
      >
        <span class="notice-label">公告</span>
        <span class="notice-text">{{ notice.text }}</span>
        <button
          type="button"
          class="notice-close"
          @click="notice.clear"
        >
          ✕
        </button>
      </div>

      <!-- 黑井高 300px、宽铺满；画面仍在 .player-area 内 16:9 居中 -->
      <div
        class="player-well"
        :class="{ 'is-shell': isPreview || isEnded || isReplay }"
      >
        <div
          class="player-area"
          :class="{ 'is-shell': isPreview || isEnded || isReplay }"
        >
          <div
            v-if="loading"
            class="player-state"
          >
            加载中…
          </div>
          <div
            v-else-if="error && !data"
            class="player-state is-err"
          >
            <p>{{ error }}</p>
            <button
              type="button"
              class="action"
              @click="load"
            >
              重试
            </button>
          </div>
          <!-- 预告/直播/结束共挂 PlayerStage（#player 常在），结束不拆 SDK；历史靠 moduleReady → scheduleLoadHistory -->
          <div
            v-else-if="data && (isPreview || isLive || isEnded || isReplay)"
            class="relative flex min-h-0 flex-1 flex-col"
            :class="{ 'lw-theme': isLive }"
            :data-lw-theme="isLive ? 'dark' : undefined"
          >
            <PreviewScreen
              v-if="isPreview"
              class="absolute inset-0 z-[100]"
              :data="data"
              :countdown="countdown"
              :host-player="false"
            />
            <!-- 结束壳只遮罩；host-player=false，勿抢走 #player（D108 保活 + 讨论区历史） -->
            <EndedScreen
              v-if="isEnded || isReplay"
              class="absolute inset-0 z-[100]"
              :data="data"
              :show-replay-entry="false"
              :host-player="false"
            />
            <PlayerStage
              :player="player"
              :barrage="barrage"
              :stats="stats"
              :title="data.title"
              :is-audio-live="isAudioLive"
              @retry="load"
            />
          </div>
          <div
            v-else
            class="player-state"
          >
            暂无可播放内容
          </div>
        </div>
      </div>

      <div class="actions">
        <button
          v-for="label in actions"
          :key="label"
          type="button"
          class="action"
          :class="{
            'is-active':
              (label === '评论审核' && chatFilterOpen) ||
              (label === '数据' && watchDataOpen) ||
              (label === '优惠券' && couponOpen),
          }"
          @click="onAction(label)"
        >
          {{ label }}
        </button>
      </div>

      <WatchDataPanel
        ref="watchDataRef"
        v-show="watchDataOpen"
        v-if="watchDataKept"
        :activity-id="id"
        :start-time="data?.startTime"
        :end-time="data?.endTime"
        :state="data?.state"
        :online-count="stats.onlineCount"
        :chat="chat"
        @refresh="stats.scheduleRoomId"
      />
    </section>

    <!-- active=可发聊（仅直播）；shellReady=页壳在则展示 SDK 拉到的历史（含结束） -->
    <DiscussPanel
      :chat="chat"
      :activity-id="id"
      :active="!!data && isLive"
      :shell-ready="!!data"
    />

    <ChatFilterPanel
      v-if="chatFilterKept"
      :open="chatFilterOpen"
      :page-url="chatFilterPageUrl"
      :loading="chatFilterLoading"
      @close="hideChatFilter"
    />

    <CouponPanel
      v-if="couponKept"
      :open="couponOpen"
      :activity-id="id"
      @close="hideCoupon"
      @sent="onCouponSent"
      @fail="(msg) => toast(msg || '发送失败')"
    />

    <ShareDialog
      v-model="shareVisible"
      :title="shareTitle"
      :watch-url="audienceWatchUrl"
    />

    <div
      v-if="visible"
      class="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#1f2329]/90 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.console {
  display: grid;
  grid-template-columns: 300px minmax(300px, 1fr) 300px;
  gap: 12px;
  box-sizing: border-box;
  height: 100dvh;
  min-height: 0;
  padding: 12px;
  background: #f5f6f8;
  color: #333;
}

.col {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}

.stage-head,
.discuss-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.stage-head h1,
.discuss-head {
  margin: 0;
  overflow: hidden;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discuss-head {
  font-size: 14px;
}

.sdk-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f0f0f0;
  color: #666;
  font-size: 12px;
}

.share-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary, #666);
  cursor: pointer;
}

.share-btn:hover {
  color: var(--color-text, #333);
  background: #eee;
}

.share-btn-icon {
  width: 16px;
  height: 16px;
}

.sdk-tag.is-on {
  background: #f6ffed;
  color: #52c41a;
}

.sdk-tag.is-err {
  background: #fff2f0;
  color: #ff4d4f;
}

.notice {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff7e6;
  color: #ad6800;
  font-size: 13px;
}

.notice-label {
  flex: none;
  font-weight: 600;
}

.notice-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-close {
  flex: none;
  border: 0;
  background: transparent;
  color: #ad6800;
  cursor: pointer;
}

/* 与画面同高 300px、横向铺满；黑底吞两侧留白，预告/结束走浅底 */
.player-well {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 300px;
  max-height: 300px;
  border: 1px solid #000;
  background: #000;
}

.player-well.is-shell {
  border-color: transparent;
  background: var(--color-bg-muted, #fafafa);
}

.player-area {
  display: flex;
  flex: none;
  flex-direction: column;
  /* 16:9；高封顶 300px 时宽同步收窄，避免只压高破比例 */
  aspect-ratio: 16 / 9;
  width: min(100%, calc(300px * 16 / 9));
  max-height: 300px;
  height: auto;
  margin: 0;
  /* visible：勿裁清晰度/音量飞出层 */
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: #000;
}

.player-area :deep(#player) {
  overflow: hidden;
  border-radius: 0;
}

/** 预告 / 结束壳：跟管理端浅色一致，不要黑底 */
.player-area.is-shell {
  background: var(--color-bg-muted, #fafafa);
}

.player-area :deep(.relative) {
  height: 100%;
  min-height: 0;
}

.player-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 0;
  color: #999;
  font-size: 14px;
}

.player-state.is-err {
  color: #ff7875;
}

.player-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
}

.action {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.action:hover {
  color: var(--color-primary);
  border-color: var(--color-primary-border);
}

.action.is-active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
</style>
