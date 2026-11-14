<script setup lang="ts">
import { EMOJI_LIST } from "@/constants/emoji";

withDefaults(
  defineProps<{
    /** popover：默认 300px（BarragePanel 等）；dock：PC 聊天底栏整宽浮层；sheet：小屏 */
    variant?: "popover" | "dock" | "sheet";
  }>(),
  { variant: "popover" },
);

const emit = defineEmits<{ insert: [name: string] }>();
</script>

<template>
  <div
    v-if="variant === 'sheet'"
    class="emoji-sheet h-[252px] w-full bg-[var(--lw-bg-chrome)]"
    @mousedown.prevent
  >
    <div class="emoji-sheet-grid grid h-full grid-cols-8 overflow-y-auto">
      <button
        v-for="item in EMOJI_LIST"
        :key="item.value"
        type="button"
        :title="item.name"
        class="flex h-10 items-center justify-center"
        @click="emit('insert', item.name)"
      >
        <img
          :src="item.src"
          :alt="item.name"
          class="h-7 w-7"
          loading="lazy"
        >
      </button>
    </div>
  </div>
  <div
    v-else-if="variant === 'dock'"
    class="emoji-dock absolute bottom-full left-0 right-0 z-50 mb-2 h-[296px] rounded-xl border border-[var(--lw-border)] bg-[var(--lw-bg-chrome)]"
    @mousedown.prevent
  >
    <div class="emoji-dock-grid grid h-full grid-cols-8 overflow-y-auto">
      <button
        v-for="item in EMOJI_LIST"
        :key="item.value"
        type="button"
        :title="item.name"
        class="flex h-10 items-center justify-center"
        @click="emit('insert', item.name)"
      >
        <img
          :src="item.src"
          :alt="item.name"
          class="h-7 w-7"
          loading="lazy"
        >
      </button>
    </div>
  </div>
  <div
    v-else
    class="absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded-lg border border-[var(--lw-border)] bg-[var(--lw-bg-elevated)] p-2 shadow-xl"
  >
    <div class="grid max-h-64 grid-cols-10 gap-1 overflow-y-auto">
      <button
        v-for="item in EMOJI_LIST"
        :key="item.value"
        type="button"
        :title="item.name"
        class="flex items-center justify-center rounded p-0.5 transition-transform hover:scale-110 hover:bg-[var(--lw-bg-bubble)]"
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

<style scoped>
.emoji-sheet-grid {
  padding: 8px 6px 4px;
  scrollbar-width: none;
}
.emoji-sheet-grid::-webkit-scrollbar {
  display: none;
}
.emoji-dock {
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
}
:global(html.dark) .emoji-dock {
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.emoji-dock-grid {
  padding: 8px;
  scrollbar-width: none;
}
.emoji-dock-grid::-webkit-scrollbar {
  display: none;
}
</style>
