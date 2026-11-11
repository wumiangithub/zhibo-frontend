<script setup lang="ts">
import { computed } from "vue";
import { sideNavIcons } from "@/assets/icons/side-nav";

const props = defineProps<{
  name: string;
}>();

const svg = computed(() => sideNavIcons[props.name] ?? sideNavIcons.grid);
</script>

<template>
  <!-- 颜色跟侧栏文字走 currentColor，选中/hover 由父级控制 -->
  <span
    class="side-icon inline-flex h-4 w-4 flex-none items-center justify-center text-current"
    aria-hidden="true"
    v-html="svg"
  />
</template>

<style scoped>
.side-icon :deep(svg) {
  width: 1rem;
  height: 1rem;
  display: block;
}
</style>
