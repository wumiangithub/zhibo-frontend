<script setup lang="ts">
import { computed, ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";

const props = withDefaults(
  defineProps<{
    /** 输入内容（直播可编辑） */
    modelValue?: string;
    /** 提问模式 */
    askMode?: boolean;
    /** 禁言或业务禁用（仍可展示可编辑外观，仅 opacity） */
    muted?: boolean;
    /** 回放等只读：整栏禁用，不可聚焦/点击 */
    disabled?: boolean;
    /** 只读时的占位提示 */
    disabledPlaceholder?: string;
    /** 是否展开表情/发送态（小屏） */
    active?: boolean;
    /** 是否展示表情面板 */
    showEmoji?: boolean;
    /** 是否展示点赞（active 时优先发送） */
    showLike?: boolean;
    likeCount?: number;
    /** pc | mobile */
    variant?: "mobile" | "pc";
    inputId?: string;
  }>(),
  {
    modelValue: "",
    askMode: false,
    muted: false,
    disabled: false,
    disabledPlaceholder: "回放不支持聊天",
    active: false,
    showEmoji: false,
    showLike: true,
    likeCount: 0,
    variant: "mobile",
    inputId: "chat-input",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:showEmoji": [value: boolean];
  "ask-toggle": [checked: boolean];
  focus: [el: HTMLInputElement | null];
  blur: [];
  send: [];
  like: [];
  "insert-emoji": [name: string];
}>();

const inputEl = ref<HTMLInputElement | null>(null);

defineExpose({ inputEl });

const interactive = computed(() => !props.disabled && !props.muted);

const placeholder = computed(() => {
  if (props.disabled) return props.disabledPlaceholder;
  return props.askMode ? "发起提问" : "参与聊天";
});

const controlsDisabled = computed(() => props.disabled || props.muted);

function onInput(e: Event) {
  if (props.disabled) return;
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}

function onAskClick() {
  if (!interactive.value) return;
  emit("ask-toggle", !props.askMode);
}

function onEmojiToggle() {
  if (!interactive.value) return;
  emit("update:showEmoji", !props.showEmoji);
}

function onSend() {
  if (!interactive.value) return;
  emit("send");
}

function onLike() {
  if (props.disabled) return;
  emit("like");
}

function onFocus() {
  if (props.disabled) return;
  emit("focus", inputEl.value);
}

function onBlur() {
  if (props.disabled) return;
  emit("blur");
}

function onEnter() {
  if (!interactive.value) return;
  emit("send");
}
</script>

<template>
  <!-- PC 横排 -->
  <div
    v-if="variant === 'pc'"
    class="flex items-center gap-2"
    :class="disabled ? 'pointer-events-none' : ''"
  >
    <div
      v-if="!disabled"
      class="relative z-50 flex-none"
    >
      <button
        type="button"
        class="rounded-md bg-[var(--lw-bg-elevated)] p-2 text-[var(--lw-text-secondary)] hover:bg-[var(--lw-border)] hover:text-[var(--lw-text-primary)] disabled:opacity-50"
        title="表情"
        :disabled="controlsDisabled"
        @click="onEmojiToggle"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <EmojiPanel
        v-if="showEmoji"
        @insert="emit('insert-emoji', $event)"
      />
    </div>
    <input
      :id="inputId"
      ref="inputEl"
      type="text"
      maxlength="140"
      name="zhibo-chat-message"
      :value="disabled ? '' : modelValue"
      :placeholder="placeholder"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      class="min-w-0 flex-1 rounded-md bg-[var(--lw-bg-elevated)] px-3 py-2 text-sm text-[var(--lw-text-primary)] placeholder-[var(--lw-text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="controlsDisabled"
      :readonly="disabled"
      :tabindex="disabled ? -1 : undefined"
      @input="onInput"
      @focus="onFocus"
      @keyup.enter="onEnter"
    >
    <button
      type="button"
      role="checkbox"
      class="inline-flex flex-none select-none items-center gap-1.5 text-sm text-[var(--lw-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      :class="disabled ? '' : 'cursor-pointer'"
      title="提问"
      :aria-checked="askMode"
      :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
      :disabled="controlsDisabled"
      @click="onAskClick"
    >
      <span
        class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-2"
        :class="askMode && !disabled ? 'border-[var(--lw-color-ask)] bg-[var(--lw-color-ask)] text-[var(--lw-text-on-brand)]' : 'border-[var(--lw-border-strong)] bg-[var(--lw-bg-elevated)]'"
        aria-hidden="true"
      >
        <svg
          v-if="askMode && !disabled"
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
      v-if="!disabled"
      type="button"
      class="flex-none rounded-md bg-[var(--lw-color-brand)] px-4 py-2 text-sm font-medium text-[var(--lw-text-on-brand)] hover:bg-[var(--lw-color-brand-hover)] disabled:opacity-50"
      :disabled="controlsDisabled || !modelValue.trim()"
      @click="onSend"
    >
      发送
    </button>
  </div>

  <!-- 小屏底栏内容（外层 border / padding 由父级负责） -->
  <template v-else>
    <div
      v-if="active && !disabled"
      class="relative z-50 flex-none"
    >
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-[var(--lw-text-secondary)] active:bg-[var(--lw-bg-elevated)] disabled:opacity-50"
        aria-label="表情"
        :disabled="controlsDisabled"
        @mousedown.prevent
        @click="onEmojiToggle"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <EmojiPanel
        v-if="showEmoji"
        @insert="emit('insert-emoji', $event)"
      />
    </div>

    <div class="relative z-50 min-w-0 flex-1">
      <input
        :id="inputId"
        ref="inputEl"
        type="text"
        maxlength="140"
        name="zhibo-chat-message"
        :value="disabled ? '' : modelValue"
        :placeholder="placeholder"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        class="w-full rounded-full bg-[var(--lw-bg-elevated)] px-3 py-2 text-sm text-[var(--lw-text-primary)] placeholder-[var(--lw-text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="controlsDisabled"
        :readonly="disabled"
        :tabindex="disabled ? -1 : undefined"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="onEnter"
      >
    </div>

    <button
      type="button"
      role="checkbox"
      class="inline-flex flex-none select-none items-center gap-1.5 text-sm text-[var(--lw-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      :class="disabled ? '' : 'cursor-pointer'"
      title="提问"
      :aria-checked="disabled ? false : askMode"
      :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
      :disabled="controlsDisabled"
      @mousedown.prevent
      @click="onAskClick"
    >
      <span
        class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-2"
        :class="askMode && !disabled ? 'border-[var(--lw-color-ask)] bg-[var(--lw-color-ask)] text-[var(--lw-text-on-brand)]' : 'border-[var(--lw-border-strong)] bg-[var(--lw-bg-elevated)]'"
        aria-hidden="true"
      >
        <svg
          v-if="askMode && !disabled"
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
      v-if="active && !disabled"
      type="button"
      class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--lw-bg-elevated)] text-[var(--lw-text-primary)] active:bg-[var(--lw-border)] disabled:opacity-50"
      aria-label="发送"
      :disabled="controlsDisabled || !modelValue.trim()"
      @mousedown.prevent
      @click="onSend"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    </button>

    <button
      v-else-if="showLike && !disabled"
      type="button"
      class="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--lw-bg-elevated)] text-[var(--lw-color-like)] active:bg-[var(--lw-border)]"
      aria-label="点赞"
      @click="onLike"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
      <span
        v-if="likeCount && likeCount > 0"
        class="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-[var(--lw-color-like-badge)] px-1 text-center text-[10px] leading-[14px] text-[var(--lw-text-on-brand)]"
      >
        {{ likeCount > 99999 ? "99999+" : likeCount }}
      </span>
    </button>
  </template>
</template>
