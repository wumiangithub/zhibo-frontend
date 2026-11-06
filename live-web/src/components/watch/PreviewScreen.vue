<script setup lang="ts">
import type { WatchSummaryData } from "@/api/watch";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    countdown: string;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  { hostPlayer: true },
);
</script>

<template>
  <div class="relative flex flex-1 flex-col">
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center">
      <p class="text-lg font-semibold text-amber-400">距离开播还有</p>
      <p class="text-3xl font-mono font-bold text-white">{{ countdown }}</p>
      <p class="text-sm text-gray-400">
        开始时间：{{ data.startTime }}
      </p>
    </div>

    <template v-if="hostPlayer">
      <div
        id="player"
        class="min-h-0 w-full flex-1 opacity-0"
      />
      <div
        id="docWrap"
        class="hidden"
      />
    </template>
  </div>
</template>
