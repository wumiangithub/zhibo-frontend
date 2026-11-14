<script setup lang="ts">
import { computed, ref } from "vue";
import ChatPanel from "@/components/watch/ChatPanel.vue";
import IntroPanel from "@/components/watch/IntroPanel.vue";
import type { ChatController } from "@/composables/useChat";

type ClaimChatCouponPayload = NonNullable<ChatMessage["coupon"]> & {
  employeeName?: string;
};

const props = withDefaults(
  defineProps<{
    chat: ChatController;
    introTitle: string;
    introStartTime?: string | null;
    introEndTime?: string | null;
    likeCount?: number;
    /** 回放：只读聊天、禁点赞 */
    mode?: "live" | "replay";
    showCouponIcon?: boolean;
  }>(),
  {
    likeCount: 0,
    mode: "live",
    showCouponIcon: false,
  },
);

const emit = defineEmits<{
  cart: [];
  coupon: [];
  claimCoupon: [coupon: ClaimChatCouponPayload];
  like: [];
  /** 聊天列表触顶（回放加载更多） */
  chatScrollTop: [];
}>();

const isReplay = computed(() => props.mode === "replay");
const activeTab = ref<"chat" | "intro">("chat");

function onChatListScroll(e: Event) {
  if (!isReplay.value) return;
  const el = e.target as HTMLElement | null;
  if (!el || el.scrollTop > 24) return;
  emit("chatScrollTop");
}
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col border-t border-[var(--lw-border)] bg-[var(--lw-bg-panel)] md:w-[380px] md:flex-none md:border-l md:border-t-0">
    <div class="side-tabs flex flex-none border-b border-[var(--lw-border)] bg-[var(--lw-bg-chrome)]">
      <button
        type="button"
        class="side-tab"
        :class="{ 'is-active': activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        聊天
        <span
          v-if="activeTab === 'chat'"
          class="side-tab-line"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="side-tab"
        :class="{ 'is-active': activeTab === 'intro' }"
        @click="activeTab = 'intro'"
      >
        简介
        <span
          v-if="activeTab === 'intro'"
          class="side-tab-line"
          aria-hidden="true"
        />
      </button>
    </div>

    <ChatPanel
      v-if="activeTab === 'chat'"
      :chat="chat"
      :like-count="likeCount"
      :is-readonly="isReplay"
      :show-like="!isReplay"
      :show-coupon-icon="showCouponIcon"
      @cart="emit('cart')"
      @coupon="emit('coupon')"
      @claim-coupon="emit('claimCoupon', $event)"
      @like="emit('like')"
      @list-scroll="onChatListScroll"
    />
    <IntroPanel
      v-else
      :title="introTitle"
      :start-time="introStartTime"
      :end-time="introEndTime"
      :readonly-chat="isReplay"
      :show-like="!isReplay"
      :like-count="likeCount"
      :show-coupon-icon="showCouponIcon"
      @go-chat="activeTab = 'chat'"
      @cart="emit('cart')"
      @coupon="emit('coupon')"
      @like="emit('like')"
    />
  </div>
</template>

<style scoped>
.side-tabs {
  height: 48px;
  padding: 0 8px;
}
.side-tab {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  font-size: 14px;
  color: var(--lw-text-secondary);
  cursor: pointer;
}
.side-tab.is-active {
  color: var(--lw-color-primary);
  font-weight: 600;
}
.side-tab-line {
  position: absolute;
  left: 28%;
  right: 28%;
  bottom: 0;
  height: 2px;
  border-radius: 1px 1px 0 0;
  background: var(--lw-color-primary);
}
</style>
