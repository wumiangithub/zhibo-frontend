<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { message, visible } = useToast();
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="toast"
        role="status"
      >
        {{ message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 48px;
  left: 50%;
  z-index: 9999;
  max-width: min(90vw, 360px);
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(31, 35, 41, 0.92);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
  transform: translateX(-50%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
