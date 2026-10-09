<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getStoredNickname,
  storeNickname,
} from "@/api/watch";
import NicknameForm from "@/components/watch/NicknameForm.vue";
import PreviewScreen from "@/components/watch/PreviewScreen.vue";
import EndedScreen from "@/components/watch/EndedScreen.vue";
import PlayerStage from "@/components/watch/PlayerStage.vue";
import ChatPanel from "@/components/watch/ChatPanel.vue";
import BarragePanel from "@/components/watch/BarragePanel.vue";
import { useWatchSession } from "@/composables/useWatchSession";

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const showNicknameForm = ref(!getStoredNickname());
const nicknameSaving = ref(false);
const activeTab = ref<"chat" | "intro" | "barrage">("chat");

const session = useWatchSession({
  activityId: id,
  role: "viewer",
  getNickname: () => getStoredNickname().trim(),
  getMatchNicknames: () => {
    const nick = getStoredNickname().trim();
    return nick ? [nick] : [];
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
  load,
  enterLiveFromPreview,
  switchToFallback,
  shareWatch,
  showGiftPlaceholder,
} = session;

const displayNickname = computed(
  () => data.value?.nickname || getStoredNickname() || "观众",
);

async function saveNickname(name: string) {
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await load();
}

function skipNickname() {
  showNicknameForm.value = false;
  void load();
}

function changeNickname() {
  showNicknameForm.value = true;
}

function goHome() {
  void router.push("/");
}

/** 小屏无「弹幕」Tab：若当前停在弹幕则回到聊天 */
function syncTabForViewport() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(max-width: 767px)").matches && activeTab.value === "barrage") {
    activeTab.value = "chat";
  }
}

onMounted(() => {
  syncTabForViewport();
  window.addEventListener("resize", syncTabForViewport);
  if (!showNicknameForm.value) void load();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncTabForViewport);
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
        <!-- 小屏顶栏：头像 + 昵称 | 首页 -->
        <div class="flex flex-none items-center justify-between gap-3 border-b border-gray-800 px-3 py-2 md:hidden">
          <button
            type="button"
            class="flex min-w-0 items-center gap-2 bg-transparent text-left"
            @click="changeNickname"
          >
            <span class="h-8 w-8 flex-none rounded-full bg-gray-700" />
            <span class="truncate text-sm text-gray-100">{{ displayNickname }}</span>
          </button>
          <button
            type="button"
            class="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
            title="首页"
            @click="goHome"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
            </svg>
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
            <span class="flex items-center gap-1 text-xs text-gray-300">
              <span class="h-2 w-2 rounded-full bg-green-500"></span>
              {{ stats.onlineCount }}
            </span>
            <p class="text-xs text-gray-400">
              昵称：<span class="text-gray-200">{{ displayNickname }}</span>
            </p>
            <button
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
          v-else-if="error && !useFallback"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
          <div class="flex gap-3">
            <button
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="load"
            >
              重试
            </button>
            <button
              v-if="sdkFailed && data?.embedUrl"
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="switchToFallback"
            >
              切换嵌入模式
            </button>
          </div>
        </div>

        <div
          v-else-if="data && useFallback"
          class="flex flex-1 items-center justify-center"
        >
          <iframe
            :src="data.embedUrl"
            class="h-full w-full flex-1 border-0"
            allowfullscreen
            allow="fullscreen; microphone; camera; autoplay; display-capture"
          />
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

          <!-- 小屏上下 / PC 左右；断点 md=768 -->
          <div class="flex min-h-0 flex-1 flex-col md:flex-row">
            <PlayerStage
              :player="player"
              :barrage="barrage"
              :stats="stats"
              :title="data.title"
              :is-audio-live="isAudioLive"
              :can-fallback="!!data.embedUrl"
              mobile-aspect-video
              hide-mobile-bar-actions
              @share="shareWatch"
              @gift="showGiftPlaceholder"
              @retry="load"
              @fallback="switchToFallback"
            />

            <div class="flex min-h-0 w-full flex-1 flex-col border-t border-gray-800 bg-gray-900 md:w-[360px] md:flex-none md:border-l md:border-t-0">
              <div class="flex flex-none border-b border-gray-800">
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium md:flex-1"
                  :class="activeTab === 'chat' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'chat'"
                >
                  聊天
                </button>
                <button
                  class="hidden bg-transparent px-4 py-3 text-sm font-medium md:block md:flex-1"
                  :class="activeTab === 'barrage' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'barrage'"
                >
                  弹幕
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'intro' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'intro'"
                >
                  简介
                </button>
              </div>

              <ChatPanel
                v-if="activeTab === 'chat'"
                :chat="chat"
                :like-count="stats.likeCount"
                @gift="showGiftPlaceholder"
                @like="stats.handleLike"
              />
              <BarragePanel
                v-else-if="activeTab === 'barrage'"
                :barrage="barrage"
              />

              <div
                v-else
                class="flex min-h-0 flex-1 flex-col"
              >
                <div class="min-h-0 flex-1 overflow-y-auto p-4">
                  <h3 class="mb-3 text-base font-semibold text-white">{{ data.title }}</h3>
                  <div class="space-y-2 text-sm text-gray-400">
                    <p>
                      <span class="text-gray-500">开始时间：</span>
                      <span>{{ data.startTime }}</span>
                    </p>
                    <p v-if="data.endTime">
                      <span class="text-gray-500">结束时间：</span>
                      <span>{{ data.endTime }}</span>
                    </p>
                  </div>
                </div>
                <!-- 小屏简介 Tab 也保留底栏（无头像）；点入口切回聊天 -->
                <div class="flex flex-none items-center gap-2 border-t border-gray-800 px-3 py-2 md:hidden">
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-full bg-gray-800 px-3 py-2 text-left text-sm text-gray-500"
                    @click="activeTab = 'chat'"
                  >
                    参与聊天
                  </button>
                  <button
                    type="button"
                    class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-gray-300"
                    title="礼物"
                    @click="showGiftPlaceholder"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-red-400"
                    title="点赞"
                    @click="stats.handleLike"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span
                      v-if="stats.likeCount > 0"
                      class="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-red-500 px-1 text-center text-[10px] leading-[14px] text-white"
                    >
                      {{ stats.likeCount > 99 ? '99+' : stats.likeCount }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
