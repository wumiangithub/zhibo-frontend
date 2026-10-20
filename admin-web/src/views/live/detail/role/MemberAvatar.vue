<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    url?: string;
    size?: number;
  }>(),
  { url: "", size: 28 },
);

const broken = ref(false);
watch(
  () => props.url,
  () => {
    broken.value = false;
  },
);

const photo = computed(() => {
  const url = props.url?.trim() ?? "";
  if (!url || broken.value) return "";
  return url;
});

const letter = computed(() => props.name.trim().slice(0, 1) || "人");
</script>

<template>
  <span
    class="avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(12, Math.round(size * 0.42))}px` }"
  >
    <img
      v-if="photo"
      :src="photo"
      alt=""
      @error="broken = true"
    >
    <span v-else>{{ letter }}</span>
  </span>
</template>

<style scoped>
.avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #f2f3f5;
  color: var(--color-primary);
  font-weight: 600;
  line-height: 1;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
