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

const sendReady = computed(() => props.modelValue.trim().length > 0);

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
    class="relative flex items-center gap-2"
    :class="[disabled ? 'pointer-events-none' : '', controlsDisabled ? 'opacity-[0.45]' : '']"
  >
    <button
      v-if="!disabled"
      type="button"
      class="relative z-50 flex h-10 w-10 flex-none items-center justify-center rounded-xl"
      :class="showEmoji
        ? 'bg-[var(--lw-color-primary-muted)] text-[var(--lw-color-primary)]'
        : 'bg-transparent text-[var(--lw-text-secondary)]'"
      title="表情"
      :disabled="controlsDisabled"
      @mousedown.prevent
      @click="onEmojiToggle"
    >
      <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
    <div
      class="composer-capsule relative z-50 flex h-10 min-w-0 flex-1 items-center gap-[5px] rounded-xl bg-[var(--lw-bg-elevated)] pl-[14px] pr-3"
    >
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
        class="min-w-0 flex-1 bg-transparent text-sm leading-5 text-[var(--lw-text-primary)] placeholder-[var(--lw-text-muted)] focus:outline-none disabled:cursor-not-allowed"
        :disabled="controlsDisabled"
        :readonly="disabled"
        :tabindex="disabled ? -1 : undefined"
        @input="onInput"
        @focus="onFocus"
        @keyup.enter="onEnter"
      >
      <button
        v-if="!disabled"
        type="button"
        role="checkbox"
        class="inline-flex flex-none select-none items-center gap-[5px] text-sm leading-[18px] text-[var(--lw-text-secondary)] disabled:cursor-not-allowed"
        :class="controlsDisabled ? '' : 'cursor-pointer'"
        title="提问"
        :aria-checked="askMode"
        :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
        :disabled="controlsDisabled"
        @mousedown.prevent
        @click="onAskClick"
      >
        <svg
          v-if="askMode"
          class="h-[18px] w-[18px] flex-none text-[var(--lw-color-ask)]"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="9" fill="currentColor" />
          <circle cx="9" cy="9" r="6.4" fill="none" stroke="var(--lw-text-on-brand)" stroke-width="2" />
        </svg>
        <svg
          v-else
          class="h-[18px] w-[18px] flex-none text-[var(--lw-border-strong)]"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span>问</span>
      </button>
    </div>
    <button
      v-if="!disabled"
      type="button"
      class="flex h-10 min-w-[72px] flex-none items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-100"
      :class="sendReady
        ? 'bg-[var(--lw-color-primary)] text-[var(--lw-text-on-brand)] hover:bg-[var(--lw-color-primary-hover)]'
        : 'bg-[var(--lw-bg-elevated)] text-[var(--lw-text-muted)]'"
      :disabled="controlsDisabled || !sendReady"
      @mousedown.prevent
      @click="onSend"
    >
      发送
    </button>
    <EmojiPanel
      v-if="showEmoji && !disabled"
      variant="dock"
      @insert="emit('insert-emoji', $event)"
    />
  </div>

  <!-- 小屏底栏内容（外层 border / padding 由父级负责；表情 sheet 由 ChatPanel 挂在输入行上方） -->
  <div
    v-else
    class="flex min-w-0 flex-1 items-center gap-2"
    :class="controlsDisabled ? 'opacity-[0.45]' : ''"
  >
    <button
      v-if="active && !disabled"
      type="button"
      class="flex h-10 w-10 flex-none items-center justify-center rounded-full"
      :class="showEmoji
        ? 'bg-[var(--lw-color-primary-muted)] text-[var(--lw-color-primary)]'
        : 'text-[var(--lw-text-secondary)]'"
      aria-label="表情"
      :disabled="controlsDisabled"
      @mousedown.prevent
      @click="onEmojiToggle"
    >
      <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>

    <div
      class="composer-capsule composer-capsule--mobile relative z-50 flex h-10 min-w-0 flex-1 items-center gap-[5px] rounded-full bg-[var(--lw-bg-elevated)] pl-[14px] pr-3"
    >
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
        class="min-w-0 flex-1 bg-transparent text-sm leading-5 text-[var(--lw-text-primary)] placeholder-[var(--lw-text-muted)] focus:outline-none disabled:cursor-not-allowed"
        :disabled="controlsDisabled"
        :readonly="disabled"
        :tabindex="disabled ? -1 : undefined"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="onEnter"
      >
      <button
        v-if="!disabled"
        type="button"
        role="checkbox"
        class="inline-flex flex-none select-none items-center gap-[5px] text-sm leading-5 text-[var(--lw-text-secondary)] disabled:cursor-not-allowed"
        :class="controlsDisabled ? '' : 'cursor-pointer'"
        title="提问"
        :aria-checked="askMode"
        :aria-label="askMode ? '取消提问模式' : '开启提问模式'"
        :disabled="controlsDisabled"
        @mousedown.prevent
        @click="onAskClick"
      >
        <!-- 开：实心 --lw-color-ask 圆 + 2px 白环；关：--lw-border-strong 细圈。字始终 secondary -->
        <svg
          v-if="askMode"
          class="h-[18px] w-[18px] flex-none text-[var(--lw-color-ask)]"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="9" fill="currentColor" />
          <circle cx="9" cy="9" r="6.4" fill="none" stroke="var(--lw-text-on-brand)" stroke-width="2" />
        </svg>
        <svg
          v-else
          class="h-[18px] w-[18px] flex-none text-[var(--lw-border-strong)]"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span>问</span>
      </button>
    </div>

    <button
      v-if="active && !disabled"
      type="button"
      class="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors duration-150"
      :class="sendReady
        ? 'bg-[var(--lw-color-primary)] text-[var(--lw-text-on-brand)] active:bg-[var(--lw-color-primary-hover)]'
        : 'bg-[var(--lw-bg-elevated)] text-[var(--lw-text-muted)]'"
      aria-label="发送"
      :disabled="controlsDisabled || !sendReady"
      @mousedown.prevent
      @click="onSend"
    >
      <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    </button>

    <button
      v-else-if="showLike && !disabled"
      type="button"
      class="like-btn relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--lw-color-like-muted)] text-[var(--lw-color-like)]"
      aria-label="点赞"
      @click="onLike"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
      <span
        v-if="likeCount && likeCount > 0"
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--lw-color-like-badge)] px-1 text-center text-[10px] font-medium leading-4 text-[var(--lw-text-on-brand)] shadow-[0_0_0_1.5px_var(--lw-bg-chrome)]"
      >
        {{ likeCount > 99999 ? "99999+" : likeCount }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.composer-capsule:focus-within {
  box-shadow: 0 0 0 2px var(--lw-color-primary-muted), 0 0 0 1px var(--lw-color-primary);
}
.composer-capsule--ask:not(:focus-within) {
  background: color-mix(in srgb, var(--lw-color-ask-muted) 80%, var(--lw-bg-elevated));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--lw-color-ask) 28%, transparent);
}
/* 小屏不要聚焦蓝环，提问开也不染色 */
.composer-capsule--mobile:focus-within {
  box-shadow: none;
}
.like-btn:active {
  filter: brightness(0.96);
}
</style>
