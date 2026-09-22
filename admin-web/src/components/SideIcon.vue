<script setup lang="ts">
defineProps<{
  name: string;
}>();
</script>

<template>
  <!-- 颜色跟侧栏文字走 currentColor，选中/hover 由父级控制 -->
  <span class="inline-flex h-4 w-4 flex-none items-center justify-center text-current">
    <!-- 概况 -->
    <svg
      v-if="name === 'overview'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path
        stroke-linecap="round"
        d="M12 7v5l3 2"
      />
    </svg>
    <!-- 直播中控台 -->
    <svg
      v-else-if="name === 'monitor'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="12"
        rx="1"
      />
      <path d="M8 20h8M12 16v4" />
    </svg>
    <!-- 直播数据 -->
    <svg
      v-else-if="name === 'chart'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16V10M12 16V7M16 16v-4" />
    </svg>
    <!-- 系列课 -->
    <svg
      v-else-if="name === 'stack'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 8l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
    </svg>
    <!-- 小程序 -->
    <svg
      v-else-if="name === 'target'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <circle
        cx="12"
        cy="12"
        r="1"
      />
    </svg>
    <!-- App -->
    <svg
      v-else-if="name === 'phone'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <rect
        x="7"
        y="2"
        width="10"
        height="20"
        rx="2"
      />
      <path d="M11 18h2" />
    </svg>
    <!-- 圈子 -->
    <svg
      v-else-if="name === 'people'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <circle
        cx="17"
        cy="9"
        r="2.5"
      />
      <path d="M21 19c0-2.2-1.5-3.8-4-4.3" />
    </svg>
    <!-- 测评 -->
    <svg
      v-else-if="name === 'clipboard'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <rect
        x="6"
        y="4"
        width="12"
        height="16"
        rx="1"
      />
      <path d="M9 4V3h6v1M9 10h6M9 14h4" />
    </svg>
    <!-- 公域 -->
    <svg
      v-else-if="name === 'globe'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </svg>
    <!-- 用户 -->
    <svg
      v-else-if="name === 'user'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
      />
      <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
    <!-- 流量 -->
    <svg
      v-else-if="name === 'trend'"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </svg>
    <!-- 素材 / 默认 -->
    <svg
      v-else
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      viewBox="0 0 24 24"
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1"
      />
    </svg>
  </span>
</template>
