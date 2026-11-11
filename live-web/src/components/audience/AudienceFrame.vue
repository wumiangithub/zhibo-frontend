<script setup lang="ts">
import { useRouter } from "vue-router";
import { backOrHome } from "@/utils/navigation";

defineProps<{
  title?: string;
}>();

const router = useRouter();

function back() {
  backOrHome(router);
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
          <svg
            class="back-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15.5 4.5 7.5 12l8 7.5"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: #111111;
  padding: 0;
  cursor: pointer;
}
.back-icon {
  width: 20px;
  height: 20px;
  display: block;
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
