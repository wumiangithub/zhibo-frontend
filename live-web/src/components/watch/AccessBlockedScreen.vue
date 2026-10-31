<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
}>();
</script>

<template>
  <div class="blocked">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.blocked {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60dvh;
  padding: 24px 16px;
  text-align: center;
  color: #fff;
  background: #111;
}
.blocked h2 {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
}
.blocked p {
  margin: 0;
  font-size: 14px;
  color: #aaa;
  line-height: 1.6;
  max-width: 320px;
}
</style>
