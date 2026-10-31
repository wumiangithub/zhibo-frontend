<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import { splitEmojiText } from "@/constants/emoji";
import type { ChatController } from "@/composables/useChat";
import { vhallChatRoleBadge } from "@/utils/vhallChatRole";

const props = withDefaults(
  defineProps<{
    chat: ChatController;
    likeCount?: number;
    /** 回放：隐藏输入与验证 */
    isReadonly?: boolean;
    /** 回放禁点赞 */
    showLike?: boolean;
  }>(),
  {
    likeCount: 0,
    isReadonly: false,
    showLike: true,
  },
);
const chat = props.chat;

const emit = defineEmits<{ cart: []; like: []; listScroll: [e: Event] }>();

const inputEl = ref<HTMLInputElement | null>(null);
const mobileInputEl = ref<HTMLInputElement | null>(null);
const showEmoji = ref(false);
/** 加载失败的头像 URL，回退灰圆 */
const brokenAvatars = reactive<Record<string, true>>({});

function avatarSrc(msg: ChatMessage): string {
  const url = msg.avatar?.trim();
  if (!url || brokenAvatars[url]) return "";
  return url;
}

function onAvatarError(url: string | undefined) {
  const key = url?.trim();
  if (key) brokenAvatars[key] = true;
}

function roleBadge(msg: ChatMessage): string | undefined {
  return vhallChatRoleBadge(msg.role_name);
}

function nameClass(msg: ChatMessage): string {
  if (msg.role_name === 1) return "text-red-400";
  if (msg.role_name === 3) return "text-amber-400";
  if (msg.role_name === 4) return "text-violet-400";
  return "text-gray-400";
}

function badgeClass(msg: ChatMessage): string {
  if (msg.role_name === 3) return "bg-amber-500/20 text-amber-400";
  if (msg.role_name === 4) return "bg-violet-500/20 text-violet-400";
  return "bg-red-500/20 text-red-400";
}
/** 小屏输入框是否聚焦（失焦时短暂延迟，避免点发送/表情先塌布局） */
const mobileInputFocused = ref(false);
let mobileBlurTimer: ReturnType<typeof setTimeout> | null = null;

/** 聚焦或已有输入或表情面板打开 → 底栏切到发送态 */
const mobileComposerActive = computed(
  () =>
    mobileInputFocused.value ||
    showEmoji.value ||
    !!chat.chatInput.trim(),
);

function insertEmoji(name: string) {
  const el = inputEl.value ?? mobileInputEl.value;
  const next = insertEmojiAtCursor(el, chat.chatInput, name, 140);
  if (next !== null) chat.chatInput = next;
  showEmoji.value = false;
}

function onMobileFocus() {
  if (mobileBlurTimer) {
    clearTimeout(mobileBlurTimer);
    mobileBlurTimer = null;
  }
  mobileInputFocused.value = true;
  chat.requestChatFocus(mobileInputEl.value);
}

function onMobileBlur() {
  if (mobileBlurTimer) clearTimeout(mobileBlurTimer);
  mobileBlurTimer = setTimeout(() => {
    mobileBlurTimer = null;
    mobileInputFocused.value = false;
  }, 120);
}

function toggleMobileEmoji() {
  showEmoji.value = !showEmoji.value;
  if (showEmoji.value) {
    mobileInputFocused.value = true;
    // 打开表情后尽量把焦点留在输入框，便于插入
    mobileInputEl.value?.focus();
  }
}

function sendMobileChat() {
  void chat.sendChat();
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- 表情面板打开时的全屏遮罩：点面板外任意处关闭 -->
    <div
      v-if="showEmoji"
      class="fixed inset-0 z-40"
      @click="showEmoji = false"
    ></div>

    <!-- 禁言提示 -->
    <div
      v-if="!isReadonly && chat.isChatMuted"
      class="flex flex-none items-center justify-center gap-2 bg-gray-800 px-4 py-2 text-xs text-gray-400"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
      <span>主持人已禁言</span>
    </div>

    <!-- 消息列表 -->
    <div
      :ref="chat.attachListEl"
      class="min-h-0 flex-1 overflow-y-auto p-3"
      @scroll="emit('listScroll', $event)"
    >
      <div
        v-if="chat.chatMessages.length === 0"
        class="flex h-full items-center justify-center text-xs text-gray-500"
      >
        {{ isReadonly ? "暂无聊天记录" : "暂无消息，快来聊两句吧" }}
      </div>
      <div
        v-for="(msg, idx) in chat.chatMessages"
        :key="msg.msgId || idx"
        class="mb-3 flex gap-2"
      >
        <div class="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gray-700">
          <img
            v-if="avatarSrc(msg)"
            :src="avatarSrc(msg)"
            alt=""
            class="h-full w-full object-cover"
            @error="onAvatarError(msg.avatar)"
          >
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="truncate text-xs"
              :class="nameClass(msg)"
            >
              {{ msg.sender_name }}
            </span>
            <span
              v-if="roleBadge(msg)"
              class="flex-none rounded px-1.5 py-0.5 text-[10px]"
              :class="badgeClass(msg)"
            >
              {{ roleBadge(msg) }}
            </span>
          </div>
          <div class="mt-1 inline-block max-w-full break-words rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200">
            <template v-for="(seg, segIdx) in splitEmojiText(msg.msg)" :key="segIdx">
              <img
                v-if="seg.kind === 'emoji'"
                :src="seg.src"
                :alt="seg.name"
                :title="seg.name"
                class="inline-block h-5 w-5 align-text-bottom"
              >
              <span v-else>{{ seg.value }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- PC 输入栏（回放只读不展示） -->
    <div
      v-if="!isReadonly"
      class="hidden flex-none border-t border-gray-800 p-3 md:block"
    >
      <div class="flex items-center gap-2">
        <div class="relative z-50 flex-none">
          <button
            class="rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
            title="表情"
            :disabled="chat.isChatMuted"
            @click="showEmoji = !showEmoji"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <EmojiPanel
            v-if="showEmoji"
            @insert="insertEmoji"
          />
        </div>
        <input
          id="chat-input"
          ref="inputEl"
          v-model="chat.chatInput"
          type="text"
          maxlength="140"
          name="zhibo-chat-message"
          placeholder="参与聊天"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          :disabled="chat.isChatMuted"
          @focus="chat.requestChatFocus(inputEl)"
          @keyup.enter="chat.sendChat"
        >
        <button
          class="flex-none rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          :disabled="chat.isChatMuted || !chat.chatInput.trim()"
          @click="chat.sendChat"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 小屏底栏 -->
    <div class="flex flex-none items-center gap-2 border-t border-gray-800 bg-gray-900 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <!-- 回放：仅小黄车 -->
      <template v-if="isReadonly">
        <div class="min-w-0 flex-1 text-xs text-gray-500">
          回放不支持聊天
        </div>
        <button
          type="button"
          class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-yellow-400 active:bg-gray-700"
          aria-label="购物车"
          @click="emit('cart')"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2.3 2.3c-.4.4-.1 1.1.5 1.1H17M10 20a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </button>
      </template>

      <template v-else>
        <div
          v-if="mobileComposerActive"
          class="relative z-50 flex-none"
        >
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 active:bg-gray-800 disabled:opacity-50"
            aria-label="表情"
            :disabled="chat.isChatMuted"
            @mousedown.prevent
            @click="toggleMobileEmoji"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <EmojiPanel
            v-if="showEmoji"
            @insert="insertEmoji"
          />
        </div>

        <div class="relative z-50 min-w-0 flex-1">
          <input
            id="chat-input-mobile"
            ref="mobileInputEl"
            v-model="chat.chatInput"
            type="text"
            maxlength="140"
            name="zhibo-chat-message"
            placeholder="参与聊天"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            class="w-full rounded-full bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
            :disabled="chat.isChatMuted"
            @focus="onMobileFocus"
            @blur="onMobileBlur"
            @keyup.enter="sendMobileChat"
          >
        </div>

        <button
          v-if="mobileComposerActive"
          type="button"
          class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-gray-200 active:bg-gray-700 disabled:opacity-50"
          aria-label="发送"
          :disabled="chat.isChatMuted || !chat.chatInput.trim()"
          @mousedown.prevent
          @click="sendMobileChat"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>

        <template v-else>
          <button
            type="button"
            class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-yellow-400 active:bg-gray-700"
            aria-label="购物车"
            @click="emit('cart')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2.3 2.3c-.4.4-.1 1.1.5 1.1H17M10 20a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
          <button
            v-if="showLike"
            type="button"
            class="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-red-400 active:bg-gray-700"
            aria-label="点赞"
            @click="emit('like')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span
              v-if="likeCount && likeCount > 0"
              class="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-red-500 px-1 text-center text-[10px] leading-[14px] text-white"
            >
              {{ likeCount > 99999 ? '99999+' : likeCount }}
            </span>
          </button>
        </template>
      </template>
    </div>

    <!-- 假验证弹窗 -->
    <div
      v-if="!isReadonly && chat.showVerifyDialog"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6">
        <h3 class="mb-2 text-lg font-semibold text-white">参与聊天需要验证</h3>
        <p class="mb-4 text-sm text-gray-400">输入任意内容即可完成验证</p>
        <input
          v-model="chat.verifyInput"
          type="text"
          placeholder="输入任意内容..."
          class="mb-4 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
          @keyup.enter="chat.completeVerify(mobileInputEl || inputEl)"
        />
        <div class="flex justify-end gap-2">
          <button
            class="rounded-md bg-transparent px-4 py-2 text-sm text-gray-400 hover:text-white"
            @click="chat.showVerifyDialog = false"
          >
            取消
          </button>
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            :disabled="!chat.verifyInput.trim()"
            @click="chat.completeVerify(mobileInputEl || inputEl)"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
