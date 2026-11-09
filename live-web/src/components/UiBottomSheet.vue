<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { useWatchTheme } from "@/composables/useWatchTheme";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 标题；不传则不渲染默认头栏（可用 #header 自定义） */
    title?: string;
    /** dialog 无障碍名；默认用 title */
    ariaLabel?: string;
    /** 是否显示右上角关闭（轻量 ✕，点遮罩亦可关） */
    showClose?: boolean;
    /** 顶部拖拽把手（播放器选项等 action sheet 感） */
    showHandle?: boolean;
    /** md+ 改为居中卡片（选回放等）；默认始终贴底 */
    centerOnDesktop?: boolean;
    /** 面板最大高度 */
    maxHeightClass?: string;
    zIndexClass?: string;
    /** 堆叠层级（内联 style，避免 Uno 未扫到任意值类） */
    zIndex?: number;
  }>(),
  {
    showClose: true,
    showHandle: false,
    centerOnDesktop: false,
    maxHeightClass: "max-h-[70dvh]",
    /** 高于播放器伪全屏等 z-100 层 */
    zIndexClass: "z-[110]",
    zIndex: 110,
  },
);

const emit = defineEmits<{ close: [] }>();
const { theme } = useWatchTheme();
/** 显式字符串，保证 Teleport 根 data-lw-theme 跟观看页一致 */
const sheetTheme = computed(() => (theme.value === "dark" ? "dark" : "light"));
const sheetSurface = computed(() =>
  sheetTheme.value === "dark"
    ? {
        panelBg: "#1a1f2a",
        panelFg: "rgba(255, 255, 255, 0.92)",
        panelBorder: "#2a3140",
        maskBg: "rgba(0, 0, 0, 0.7)",
        elevated: "#222836",
        secondary: "rgba(255, 255, 255, 0.55)",
      }
    : {
        panelBg: "#ffffff",
        panelFg: "#1f2329",
        panelBorder: "#e8ecf1",
        maskBg: "rgba(15, 23, 42, 0.4)",
        elevated: "#eef1f6",
        secondary: "#8a9199",
      },
);


/** 路由切换时 Transition+Teleport 可能把 leave 节点留在 body；靠 id 强制清掉 */
const sheetId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `uis-${crypto.randomUUID()}`
    : `uis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function removeTeleportedRoot() {
  if (typeof document === "undefined") return;
  document.querySelector(`[data-ui-sheet="${sheetId}"]`)?.remove();
}

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
  removeTeleportedRoot();
});
</script>

<template>
  <Teleport to="body">
    <!-- duration 显式给定：动效写在子节点，根上嗅探不到 transition 时长时会瞬间插拔，上升看起来生硬 -->
    <Transition
      name="ui-sheet"
      :duration="{ enter: 320, leave: 320 }"
    >
      <div
        v-if="open"
        class="lw-theme ui-sheet-root fixed inset-0 flex flex-col justify-end"
        :data-ui-sheet="sheetId"
        :data-lw-theme="sheetTheme"
        :class="[
          zIndexClass,
          centerOnDesktop ? 'ui-sheet-center-md md:items-center md:justify-center' : '',
        ]"
        :style="{ zIndex, pointerEvents: 'auto' }"
      >
        <button
          type="button"
          class="ui-sheet-mask absolute inset-0"
          :style="{ zIndex: 0, background: sheetSurface.maskBg }"
          aria-label="关闭"
          @click="emit('close')"
        />
        <div
          class="ui-sheet-panel relative flex w-full flex-col overflow-hidden rounded-t-2xl shadow-xl"
          :style="{
            zIndex: 1,
            background: sheetSurface.panelBg,
            color: sheetSurface.panelFg,
            borderColor: sheetSurface.panelBorder,
          }"
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
          <div
            v-if="showHandle"
            class="flex flex-none justify-center pt-2.5 pb-0.5"
            aria-hidden="true"
          >
            <span class="h-1 w-9 rounded-full bg-[var(--lw-border-strong)]" />
          </div>

          <slot name="header">
            <div
              v-if="title || showClose"
              class="flex flex-none items-center border-b border-[var(--lw-border)] px-4 py-3"
              :class="showHandle ? 'relative justify-center' : 'justify-between'"
            >
              <h2
                v-if="title"
                class="text-[15px] font-semibold tracking-wide text-[var(--lw-text-primary)]"
              >
                {{ title }}
              </h2>
              <span
                v-else-if="!showHandle"
                class="flex-1"
              />
              <button
                v-if="showClose"
                type="button"
                class="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--lw-text-secondary)] transition-colors hover:bg-[var(--lw-bg-elevated)] hover:text-[var(--lw-text-primary)]"
                :class="showHandle ? 'absolute right-2 top-1/2 -translate-y-1/2' : ''"
                aria-label="关闭"
                @click="emit('close')"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </slot>

          <div class="ui-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            class="flex-none border-t border-[var(--lw-border)]"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-sheet-root {
  color: var(--lw-text-primary);
}

.ui-sheet-mask {
  background: var(--lw-bg-overlay);
}

.ui-sheet-panel {
  background: var(--lw-bg-chrome);
  color: var(--lw-text-primary);
  border: 1px solid var(--lw-border);
}

.ui-sheet-enter-active .ui-sheet-mask,
.ui-sheet-leave-active .ui-sheet-mask {
  transition: opacity 0.22s ease;
}

.ui-sheet-enter-active .ui-sheet-panel,
.ui-sheet-leave-active .ui-sheet-panel {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.ui-sheet-enter-from .ui-sheet-mask,
.ui-sheet-leave-to .ui-sheet-mask {
  opacity: 0;
}

.ui-sheet-enter-from .ui-sheet-panel,
.ui-sheet-leave-to .ui-sheet-panel {
  transform: translate3d(0, 100%, 0);
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
    transform: translate3d(0, 12px, 0) scale(0.98);
    opacity: 0;
  }
}
</style>
