<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
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

onMounted(() => {
  if (!showNicknameForm.value) void load();
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
        <div class="flex flex-none items-center justify-between gap-4 border-b border-gray-800 px-4 py-2">
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
              昵称：<span class="text-gray-200">{{ data?.nickname || getStoredNickname() || '观众' }}</span>
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

          <div class="flex min-h-0 flex-1 flex-row">
            <PlayerStage
              :player="player"
              :barrage="barrage"
              :stats="stats"
              :title="data.title"
              :is-audio-live="isAudioLive"
              :can-fallback="!!data.embedUrl"
              @share="shareWatch"
              @gift="showGiftPlaceholder"
              @retry="load"
              @fallback="switchToFallback"
            />

            <div class="flex min-h-0 w-[360px] flex-none flex-col border-l border-gray-800 bg-gray-900">
              <div class="flex flex-none border-b border-gray-800">
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'chat' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'chat'"
                >
                  聊天
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
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
              />
              <BarragePanel
                v-else-if="activeTab === 'barrage'"
                :barrage="barrage"
              />

              <div
                v-else
                class="min-h-0 flex-1 overflow-y-auto p-4"
              >
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
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
