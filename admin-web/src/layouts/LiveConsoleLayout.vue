<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const { message, visible, toast } = useToast();

const sideNav = [
  { key: "list", label: "直播列表", to: "/live-console" },
  { key: "quick", label: "快捷发送" },
  { key: "settings", label: "通用设置" },
] as const;

const activeSide = computed(() => (route.name === "live-console-list" ? "list" : ""));

function onShellClick(label: string) {
  toast(`「${label}」暂未开放`);
}
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-[#f5f6f8] text-[#333] antialiased">
    <header class="z-20 flex h-[52px] flex-none items-center justify-between border-b border-[#ebebeb] bg-white px-5">
      <div class="flex items-center gap-2.5">
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full bg-[#e54d42] text-[11px] font-bold text-white"
        >
          钱坤
        </span>
        <span class="text-[15px] font-semibold text-[#1a1a1a]">直播中控台</span>
      </div>
      <div class="flex items-center gap-2 text-[13px] text-[#666]">
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full bg-[#bfbfbf] text-white"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
          </svg>
        </span>
        <span>管理员</span>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <aside class="flex w-[176px] flex-none flex-col border-r border-[#ebebeb] bg-[#fafbfc]">
        <nav class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3 text-[13px]">
          <template
            v-for="item in sideNav"
            :key="item.key"
          >
            <RouterLink
              v-if="'to' in item && item.to"
              :to="item.to"
              class="side-nav-item"
              :class="{ 'is-active': activeSide === item.key }"
            >
              {{ item.label }}
            </RouterLink>
            <button
              v-else
              type="button"
              class="side-nav-item"
              @click="onShellClick(item.label)"
            >
              {{ item.label }}
            </button>
          </template>
        </nav>
      </aside>

      <main class="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
        <RouterView />
      </main>
    </div>

    <div
      v-if="visible"
      class="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#1f2329]/90 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.side-nav-item {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  align-items: center;
  border: 0;
  border-radius: 0 0.375rem 0.375rem 0;
  background: transparent;
  padding: 0.625rem 0.75rem;
  text-align: left;
  text-decoration: none;
  font-size: 13px;
  color: #333;
  outline: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.side-nav-item:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  text-decoration: none;
}

.side-nav-item.is-active {
  border-left: 3px solid var(--color-primary);
  padding-left: calc(0.75rem - 3px);
  background: var(--color-primary-bg-active);
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}
</style>
