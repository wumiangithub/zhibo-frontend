<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    /** 返回文字；传空字符串则只显示 icon */
    backText?: string;
    showBack?: boolean;
  }>(),
  {
    backText: "返回",
    showBack: true,
  },
);

const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <header
    class="page-header relative flex flex-none items-center justify-center border-b border-[var(--lw-border)] bg-[var(--lw-bg-panel)] text-[var(--lw-text-primary)]"
  >
    <button
      v-if="showBack"
      type="button"
      class="page-header__back absolute bottom-0 left-1 z-10 inline-flex items-center gap-0.5 rounded-md bg-transparent py-1.5 pl-1 pr-2 text-sm text-[var(--lw-text-secondary)] hover:bg-[var(--lw-bg-elevated)] hover:text-[var(--lw-text-primary)]"
      aria-label="返回"
      @click="emit('back')"
    >
      <svg
        class="h-5 w-5 flex-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      <span
        v-if="backText"
        class="leading-none"
      >{{ backText }}</span>
    </button>

    <h1
      class="page-header__title min-w-0 truncate text-center text-sm font-medium md:text-base"
      :class="showBack ? 'px-16' : 'px-3'"
    >
      {{ title }}
    </h1>
  </header>
</template>

<style scoped>
.page-header {
  /* 内容区约 44px，叠加刘海/状态栏安全区 */
  min-height: calc(44px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
}

.page-header__back {
  /* 贴内容区底边垂直居中，不受 safe-area padding 影响 */
  height: 44px;
}
</style>
