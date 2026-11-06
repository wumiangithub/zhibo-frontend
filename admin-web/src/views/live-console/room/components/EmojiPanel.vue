<script setup lang="ts">
import { EMOJI_LIST } from "../constants/emoji";

const emit = defineEmits<{ insert: [name: string] }>();
</script>

<template>
  <div class="emoji-panel">
    <div class="emoji-grid hover-scrollbar">
      <button
        v-for="item in EMOJI_LIST"
        :key="item.value"
        type="button"
        class="emoji-cell"
        :title="item.name"
        @click="emit('insert', item.name)"
      >
        <img
          :src="item.src"
          :alt="item.name"
          class="emoji-img"
          loading="lazy"
        >
      </button>
    </div>
  </div>
</template>

<style scoped>
.emoji-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 50;
  box-sizing: border-box;
  width: 292px;
  margin-bottom: 8px;
  padding: 10px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 220px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2px;
}

.emoji-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.emoji-cell:hover {
  background: #f5f5f5;
}

.emoji-cell:active {
  background: var(--color-primary-bg);
}

.emoji-img {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
}
</style>
