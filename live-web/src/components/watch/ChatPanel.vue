<script setup lang="ts">
import { ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import { splitEmojiText } from "@/constants/emoji";
import type { ChatController } from "@/composables/useChat";

const props = defineProps<{ chat: ChatController }>();
const chat = props.chat;

const inputEl = ref<HTMLInputElement | null>(null);
const showEmoji = ref(false);

function insertEmoji(name: string) {
  const next = insertEmojiAtCursor(inputEl.value, chat.chatInput, name, 140);
  if (next !== null) chat.chatInput = next;
  showEmoji.value = false;
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
      v-if="chat.isChatMuted"
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
    >
      <div
        v-if="chat.chatMessages.length === 0"
        class="flex h-full items-center justify-center text-xs text-gray-500"
      >
        暂无消息，快来聊两句吧
      </div>
      <div
        v-for="(msg, idx) in chat.chatMessages"
        :key="msg.msgId || idx"
        class="mb-3 flex gap-2"
      >
        <div class="h-8 w-8 flex-shrink-0 rounded-full bg-gray-700"></div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="truncate text-xs"
              :class="msg.is_host ? 'text-red-400' : 'text-gray-400'"
            >
              {{ msg.sender_name }}
            </span>
            <span
              v-if="msg.is_host"
              class="flex-none rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400"
            >
              主持人
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

    <!-- 输入栏 -->
    <div class="flex-none border-t border-gray-800 p-3">
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
          placeholder="参与聊天"
          class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          :disabled="chat.isChatMuted"
          @focus="chat.requestChatFocus(inputEl)"
          @keyup.enter="chat.sendChat"
        />
        <button
          class="flex-none rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          :disabled="chat.isChatMuted || !chat.chatInput.trim()"
          @click="chat.sendChat"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 假验证弹窗 -->
    <div
      v-if="chat.showVerifyDialog"
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
          @keyup.enter="chat.completeVerify(inputEl)"
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
            @click="chat.completeVerify(inputEl)"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
