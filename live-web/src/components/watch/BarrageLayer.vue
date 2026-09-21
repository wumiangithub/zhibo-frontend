<script setup lang="ts">
import { splitEmojiText } from "@/constants/emoji";
import type { BarrageController } from "@/composables/useBarrage";

const props = defineProps<{ barrage: BarrageController }>();
const barrage = props.barrage;
</script>

<template>
  <!-- 自建弹幕浮层：覆盖在播放器上，pointer-events:none 不挡控制栏点击 -->
  <div
    v-show="barrage.barrageOn"
    :ref="barrage.attachLayerEl"
    class="danmaku-layer"
    :style="{ opacity: barrage.barrageSettings.opacity / 100 }"
  >
    <span
      v-for="d in barrage.danmakuList"
      :key="d.id"
      class="danmaku-item"
      :style="{
        top: d.top + 'px',
        color: d.color,
        fontSize: d.fontSize + 'px',
        animationDuration: d.duration + 'ms',
        '--travel': d.travel + 'px',
      }"
    >
      <template v-for="(seg, segIdx) in splitEmojiText(d.text)" :key="segIdx">
        <img
          v-if="seg.kind === 'emoji'"
          :src="seg.src"
          :alt="seg.name"
          class="inline-block align-text-bottom"
          :style="{ width: d.fontSize + 'px', height: d.fontSize + 'px' }"
        >
        <span v-else>{{ seg.value }}</span>
      </template>
    </span>
  </div>
</template>

<style scoped>
.danmaku-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  pointer-events: none;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  will-change: transform;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  animation-name: danmaku-move;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes danmaku-move {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--travel));
  }
}
</style>
