<script setup lang="ts">
import { ref } from "vue";
import { getStoredNickname } from "@/api/watch";

defineProps<{ saving: boolean }>();

const emit = defineEmits<{ save: [name: string]; skip: [] }>();

const name = ref(getStoredNickname());
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6">
    <h2 class="text-lg font-semibold text-[var(--lw-color-primary)]">
      进入观看
    </h2>
    <p class="text-sm text-[var(--lw-text-secondary)]">
      设置你的昵称（可选，默认「观众」）
    </p>
    <div class="flex items-center gap-2">
      <input
        v-model="name"
        type="text"
        maxlength="50"
        placeholder="观众"
        class="w-48 rounded-md border border-[var(--lw-border-strong)] bg-[var(--lw-bg-elevated)] px-3 py-2 text-sm text-[var(--lw-text-primary)] placeholder:text-[var(--lw-text-muted)] focus:border-[var(--lw-color-primary)] focus:outline-none"
        @keyup.enter="emit('save', name.trim())"
      >
      <button
        type="button"
        class="rounded-md bg-[var(--lw-color-primary)] px-4 py-2 text-sm font-medium text-[var(--lw-text-on-brand)] hover:bg-[var(--lw-color-primary-hover)] disabled:opacity-50"
        :disabled="saving"
        @click="emit('save', name.trim())"
      >
        进入
      </button>
    </div>
    <button
      type="button"
      class="bg-transparent text-sm text-[var(--lw-text-muted)] hover:text-[var(--lw-text-secondary)]"
      @click="emit('skip')"
    >
      跳过，使用默认昵称
    </button>
  </div>
</template>
