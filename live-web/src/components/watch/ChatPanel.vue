<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import ChatComposerBar from "@/components/watch/ChatComposerBar.vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
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

function nameClass(_msg: ChatMessage): string {
  // 昵称统一次级字色；身份只靠角标区分（对齐白天参考稿）
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

/** PC 消息行内时钟；解析失败则空 */
function formatMessageClock(ts: unknown): string {
  if (ts == null || ts === "") return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
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
    <!-- PC：全屏点外侧关闭表情浮层；小屏遮罩只盖消息列表，见下方 -->
    <div
      v-if="showEmoji"
      class="fixed inset-0 z-40 hidden md:block"
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
        class="float-icon h-12 w-12 object-contain"
        draggable="false"
      >
    </button>

    <!-- 小黄车：悬浮右下角（底栏之上） -->
    <button
      v-show="!showEmoji"
      type="button"
      class="absolute right-2 z-30 flex h-14 w-14 items-center justify-center active:scale-95 md:hidden"
      style="bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px))"
      aria-label="购物车"
      @click="emit('cart')"
    >
      <img
        :src="cartYellowUrl"
        alt=""
        class="float-icon h-12 w-12 object-contain"
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
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        :ref="chat.attachListEl"
        class="min-h-0 flex-1 overflow-y-auto p-3 md:px-4 md:pb-2 md:pt-4"
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
          class="py-3 text-center text-[14px] leading-5 text-[var(--lw-text-muted)] md:hidden"
        >
          {{ messageShowTimes[idx] }}
        </div>
        <div class="mb-3.5 flex gap-2.5 md:mb-4">
          <div
            class="chat-avatar flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold md:h-7 md:w-7"
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
            <div class="flex items-baseline gap-1.5 md:mb-1.5 md:gap-2">
              <span
                class="min-w-0 truncate text-xs leading-4"
                :class="nameClass(msg)"
              >
                {{ msg.sender_name }}
              </span>
              <span
                v-if="roleBadge(msg)"
                class="flex-none self-center text-[10px] leading-4"
                :class="badgeClass(msg)"
              >
                {{ roleBadge(msg) }}
              </span>
              <span
                v-if="msg.kind === 'question'"
                class="ask-chip self-center"
              >
                问
              </span>
              <span
                v-if="formatMessageClock(msg.timestamp)"
                class="hidden flex-none text-[11px] leading-4 text-[var(--lw-text-muted)] md:inline"
              >
                {{ formatMessageClock(msg.timestamp) }}
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
            <!-- 气泡：普通聊天；提问则气泡内「提问」角标 + 正文加粗加深 -->
            <div
              v-if="msg.reply || msg.msg?.trim() || msg.answer"
              class="chat-bubble mt-1.5 inline-block max-w-full rounded-[10px] bg-[var(--lw-bg-bubble)] px-3 py-2.5 md:mt-0 md:rounded-[4px_12px_12px_12px] md:border md:border-[var(--lw-bubble-border)] md:px-3 md:py-2 md:shadow-[var(--lw-bubble-shadow)]"
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
                class="chat-msg-body break-words text-[14px] leading-5 md:leading-[22px]"
                :class="msg.kind === 'question' ? 'chat-msg-ask' : 'chat-msg-normal'"
              >
                <span
                  v-if="msg.kind === 'question'"
                  class="ask-tag"
                >提问</span>
                <span class="chat-msg-text">
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
                </span>
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
      <div
        v-if="showEmoji"
        class="absolute inset-0 z-40 md:hidden"
        @click="showEmoji = false"
      ></div>
    </div>

    <!-- PC 输入栏（回放展示禁用态） -->
    <div class="hidden flex-none border-t border-[var(--lw-border)] bg-[var(--lw-bg-chrome)] p-3 md:block">
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

    <!-- 小屏底栏（表情 sheet 走文档流，在输入行上方把列表往上挤；安全区沿用父级） -->
    <div class="relative z-50 flex flex-none flex-col border-t border-[var(--lw-border)] bg-[var(--lw-bg-chrome)] md:hidden">
      <EmojiPanel
        v-if="showEmoji && !isReadonly"
        variant="sheet"
        @insert="insertEmoji"
      />
      <div class="flex items-center gap-2 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
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
          class="mb-4 w-full rounded-md border border-[var(--lw-border-strong)] bg-[var(--lw-bg-panel)] px-3 py-2 text-sm text-[var(--lw-text-primary)] placeholder:text-[var(--lw-text-muted)] focus:border-[var(--lw-color-primary)] focus:outline-none"
          @keyup.enter="chat.completeVerify(resolveInputEl())"
        >
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md bg-transparent px-4 py-2 text-sm text-[var(--lw-text-secondary)] hover:text-[var(--lw-text-primary)]"
            @click="chat.showVerifyDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-md bg-[var(--lw-color-primary)] px-4 py-2 text-sm font-medium text-[var(--lw-text-on-brand)] hover:bg-[var(--lw-color-primary-hover)] disabled:opacity-50"
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
.float-icon {
  filter: var(--lw-float-icon-filter);
}

.chat-avatar {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
}

.chat-bubble {
  border: 1px solid var(--lw-bubble-border);
  box-shadow: var(--lw-bubble-shadow);
}

.chat-msg-body {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.chat-msg-text {
  min-width: 0;
  flex: 1;
  /* 与 leading-5（20px）对齐，标签同高垂直居中首行 */
  line-height: 20px;
}

.chat-msg-normal {
  color: var(--lw-text-primary);
  font-weight: 400;
}

.chat-msg-ask {
  /* 比普通消息略重即可，勿纯黑加粗抢戏 */
  color: var(--lw-text-primary);
  font-weight: 500;
}

.ask-chip {
  flex: none;
  border-radius: 4px;
  padding: 1px 6px;
  background: var(--lw-color-ask-muted);
  color: var(--lw-color-ask);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
}

.ask-tag {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--lw-color-ask-muted);
  color: var(--lw-color-ask);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.msg-coupon {
  display: flex;
  align-items: stretch;
  max-width: 260px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: #e85a0c;
  color: #fff;
  text-shadow: 0 1px 2px rgb(80 25 0 / 32%);
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
  overflow: hidden;
}

.msg-coupon-main::after {
  content: "";
  position: absolute;
  right: -8px;
  top: -28px;
  width: 90px;
  height: 70px;
  border-radius: 50%;
  background: rgb(255 197 110 / 25%);
  pointer-events: none;
  z-index: 0;
}

.msg-coupon-tag {
  position: relative;
  z-index: 1;
  display: inline-block;
  margin-bottom: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 28%);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.msg-coupon-amount {
  position: relative;
  z-index: 1;
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
  position: relative;
  z-index: 1;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 600;
  word-break: break-word;
}

.msg-coupon-valid {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.3;
  color: rgb(255 255 255 / 96%);
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
