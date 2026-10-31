<script setup lang="ts">
/**
 * 直播 / 回放共用：主区小屏上下、PC 左右（视频槽 + 侧栏槽）。
 * 顶栏、公告等由父级放在 default 外的 header / notice 槽。
 */
defineSlots<{
  /** 播放器（PlayerStage 或 NativeReplayPlayer） */
  media?: () => unknown;
  /** 右侧互动区（WatchSidePanel） */
  side?: () => unknown;
}>();
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col md:flex-row">
    <slot name="media" />
    <slot name="side" />
  </div>
</template>
