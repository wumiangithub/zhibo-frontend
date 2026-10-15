<script setup lang="ts">
defineProps<{ title: string; tip?: string }>();
</script>

<template>
  <div class="placeholder">
    <h3 class="title">{{ title }}</h3>
    <p class="tip">{{ tip || "本模块本迭代占位，后续迭代再做。" }}</p>
  </div>
</template>

<style scoped>
.placeholder {
  padding: 48px 24px;
  text-align: center;
}
.title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.tip {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-placeholder);
}
</style>
