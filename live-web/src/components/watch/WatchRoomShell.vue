<script setup lang="ts">
/**
 * 直播 / 回放共用：主区小屏上下、PC 左右（视频槽 + 侧栏槽）。
 * 顶栏、公告等由父级放在 default 外的 header / notice 槽。
 *
 * media 槽：黑底井；小屏由播放器自身 width:100% + 16:9；
 * PC 用 container-type:size，播放器按短边铺满保 16:9（余下黑边 letterbox/pillarbox）。
 */
defineSlots<{
  /** 播放器（PlayerStage 或 NativeReplayPlayer） */
  media?: () => unknown;
  /** 右侧互动区（WatchSidePanel） */
  side?: () => unknown;
}>();
</script>

<template>
  <div class="room-shell flex min-h-0 flex-1 flex-col md:flex-row">
    <div class="media-well">
      <slot name="media" />
    </div>
    <slot name="side" />
  </div>
</template>

<style scoped>
/* 舞台外父级跟聊天 Tab 同色，漏缝时不露第三种底；黑底井 / letterbox 仍走 --lw-bg-player */
.room-shell {
  background: var(--lw-bg-chrome);
}

.media-well {
  display: flex;
  flex-direction: column;
  flex: none;
  width: 100%;
  background: var(--lw-bg-player, #000);
}

@media (min-width: 768px) {
  .media-well {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    align-items: center;
    justify-content: center;
    container-type: size;
  }
}
</style>
