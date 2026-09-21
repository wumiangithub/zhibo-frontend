<script setup lang="ts">
import { EMOJI_LIST } from "@/constants/emoji";

const emit = defineEmits<{ insert: [name: string] }>();
</script>

<template>
  <div
    class="absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-xl"
  >
    <div class="grid max-h-64 grid-cols-10 gap-1 overflow-y-auto">
      <button
        v-for="item in EMOJI_LIST"
        :key="item.value"
        type="button"
        :title="item.name"
        class="flex items-center justify-center rounded p-0.5 transition-transform hover:scale-110"
        @click="emit('insert', item.name)"
      >
        <img
          :src="item.src"
          :alt="item.name"
          class="h-6 w-6"
          loading="lazy"
        >
      </button>
    </div>
  </div>
</template>
