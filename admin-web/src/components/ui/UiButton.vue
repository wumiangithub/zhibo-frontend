<script setup lang="ts">
withDefaults(
  defineProps<{
    /** primary 实心蓝；outline 蓝框蓝字；default 灰框；link 纯文字链 */
    variant?: "primary" | "outline" | "default" | "link";
    /** 右侧下拉箭头 */
    dropdown?: boolean;
    disabled?: boolean;
    /**
     * 仅禁用外观，仍可点击（如绑报备后点「添加主播」要 toast）。
     * 与 disabled 同时为 true 时以真正禁用为准。
     */
    lookDisabled?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "default",
    dropdown: false,
    disabled: false,
    lookDisabled: false,
    type: "button",
  },
);
</script>

<template>
  <button
    :type="type"
    class="ui-btn"
    :class="[
      `is-${variant}`,
      { 'is-dropdown': dropdown, 'is-look-disabled': lookDisabled && !disabled },
    ]"
    :disabled="disabled"
  >
    <slot />
    <svg
      v-if="dropdown"
      class="ui-btn__caret"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  </button>
</template>

<style scoped>
.ui-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}

.ui-btn:disabled,
.ui-btn.is-look-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-btn.is-look-disabled:hover {
  /* 禁用外观时不要出现可点悬停态 */
  border-color: inherit;
  background: inherit;
  color: inherit;
  text-decoration: none;
}

.ui-btn.is-outline.is-look-disabled:hover {
  border-color: var(--color-primary);
  background: #fff;
  color: var(--color-primary);
}

.ui-btn.is-default.is-look-disabled:hover {
  border-color: #d9d9d9;
  background: #fff;
  color: #333;
}

.ui-btn.is-primary.is-look-disabled:hover {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.ui-btn.is-link.is-look-disabled:hover {
  text-decoration: none;
}

.ui-btn.is-primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.ui-btn.is-primary:hover:not(:disabled) {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-hover);
}

/* 参考图：筛选 / 批量创建 — 白底蓝框蓝字 */
.ui-btn.is-outline {
  border-color: var(--color-primary);
  background: #fff;
  color: var(--color-primary);
}

.ui-btn.is-outline:hover:not(:disabled) {
  background: var(--color-primary-bg);
}

/* 参考图：导出 / 上架 / 下架 / 删除 / 更多操作 */
.ui-btn.is-default {
  border-color: #d9d9d9;
  background: #fff;
  color: #333;
}

.ui-btn.is-default:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ui-btn.is-link {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
}

.ui-btn.is-link:hover:not(:disabled) {
  text-decoration: underline;
}

.ui-btn__caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
</style>
