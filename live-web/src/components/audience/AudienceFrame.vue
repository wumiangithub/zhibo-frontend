<script setup lang="ts">
import { useRouter } from "vue-router";

defineProps<{
  title?: string;
}>();

const router = useRouter();

function back() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/");
}
</script>

<template>
  <div class="stage">
    <div class="sheet">
      <header
        v-if="title"
        class="nav"
      >
        <button
          type="button"
          class="back"
          aria-label="返回"
          @click="back"
        >
          ‹
        </button>
        <h1 class="title">
          {{ title }}
        </h1>
      </header>
      <div class="body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  min-height: 100dvh;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}
.nav {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid #f0f0f0;
}
.back {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  color: #111111;
  padding: 4px 12px;
  cursor: pointer;
}
.title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #111111;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
