<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import ChatComposerBar from "@/components/watch/ChatComposerBar.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import { splitEmojiText } from "@/constants/emoji";
import type { ChatController } from "@/composables/useChat";
import { formatChatShowTime } from "@/utils/formatChatShowTime";
import { nicknameInitial } from "@/utils/nicknameInitial";
import { vhallChatRoleBadge } from "@/utils/vhallChatRole";
import { questionAnswerText } from "@/utils/vhallQuestion";
import cartYellowUrl from "@/assets/images/cart-yellow.png";
import couponFloatUrl from "@/assets/images/coupon-float.png";

const props = withDefaults(
  defineProps<{
    chat: ChatController;
    likeCount?: number;
    /** 回放：输入栏禁用，不可发消息/提问 */
    isReadonly?: boolean;
    /** 回放禁点赞 */
    showLike?: boolean;
    /** 本场有可领券时展示悬浮「券」图标 */
    showCouponIcon?: boolean;
  }>(),
  {
    likeCount: 0,
    isReadonly: false,
    showLike: true,
    showCouponIcon: false,
  },
);
const chat = props.chat;

type ClaimChatCouponPayload = NonNullable<ChatMessage["coupon"]> & {
  employeeName?: string;
};

const emit = defineEmits<{
  cart: [];
  coupon: [];
  claimCoupon: [coupon: ClaimChatCouponPayload];
  like: [];
  listScroll: [e: Event];
}>();

function formatCouponAmount(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n)) return n.toFixed(2);
  return raw.trim() || "0.00";
}

function formatCouponValidity(start?: string, end?: string): string {
  const a = (start || "").replace(/-/g, ".").slice(0, 10);
  const b = (end || "").replace(/-/g, ".").slice(0, 10);
  if (!a && !b) return "";
  return `${a || "—"}至${b || "—"}`;
}

function onClaimCoupon(msg: ChatMessage) {
  if (!msg.coupon) return;
  emit("claimCoupon", {
    ...msg.coupon,
    employeeName: msg.sender_name?.trim() || undefined,
  });
}

const pcComposerRef = ref<{ inputEl: HTMLInputElement | null } | null>(null);
const mobileComposerRef = ref<{ inputEl: HTMLInputElement | null } | null>(null);
const showEmoji = ref(false);
/** 加载失败的头像 URL，回退文字头像 */
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
  // 昵称一律主文字白；身份颜色只放在角标上。观众次级字色
  if (msg.role_name === 1 || msg.role_name === 3 || msg.role_name === 4) {
    return "text-[var(--lw-text-primary)]";
  }
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

    <!-- 优惠券：右上角，软立体票券图，尺寸对齐小黄车 -->
    <button
      v-if="showCouponIcon"
      type="button"
      class="absolute top-2 right-2 z-30 flex h-14 w-14 items-center justify-center active:scale-95 md:hidden"
      aria-label="优惠券"
      @click="emit('coupon')"
    >
      <img
        :src="couponFloatUrl"
        alt=""
        class="h-12 w-12 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
        draggable="false"
      >
    </button>

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
          <div
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--lw-bg-elevated)] text-[13px] font-semibold"
            :class="nameClass(msg)"
          >
            <img
              v-if="avatarSrc(msg)"
              :src="avatarSrc(msg)"
              alt=""
              class="h-full w-full object-cover"
              @error="onAvatarError(msg.avatar)"
            >
            <template v-else>{{ nicknameInitial(msg.sender_name) }}</template>
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
            <button
              v-if="msg.kind === 'coupon' && msg.coupon"
              type="button"
              class="msg-coupon mt-1"
              aria-label="领取优惠券"
              @click="onClaimCoupon(msg)"
            >
              <div class="msg-coupon-main">
                <span class="msg-coupon-tag">优惠券</span>
                <div class="msg-coupon-amount">
                  <span class="yen">¥</span>{{ formatCouponAmount(msg.coupon.couponAmount) }}
                </div>
                <div class="msg-coupon-name">
                  {{ msg.coupon.couponName }}
                </div>
                <div
                  v-if="msg.coupon.couponStartDate || msg.coupon.couponEndDate"
                  class="msg-coupon-valid"
                >
                  {{ formatCouponValidity(msg.coupon.couponStartDate, msg.coupon.couponEndDate) }}
                </div>
              </div>
              <div
                class="msg-coupon-action"
                aria-hidden="true"
              >
                <span class="msg-coupon-claim">领取</span>
              </div>
            </button>
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

<style scoped>
.msg-coupon {
  display: flex;
  align-items: stretch;
  max-width: 260px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: linear-gradient(120deg, #ffc56e 0%, #ff9a3c 42%, #ff7f2a 100%);
  color: #fff;
  text-shadow: 0 1px 1px rgb(180 70 0 / 28%);
  box-shadow: 0 6px 16px rgb(240 120 40 / 24%);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.msg-coupon:active {
  transform: scale(0.99);
  filter: brightness(0.97);
}

.msg-coupon-main {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 10px 12px 10px 12px;
}

.msg-coupon-tag {
  display: inline-block;
  margin-bottom: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.msg-coupon-amount {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.msg-coupon-amount .yen {
  margin-right: 2px;
  font-size: 14px;
  font-weight: 600;
}

.msg-coupon-name {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 600;
  word-break: break-word;
}

.msg-coupon-valid {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.3;
  color: rgb(255 255 255 / 92%);
  font-variant-numeric: tabular-nums;
}

/* 票根区：虚线撕口 + 上下半圆缺口，右侧竖排「领取」 */
.msg-coupon-action {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  border-left: 1px dashed rgb(255 255 255 / 65%);
  background: rgb(255 255 255 / 14%);
}

.msg-coupon-action::before,
.msg-coupon-action::after {
  content: "";
  position: absolute;
  left: -6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--lw-bg-panel);
}

.msg-coupon-action::before {
  top: -6px;
}

.msg-coupon-action::after {
  bottom: -6px;
}

.msg-coupon-claim {
  writing-mode: vertical-rl;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.28em;
  line-height: 1;
}
</style>
