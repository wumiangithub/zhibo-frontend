<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import { splitEmojiText } from "@/constants/emoji";
import type { ChatController } from "@/composables/useChat";
import { formatChatShowTime } from "@/utils/formatChatShowTime";
import { vhallChatRoleBadge } from "@/utils/vhallChatRole";
import { questionAnswerText } from "@/utils/vhallQuestion";
import cartYellowUrl from "@/assets/images/cart-yellow.png";

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
  // 角色昵称色：主持红 / 助理黄 / 嘉宾紫 / 观众灰（与角标色系一致）
  if (msg.role_name === 1) return "text-[#e54d42]/90";
  if (msg.role_name === 3) return "text-amber-400/80";
  if (msg.role_name === 4) return "text-violet-400/80";
  return "text-gray-400";
}

function badgeClass(msg: ChatMessage): string {
  // 截图：主持人红色胶囊白字；其余角色保留浅底圆角
  if (msg.role_name === 3) return "rounded px-1.5 py-0.5 bg-amber-500/20 text-amber-400";
  if (msg.role_name === 4) return "rounded px-1.5 py-0.5 bg-violet-500/20 text-violet-400";
  return "rounded-full bg-[#e54d42] px-1.5 py-0.5 text-white";
}

/** 对齐 demo：相对上一条同日同小时不显示；首条/跨小时显示 HH:mm */
const messageShowTimes = computed(() => {
  const list = chat.chatMessages;
  return list.map((m, i) =>
    formatChatShowTime(i > 0 ? list[i - 1]?.timestamp : null, m.timestamp),
  );
});
/** 空输入点「问」后，下一次发送走提问 */
const askMode = ref(false);
/** 小屏输入框是否聚焦（失焦时短暂延迟，避免点发送/表情先塌布局） */
const mobileInputFocused = ref(false);
let mobileBlurTimer: ReturnType<typeof setTimeout> | null = null;

/** 聚焦或已有输入或表情面板打开 → 底栏切到发送态 */
const mobileComposerActive = computed(
  () =>
    mobileInputFocused.value ||
    showEmoji.value ||
    askMode.value ||
    !!chat.chatInput.trim(),
);

function onAskToggle(checked: boolean) {
  if (chat.isChatMuted) return;
  askMode.value = checked;
  if (checked) {
    const el = mobileInputEl.value ?? inputEl.value;
    chat.requestChatFocus(el);
  }
}

function sendCurrent() {
  if (askMode.value) {
    void chat.sendQuestion();
    return;
  }
  void chat.sendChat();
}

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
  sendCurrent();
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <!-- 表情面板打开时的全屏遮罩：点面板外任意处关闭 -->
    <div
      v-if="showEmoji"
      class="fixed inset-0 z-40"
      @click="showEmoji = false"
    ></div>

    <!-- 小黄车：悬浮右下角（底栏之上） -->
    <button
      type="button"
      class="absolute right-2 z-30 flex h-14 w-14 items-center justify-center active:scale-95 md:hidden"
      style="bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px))"
      aria-label="购物车"
      @click="emit('cart')"
    >
      <img
        :src="cartYellowUrl"
        alt=""
        class="h-12 w-12 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
        draggable="false"
      >
    </button>

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
      <template
        v-for="(msg, idx) in chat.chatMessages"
        :key="msg.msgId || idx"
      >
        <div
          v-if="messageShowTimes[idx]"
          class="py-3 text-center text-[14px] leading-5 text-[#999]"
        >
          {{ messageShowTimes[idx] }}
        </div>
        <div class="mb-3 flex gap-2">
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
            <!-- 昵称在前，角色角标紧跟其后 -->
            <div class="flex items-center gap-1.5">
              <span
                class="min-w-0 truncate text-xs leading-4"
                :class="nameClass(msg)"
              >
                {{ msg.sender_name }}
              </span>
              <span
                v-if="roleBadge(msg)"
                class="flex-none text-[10px] leading-4"
                :class="badgeClass(msg)"
              >
                {{ roleBadge(msg) }}
              </span>
              <span
                v-if="msg.kind === 'question'"
                class="flex-none rounded bg-sky-500/25 px-1.5 py-0.5 text-[10px] leading-4 text-sky-200"
              >
                问
              </span>
            </div>
            <!-- 同一暗色气泡：上引用（竖条+浅灰小字）/ 下正文（更大更白），非分离卡片 -->
            <div
              v-if="msg.reply || msg.msg?.trim() || msg.answer"
              class="mt-1 inline-block max-w-full rounded-[14px] bg-[#3a3a3a] px-3 py-2.5"
            >
              <div
                v-if="msg.reply"
                class="mb-2 flex items-stretch gap-2 text-[12px] leading-[18px] text-[#9a9a9a]"
              >
                <!-- 独立竖条：浅灰/白灰，避免与气泡 #3a3a3a 同色看不见 -->
                <span
                  class="w-[2px] flex-none self-stretch bg-[#d9d9d9]"
                  aria-hidden="true"
                />
                <span class="min-w-0 break-all">{{ msg.reply.nickname ? `${msg.reply.nickname} ${msg.reply.content}` : msg.reply.content }}</span>
              </div>
              <div
                v-if="msg.msg?.trim()"
                class="break-words text-[14px] leading-5 text-white"
              >
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
              <div
                v-if="questionAnswerText(msg)"
                class="mt-2 border-t border-white/10 pt-2 text-[12px] leading-[18px] text-[#c8c8c8]"
              >
                {{ questionAnswerText(msg) }}
              </div>
            </div>
            <div
              v-if="msg.imageUrls?.length"
              class="mt-1 flex max-w-full flex-wrap gap-1.5"
            >
              <a
                v-for="(src, imgIdx) in msg.imageUrls"
                :key="`${msg.msgId || idx}-img-${imgIdx}`"
                :href="src.startsWith('//') ? `https:${src}` : src"
                target="_blank"
                rel="noopener noreferrer"
                class="block overflow-hidden rounded-md bg-gray-800"
              >
                <img
                  :src="src"
                  alt="聊天图片"
                  class="max-h-40 max-w-[180px] object-contain"
                  loading="lazy"
                >
              </a>
            </div>
          </div>
        </div>
      </template>
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
          :placeholder="askMode ? '发起提问' : '参与聊天'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          :disabled="chat.isChatMuted"
          @focus="chat.requestChatFocus(inputEl)"
          @keyup.enter="sendCurrent"
        >
        <button
          type="button"
          role="checkbox"
          class="inline-flex flex-none cursor-pointer select-none items-center gap-1.5 text-sm text-gray-200 disabled:opacity-50"
          title="提问"
          :aria-checked="askMode"
          :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
          :disabled="chat.isChatMuted"
          @click="onAskToggle(!askMode)"
        >
          <span
            class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-2"
            :class="askMode ? 'border-sky-400 bg-sky-500 text-white' : 'border-gray-300 bg-gray-800'"
            aria-hidden="true"
          >
            <svg
              v-if="askMode"
              class="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>问</span>
        </button>
        <button
          class="flex-none rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          :disabled="chat.isChatMuted || !chat.chatInput.trim()"
          @click="sendCurrent"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 小屏底栏（小黄车已改为悬浮） -->
    <div class="flex flex-none items-center gap-2 border-t border-gray-800 bg-gray-900 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <template v-if="isReadonly">
        <div class="min-w-0 flex-1 text-xs text-gray-500">
          回放不支持聊天
        </div>
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
            :placeholder="askMode ? '发起提问' : '参与聊天'"
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
          type="button"
          role="checkbox"
          class="inline-flex flex-none cursor-pointer select-none items-center gap-1.5 text-sm text-gray-200 disabled:opacity-50"
          title="提问"
          :aria-checked="askMode"
          :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
          :disabled="chat.isChatMuted"
          @mousedown.prevent
          @click="onAskToggle(!askMode)"
        >
          <span
            class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-2"
            :class="askMode ? 'border-sky-400 bg-sky-500 text-white' : 'border-gray-300 bg-gray-800'"
            aria-hidden="true"
          >
            <svg
              v-if="askMode"
              class="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>问</span>
        </button>

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

        <button
          v-else-if="showLike"
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
