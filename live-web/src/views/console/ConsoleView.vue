<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import PlayerStage from "@/components/watch/PlayerStage.vue";
import PreviewScreen from "@/components/watch/PreviewScreen.vue";
import EndedScreen from "@/components/watch/EndedScreen.vue";
import { fetchChatFilterPageUrl } from "@/api/chatFilter";
import { ApiError } from "@/api/http";
import { useWatchSession } from "@/composables/useWatchSession";
import { useToast } from "@/composables/useToast";
import AttendeePanel from "./AttendeePanel.vue";
import ChatFilterPanel from "./ChatFilterPanel.vue";
import DiscussPanel from "./DiscussPanel.vue";
import WatchDataPanel from "./WatchDataPanel.vue";

const route = useRoute();
const id = computed(() => String(route.params.id ?? ""));
/** 预留：admin 跳转会带 ?token=，现阶段可空 */
const adminToken = computed(() => String(route.query.token ?? ""));

const { toast } = useToast();
const panelRef = ref<InstanceType<typeof AttendeePanel> | null>(null);
const watchDataRef = ref<{
  refreshAndResetRange: () => Promise<void>;
} | null>(null);
const actions = ["数据", "评论审核", "商品", "优惠券"];

const ASSISTANT_NICK = "助理";

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

function presenceTime(raw: string | undefined): string | undefined {
  const text = raw?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text : undefined;
}

const session = useWatchSession({
  activityId: () => id.value,
  role: "assistant",
  getNickname: () => ASSISTANT_NICK,
  getMatchNicknames: () => [ASSISTANT_NICK],
  onPresenceOnline: (msg) => {
    // 结束态不再吃 Join（与 D30 / attendees 全员 offline 对齐；回调晚于 session 赋值）
    const state = session.data.value?.state;
    if (state === 3 || state === 4 || state === 5) return;
    const uid = msg.sender_id?.trim();
    if (uid && msg.data?.type === "Join") {
      panelRef.value?.patchOnline(uid, true, {
        enterTime: presenceTime(msg.date_time),
        nickname: msg.context?.nickname,
        avatarUrl: msg.context?.avatar,
      });
    }
  },
  onPresenceOffline: (msg) => {
    const uid = msg.sender_id?.trim();
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
  sdkFailed,
  useFallback,
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
  sdkReady,
  load,
  enterLiveFromPreview,
  switchToFallback,
  shareWatch,
} = session;

const displayTitle = computed(() => data.value?.title || "直播中控台");
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
    const res = await fetchChatFilterPageUrl(activityId, { name: ASSISTANT_NICK });
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
  toast(`「${label}」暂未开放`);
}

async function boot() {
  void adminToken.value;
  resetChatFilter();
  resetWatchData();
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
          @click="shareWatch"
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

      <div class="player-area">
        <div
          v-if="loading"
          class="player-state"
        >
          加载中…
        </div>
        <div
          v-else-if="error && !useFallback && !data"
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
        <iframe
          v-else-if="data && useFallback"
          :src="data.embedUrl"
          class="player-iframe"
          allowfullscreen
          allow="fullscreen; microphone; camera; autoplay; display-capture"
        />
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
        />
        <PlayerStage
          v-else-if="data && isLive"
          :player="player"
          :barrage="barrage"
          :stats="stats"
          :title="data.title"
          :is-audio-live="isAudioLive"
          :can-fallback="!!data.embedUrl"
          @retry="load"
          @fallback="switchToFallback"
        />
        <div
          v-else
          class="player-state"
        >
          暂无可播放内容
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
              (label === '数据' && watchDataOpen),
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

    <DiscussPanel
      :chat="chat"
      :active="!!data && isLive"
    />

    <ChatFilterPanel
      v-if="chatFilterKept"
      :open="chatFilterOpen"
      :page-url="chatFilterPageUrl"
      :loading="chatFilterLoading"
      @close="hideChatFilter"
    />
  </div>
</template>

<style scoped>
.console {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 300px;
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
  margin-left: auto;
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
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  cursor: pointer;
}

.share-btn:hover {
  color: #ef4444;
  background: #f5f5f5;
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

.player-area {
  display: flex;
  flex: none;
  flex-direction: column;
  height: 200px;
  margin: 12px 16px 0;
  overflow: hidden;
  border-radius: 8px;
  background: #111;
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
  color: #1677ff;
  border-color: #91caff;
}

.action.is-active {
  color: #1677ff;
  border-color: #1677ff;
  background: #e6f4ff;
}
</style>
