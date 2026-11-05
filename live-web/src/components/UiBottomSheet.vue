<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 标题；不传则不渲染默认头栏（可用 #header 自定义） */
    title?: string;
    /** dialog 无障碍名；默认用 title */
    ariaLabel?: string;
    /** 是否显示右上角关闭 */
    showClose?: boolean;
    /** md+ 改为居中卡片（选回放等）；默认始终贴底 */
    centerOnDesktop?: boolean;
    /** 面板最大高度 */
    maxHeightClass?: string;
    zIndexClass?: string;
  }>(),
  {
    showClose: true,
    centerOnDesktop: false,
    maxHeightClass: "max-h-[70dvh]",
    zIndexClass: "z-[90]",
  },
);

const emit = defineEmits<{ close: [] }>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === "undefined") return;
    if (open) document.addEventListener("keydown", onKeydown);
    else document.removeEventListener("keydown", onKeydown);
  },
);

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-sheet">
      <div
        v-if="open"
        class="ui-sheet-root fixed inset-0 flex flex-col justify-end"
        :class="[
          zIndexClass,
          centerOnDesktop ? 'ui-sheet-center-md md:items-center md:justify-center' : '',
        ]"
      >
        <button
          type="button"
          class="ui-sheet-mask absolute inset-0 bg-black/60"
          aria-label="关闭"
          @click="emit('close')"
        />
        <div
          class="ui-sheet-panel relative flex w-full flex-col rounded-t-2xl bg-gray-900 text-white shadow-xl"
          :class="[
            maxHeightClass,
            centerOnDesktop
              ? 'md:max-h-[80dvh] md:max-w-lg md:rounded-2xl'
              : '',
          ]"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel || title || '弹层'"
        >
          <slot name="header">
            <div
              v-if="title || showClose"
              class="flex flex-none items-center justify-between border-b border-gray-800 px-4 py-3"
            >
              <h2 class="text-base font-semibold">
                {{ title }}
              </h2>
              <button
                v-if="showClose"
                type="button"
                class="rounded-md bg-transparent px-2 py-1 text-sm text-gray-400 hover:text-white"
                @click="emit('close')"
              >
                关闭
              </button>
            </div>
          </slot>

          <div class="ui-sheet-body min-h-0 flex-1 overflow-y-auto">
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            class="flex-none border-t border-gray-800"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-sheet-enter-active .ui-sheet-mask,
.ui-sheet-leave-active .ui-sheet-mask {
  transition: opacity 0.22s ease;
}

.ui-sheet-enter-active .ui-sheet-panel,
.ui-sheet-leave-active .ui-sheet-panel {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.ui-sheet-enter-from .ui-sheet-mask,
.ui-sheet-leave-to .ui-sheet-mask {
  opacity: 0;
}

.ui-sheet-enter-from .ui-sheet-panel,
.ui-sheet-leave-to .ui-sheet-panel {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .ui-sheet-center-md.ui-sheet-enter-active .ui-sheet-panel,
  .ui-sheet-center-md.ui-sheet-leave-active .ui-sheet-panel {
    transition:
      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.22s ease;
  }

  .ui-sheet-center-md.ui-sheet-enter-from .ui-sheet-panel,
  .ui-sheet-center-md.ui-sheet-leave-to .ui-sheet-panel {
    transform: translateY(12px) scale(0.98);
    opacity: 0;
  }
}
</style>
