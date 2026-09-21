<script setup lang="ts">
import type { WatchSdkData } from "@/api/watch";

defineProps<{
  data: WatchSdkData;
  countdown: string;
  showLiveStartPopup: boolean;
}>();

const emit = defineEmits<{ enter: [] }>();
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

    <!-- 开播引导弹窗 -->
    <div
      v-if="showLiveStartPopup"
      class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4"
    >
      <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6 text-center">
        <div class="mb-4 flex justify-center">
          <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-sm font-medium text-red-400">
            <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
            直播已开始
          </span>
        </div>
        <h3 class="mb-2 text-lg font-semibold text-white">直播已开始，请观看直播吧</h3>
        <p class="mb-6 text-sm text-gray-400">点击下方按钮进入直播</p>
        <button
          class="w-full rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
          @click="emit('enter')"
        >
          立即观看
        </button>
      </div>
    </div>

    <div
      id="player"
      class="min-h-0 w-full flex-1 opacity-0"
    />
    <div
      id="docWrap"
      class="hidden"
    />
  </div>
</template>
