<script setup lang="ts">
import type { WatchSummaryData } from "@/api/watch";

defineProps<{
  data: WatchSummaryData;
  /** 是否展示「查看回放」入口（开关开） */
  showReplayEntry?: boolean;
  /** 回放已过期：提示 + 按钮不可点 */
  playbackExpired?: boolean;
  /** 正在拉回放列表 */
  replayLoading?: boolean;
}>();

const emit = defineEmits<{
  replay: [];
}>();
</script>

<template>
  <div class="relative flex flex-1 flex-col">
    <div
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center"
    >
      <div class="flex flex-col items-center gap-2">
        <span
          class="inline-flex items-center gap-2 rounded-full bg-gray-700/50 px-3 py-1 text-xs font-medium text-gray-400"
        >
          <span class="h-2 w-2 rounded-full bg-gray-500" />
          直播已结束
        </span>
        <h2 class="mt-2 text-xl font-semibold text-white">
          {{ data.title }}
        </h2>
      </div>

      <div class="mt-4 rounded-lg bg-gray-800/50 px-6 py-4">
        <p class="text-sm text-gray-400">
          直播时间
        </p>
        <p class="mt-1 text-base font-medium text-gray-200">
          {{ data.startTime }}
        </p>
        <template v-if="data.endTime">
          <p class="text-xs text-gray-500">
            至
          </p>
          <p class="text-base font-medium text-gray-200">
            {{ data.endTime }}
          </p>
        </template>
      </div>

      <p
        v-if="showReplayEntry && playbackExpired"
        class="max-w-sm text-sm text-amber-400/90"
      >
        回放已过期，无法继续观看
      </p>
      <p
        v-else
        class="text-xs text-gray-500"
      >
        感谢观看
      </p>

      <button
        v-if="showReplayEntry"
        type="button"
        class="mt-2 min-w-[160px] rounded-lg px-6 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          playbackExpired
            ? 'bg-gray-700 text-gray-400'
            : 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700'
        "
        :disabled="playbackExpired || replayLoading"
        @click="emit('replay')"
      >
        {{ replayLoading ? "加载中…" : "查看回放" }}
      </button>
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
