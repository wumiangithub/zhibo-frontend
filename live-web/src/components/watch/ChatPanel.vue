<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import ChatComposerBar from "@/components/watch/ChatComposerBar.vue";
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
    /** 回放：输入栏禁用，不可发消息/提问 */
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

const pcComposerRef = ref<{ inputEl: HTMLInputElement | null } | null>(null);
const mobileComposerRef = ref<{ inputEl: HTMLInputElement | null } | null>(null);
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
  // 昵称用次级字色保证暗底可读；身份靠角标，不整名刷品牌色
  if (msg.role_name === 1) return "text-[var(--lw-text-primary)]";
  if (msg.role_name === 3) return "text-[var(--lw-color-assistant)]";
  if (msg.role_name === 4) return "text-[var(--lw-color-guest)]";
  return "text-[var(--lw-text-secondary)]";
}

function badgeClass(msg: ChatMessage): string {
  if (msg.role_name === 3) {
    return "rounded px-1.5 py-0.5 bg-[var(--lw-color-assistant-muted)] text-[var(--lw-color-assistant)]";
  }
  if (msg.role_name === 4) {
    return "rounded px-1.5 py-0.5 bg-[var(--lw-color-guest-muted)] text-[var(--lw-color-guest)]";
  }
  return "rounded-full bg-[var(--lw-color-host-badge)] px-1.5 py-0.5 text-[var(--lw-text-on-brand)]";
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
    !props.isReadonly &&
    (mobileInputFocused.value ||
      showEmoji.value ||
      askMode.value ||
      !!chat.chatInput.trim()),
);

function resolveInputEl(prefer?: HTMLInputElement | null) {
  return (
    prefer ??
    mobileComposerRef.value?.inputEl ??
    pcComposerRef.value?.inputEl ??
    null
  );
}

function onAskToggle(checked: boolean) {
  if (props.isReadonly || chat.isChatMuted) return;
  askMode.value = checked;
  if (checked) {
    chat.requestChatFocus(resolveInputEl());
  }
}

function sendCurrent() {
  if (props.isReadonly) return;
  if (askMode.value) {
    void chat.sendQuestion();
    return;
  }
  void chat.sendChat();
}

function insertEmoji(name: string) {
  if (props.isReadonly) return;
  const el = resolveInputEl();
  const next = insertEmojiAtCursor(el, chat.chatInput, name, 140);
  if (next !== null) chat.chatInput = next;
  showEmoji.value = false;
}

function onMobileFocus(el: HTMLInputElement | null) {
  if (props.isReadonly) return;
  if (mobileBlurTimer) {
    clearTimeout(mobileBlurTimer);
    mobileBlurTimer = null;
  }
  mobileInputFocused.value = true;
  chat.requestChatFocus(el ?? mobileComposerRef.value?.inputEl ?? null);
}

function onMobileBlur() {
  if (mobileBlurTimer) clearTimeout(mobileBlurTimer);
  mobileBlurTimer = setTimeout(() => {
    mobileBlurTimer = null;
    mobileInputFocused.value = false;
  }, 120);
}

function onPcShowEmojiUpdate(open: boolean) {
  if (props.isReadonly) return;
  showEmoji.value = open;
}

function onMobileShowEmojiUpdate(open: boolean) {
  if (props.isReadonly) return;
  showEmoji.value = open;
  if (open) {
    mobileInputFocused.value = true;
    mobileComposerRef.value?.inputEl?.focus();
  }
}

function onChatInputUpdate(value: string) {
  if (props.isReadonly) return;
  chat.chatInput = value;
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
      class="flex flex-none items-center justify-center gap-2 bg-[var(--lw-bg-elevated)] px-4 py-2 text-xs text-[var(--lw-text-secondary)]"
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
        class="flex h-full items-center justify-center text-xs text-[var(--lw-text-muted)]"
      >
        {{ isReadonly ? "暂无聊天记录" : "暂无消息，快来聊两句吧" }}
      </div>
      <template
        v-for="(msg, idx) in chat.chatMessages"
        :key="msg.msgId || idx"
      >
        <div
          v-if="messageShowTimes[idx]"
          class="py-3 text-center text-[14px] leading-5 text-[var(--lw-text-muted)]"
        >
          {{ messageShowTimes[idx] }}
        </div>
        <div class="mb-3 flex gap-2">
          <div class="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-[var(--lw-bg-elevated)]">
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
                class="flex-none rounded bg-[var(--lw-color-ask-muted)] px-1.5 py-0.5 text-[10px] leading-4 text-[var(--lw-color-ask)]"
              >
                问
              </span>
            </div>
            <!-- 同一暗色气泡：上引用（竖条+浅灰小字）/ 下正文（更大更白），非分离卡片 -->
            <div
              v-if="msg.reply || msg.msg?.trim() || msg.answer"
              class="mt-1 inline-block max-w-full rounded-[14px] bg-[var(--lw-bg-bubble)] px-3 py-2.5"
            >
              <div
                v-if="msg.reply"
                class="mb-2 flex items-stretch gap-2 text-[12px] leading-[18px] text-[var(--lw-text-secondary)]"
              >
                <span
                  class="w-[2px] flex-none self-stretch bg-[var(--lw-text-muted)]"
                  aria-hidden="true"
                />
                <span class="min-w-0 break-all">{{ msg.reply.nickname ? `${msg.reply.nickname} ${msg.reply.content}` : msg.reply.content }}</span>
              </div>
              <div
                v-if="msg.msg?.trim()"
                class="break-words text-[14px] leading-5 text-[var(--lw-text-primary)]"
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
                class="mt-2 border-t border-[var(--lw-border)] pt-2 text-[12px] leading-[18px] text-[var(--lw-text-secondary)]"
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
                class="block overflow-hidden rounded-md bg-[var(--lw-bg-elevated)]"
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

    <!-- PC 输入栏（回放展示禁用态） -->
    <div class="hidden flex-none border-t border-[var(--lw-border)] p-3 md:block">
      <ChatComposerBar
        ref="pcComposerRef"
        variant="pc"
        input-id="chat-input"
        :model-value="chat.chatInput"
        :ask-mode="askMode"
        :muted="chat.isChatMuted"
        :disabled="isReadonly"
        :show-emoji="showEmoji"
        @update:model-value="onChatInputUpdate"
        @update:show-emoji="onPcShowEmojiUpdate"
        @ask-toggle="onAskToggle"
        @focus="(el) => chat.requestChatFocus(el)"
        @send="sendCurrent"
        @insert-emoji="insertEmoji"
      />
    </div>

    <!-- 小屏底栏（小黄车已改为悬浮；回放同外观但禁用） -->
    <div class="flex flex-none items-center gap-2 border-t border-[var(--lw-border)] bg-[var(--lw-bg-panel)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <ChatComposerBar
        ref="mobileComposerRef"
        variant="mobile"
        input-id="chat-input-mobile"
        :model-value="chat.chatInput"
        :ask-mode="askMode"
        :muted="chat.isChatMuted"
        :disabled="isReadonly"
        :active="mobileComposerActive"
        :show-emoji="showEmoji"
        :show-like="showLike"
        :like-count="likeCount"
        @update:model-value="onChatInputUpdate"
        @update:show-emoji="onMobileShowEmojiUpdate"
        @ask-toggle="onAskToggle"
        @focus="onMobileFocus"
        @blur="onMobileBlur"
        @send="sendCurrent"
        @like="emit('like')"
        @insert-emoji="insertEmoji"
      />
    </div>

    <!-- 假验证弹窗 -->
    <div
      v-if="!isReadonly && chat.showVerifyDialog"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--lw-bg-overlay)] p-4"
    >
      <div class="w-full max-w-sm rounded-lg bg-[var(--lw-bg-elevated)] p-6">
        <h3 class="mb-2 text-lg font-semibold text-[var(--lw-text-primary)]">参与聊天需要验证</h3>
        <p class="mb-4 text-sm text-[var(--lw-text-secondary)]">输入任意内容即可完成验证</p>
        <input
          v-model="chat.verifyInput"
          type="text"
          placeholder="输入任意内容..."
          class="mb-4 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
          @keyup.enter="chat.completeVerify(resolveInputEl())"
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
            @click="chat.completeVerify(resolveInputEl())"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
