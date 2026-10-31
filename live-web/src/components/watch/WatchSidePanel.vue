<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ChatPanel from "@/components/watch/ChatPanel.vue";
import BarragePanel from "@/components/watch/BarragePanel.vue";
import IntroPanel from "@/components/watch/IntroPanel.vue";
import type { ChatController } from "@/composables/useChat";
import type { BarrageController } from "@/composables/useBarrage";

const props = withDefaults(
  defineProps<{
    chat: ChatController;
    /** 直播传；回放不传则无弹幕 Tab */
    barrage?: BarrageController | null;
    introTitle: string;
    introStartTime?: string | null;
    introEndTime?: string | null;
    likeCount?: number;
    /** 回放：只读聊天、无弹幕、禁点赞 */
    mode?: "live" | "replay";
  }>(),
  {
    barrage: null,
    likeCount: 0,
    mode: "live",
  },
);

const emit = defineEmits<{
  cart: [];
  like: [];
  /** 聊天列表触顶（回放加载更多） */
  chatScrollTop: [];
}>();

const isReplay = computed(() => props.mode === "replay");
const activeTab = ref<"chat" | "intro" | "barrage">("chat");

function syncTabForViewport() {
  if (typeof window === "undefined") return;
  if (
    window.matchMedia("(max-width: 767px)").matches &&
    activeTab.value === "barrage"
  ) {
    activeTab.value = "chat";
  }
}

watch(
  () => props.mode,
  () => {
    if (isReplay.value && activeTab.value === "barrage") {
      activeTab.value = "chat";
    }
  },
);

onMounted(() => {
  syncTabForViewport();
  window.addEventListener("resize", syncTabForViewport);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", syncTabForViewport);
});

function onChatListScroll(e: Event) {
  if (!isReplay.value) return;
  const el = e.target as HTMLElement | null;
  if (!el || el.scrollTop > 24) return;
  emit("chatScrollTop");
}
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col border-t border-gray-800 bg-gray-900 md:w-[360px] md:flex-none md:border-l md:border-t-0">
    <div class="flex flex-none border-b border-gray-800">
      <button
        type="button"
        class="flex-1 bg-transparent px-4 py-3 text-sm font-medium md:flex-1"
        :class="activeTab === 'chat' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
        @click="activeTab = 'chat'"
      >
        聊天
      </button>
      <button
        v-if="!isReplay && barrage"
        type="button"
        class="hidden bg-transparent px-4 py-3 text-sm font-medium md:block md:flex-1"
        :class="activeTab === 'barrage' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
        @click="activeTab = 'barrage'"
      >
        弹幕
      </button>
      <button
        type="button"
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
      :like-count="likeCount"
      :is-readonly="isReplay"
      :show-like="!isReplay"
      @cart="emit('cart')"
      @like="emit('like')"
      @list-scroll="onChatListScroll"
    />
    <BarragePanel
      v-else-if="activeTab === 'barrage' && barrage"
      :barrage="barrage"
    />
    <IntroPanel
      v-else
      :title="introTitle"
      :start-time="introStartTime"
      :end-time="introEndTime"
      :readonly-chat="isReplay"
      :show-like="!isReplay"
      :like-count="likeCount"
      @go-chat="activeTab = 'chat'"
      @cart="emit('cart')"
      @like="emit('like')"
    />
  </div>
</template>
