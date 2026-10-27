<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="placeholder">
    <div class="card">
      <p class="title">{{ title }}</p>
      <p class="hint">即将开放</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #ebebeb;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: #999;
}
</style>
