<script setup lang="ts">
import { ref } from "vue";
import { getStoredNickname } from "@/api/watch";

defineProps<{ saving: boolean }>();

const emit = defineEmits<{ save: [name: string]; skip: [] }>();

const name = ref(getStoredNickname());
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6">
    <h2 class="text-lg font-semibold text-green-400">进入观看</h2>
    <p class="text-sm text-gray-400">设置你的昵称（可选，默认「观众」）</p>
    <div class="flex items-center gap-2">
      <input
        v-model="name"
        type="text"
        maxlength="50"
        placeholder="观众"
        class="w-48 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        @keyup.enter="emit('save', name.trim())"
      />
      <button
        class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        :disabled="saving"
        @click="emit('save', name.trim())"
      >
        进入
      </button>
    </div>
    <button
      class="bg-transparent text-sm text-gray-500 hover:text-gray-300"
      @click="emit('skip')"
    >
      跳过，使用默认昵称
    </button>
  </div>
</template>
