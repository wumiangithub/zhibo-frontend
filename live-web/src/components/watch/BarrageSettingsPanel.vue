<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import {
  AREA_OPTIONS,
  FONT_OPTIONS,
  SPEED_OPTIONS,
  BARRAGE_COLORS,
  type BarrageController,
} from "@/composables/useBarrage";

const props = defineProps<{ barrage: BarrageController }>();

const trackEl = ref<HTMLElement | null>(null);
let dragging = false;

function snapOpacity(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw / 5) * 5));
}

function opacityFromClientX(clientX: number): number {
  const el = trackEl.value;
  if (!el) return props.barrage.barrageSettings.opacity;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return props.barrage.barrageSettings.opacity;
  return snapOpacity(((clientX - rect.left) / rect.width) * 100);
}

function setOpacity(value: number) {
  props.barrage.barrageSettings.opacity = snapOpacity(value);
}

function onTrackPointerDown(e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragging = true;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  setOpacity(opacityFromClientX(e.clientX));
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  setOpacity(opacityFromClientX(e.clientX));
}

function onPointerUp() {
  if (!dragging) return;
  dragging = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
}

function onTrackKeydown(e: KeyboardEvent) {
  const cur = props.barrage.barrageSettings.opacity;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
    e.preventDefault();
    setOpacity(cur - 5);
  } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
    e.preventDefault();
    setOpacity(cur + 5);
  } else if (e.key === "Home") {
    e.preventDefault();
    setOpacity(0);
  } else if (e.key === "End") {
    e.preventDefault();
    setOpacity(100);
  }
}

onBeforeUnmount(onPointerUp);
</script>

<template>
  <div class="bp">
    <div class="bp-row">
      <span class="bp-title">弹幕显示</span>
      <button
        type="button"
        class="switch"
        :class="{ on: barrage.barrageOn }"
        :aria-pressed="barrage.barrageOn"
        aria-label="弹幕显示"
        @click="barrage.toggleBarrage"
      >
        <i />
      </button>
    </div>
    <div class="bp-field">
      <div class="bp-label">显示区域</div>
      <div class="chips">
        <button
          v-for="(label, idx) in AREA_OPTIONS"
          :key="label"
          type="button"
          class="chip"
          :class="{ on: barrage.barrageSettings.area === idx }"
          @click="barrage.barrageSettings.area = idx"
        >
          {{ label }}
        </button>
      </div>
    </div>
    <div class="bp-field">
      <div class="bp-label">
        不透明度 <em>{{ barrage.barrageSettings.opacity }}%</em>
      </div>
      <div
        ref="trackEl"
        class="bp-slider"
        role="slider"
        tabindex="0"
        aria-label="不透明度"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="barrage.barrageSettings.opacity"
        @pointerdown="onTrackPointerDown"
        @keydown="onTrackKeydown"
      >
        <i :style="{ width: barrage.barrageSettings.opacity + '%' }" />
        <b :style="{ left: barrage.barrageSettings.opacity + '%' }" />
      </div>
    </div>
    <div class="bp-field">
      <div class="bp-label">字体大小</div>
      <div class="chips">
        <button
          v-for="opt in FONT_OPTIONS"
          :key="opt.value"
          type="button"
          class="chip"
          :class="{ on: barrage.barrageSettings.fontSize === opt.value }"
          @click="barrage.barrageSettings.fontSize = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div class="bp-field">
      <div class="bp-label">弹幕颜色</div>
      <div class="colors">
        <button
          v-for="c in BARRAGE_COLORS"
          :key="c"
          type="button"
          class="dot"
          :class="{ on: barrage.barrageSettings.color === c }"
          :style="{ background: c }"
          :aria-label="c"
          @click="barrage.barrageSettings.color = c"
        />
      </div>
    </div>
    <div class="bp-field">
      <div class="bp-label">弹幕速度</div>
      <div class="chips">
        <button
          v-for="opt in SPEED_OPTIONS"
          :key="opt.value"
          type="button"
          class="chip"
          :class="{ on: barrage.barrageSettings.speed === opt.value }"
          @click="barrage.barrageSettings.speed = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bp {
  width: 260px;
  padding: 14px;
  background: var(--lw-bg-chrome);
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  color: var(--lw-text-primary);
  text-align: left;
}
.bp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.bp-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-primary);
}
.bp-field + .bp-field {
  margin-top: 12px;
}
.bp-label {
  font-size: 12px;
  color: var(--lw-text-secondary);
  margin-bottom: 8px;
}
.bp-label em {
  font-style: normal;
  color: var(--lw-text-muted);
  margin-left: 4px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  line-height: 26px;
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  cursor: pointer;
}
.chip.on {
  background: var(--lw-color-primary);
  color: var(--lw-text-on-brand);
}
.switch {
  position: relative;
  width: 40px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: var(--lw-border-strong);
  flex: none;
  cursor: pointer;
  padding: 0;
}
.switch.on {
  background: var(--lw-color-primary);
}
.switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: left 0.15s ease;
  pointer-events: none;
}
.switch.on i {
  left: 20px;
}
.bp-slider {
  position: relative;
  height: 12px;
  margin: 8px 6px 6px 0;
  cursor: pointer;
  touch-action: none;
  outline: none;
}
.bp-slider::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: var(--lw-bg-elevated);
  pointer-events: none;
}
.bp-slider i {
  position: absolute;
  left: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: var(--lw-color-primary);
  pointer-events: none;
}
.bp-slider b {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.colors {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
}
.dot {
  width: 18px;
  height: 18px;
  border: 0;
  padding: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
  cursor: pointer;
}
.dot.on {
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.18),
    0 0 0 2px var(--lw-bg-chrome),
    0 0 0 4px var(--lw-color-primary);
}
</style>
