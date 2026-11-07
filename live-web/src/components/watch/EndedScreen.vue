<script setup lang="ts">
import { useRouter } from "vue-router";
import type { WatchSummaryData } from "@/api/watch";
import timelineDot from "@/assets/images/ended-timeline-dot.svg";

withDefaults(
  defineProps<{
    data: WatchSummaryData;
    /** 是否展示「查看回放」入口（开关开） */
    showReplayEntry?: boolean;
    /** 回放已过期：提示 + 按钮不可点 */
    playbackExpired?: boolean;
    /** 正在拉回放列表 */
    replayLoading?: boolean;
    /** false：由外层 PlayerStage 提供 #player/#docWrap，本组件只做遮罩 */
    hostPlayer?: boolean;
  }>(),
  {
    showReplayEntry: false,
    playbackExpired: false,
    replayLoading: false,
    hostPlayer: true,
  },
);

const emit = defineEmits<{
  replay: [];
}>();

const router = useRouter();

/** 展示到分：去掉末尾秒（如 2026-11-05 12:04:00 → 12:04） */
function formatToMinute(raw?: string): string {
  if (!raw) return "";
  const t = raw.trim();
  return t.replace(/:\d{2}(?:\.\d+)?$/, "");
}

function goHome() {
  void router.push({ name: "news-home" });
}
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <div
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 pb-16 pt-24 text-center"
      style="
        background: linear-gradient(
          180deg,
          #0b1220 0%,
          #111827 50%,
          #0b1220 100%
        );
      "
    >
      <span
        class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-[#9CA3AF]"
      >
        直播已结束
      </span>

      <h2 class="max-w-[320px] text-2xl font-semibold leading-snug text-white">
        {{ data.title }}
      </h2>

      <div
        v-if="data.startTime || data.endTime"
        class="flex w-[320px] max-w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-[18px] text-left"
      >
        <div
          class="flex w-3 shrink-0 flex-col items-center justify-center self-stretch"
          aria-hidden="true"
        >
          <template v-if="data.endTime">
            <img
              :src="timelineDot"
              alt=""
              width="8"
              height="8"
              class="size-2 shrink-0"
            />
            <div class="h-[52px] w-0.5 shrink-0 bg-[#F5B942]" />
            <img
              :src="timelineDot"
              alt=""
              width="8"
              height="8"
              class="size-2 shrink-0"
            />
          </template>
          <img
            v-else
            :src="timelineDot"
            alt=""
            width="8"
            height="8"
            class="size-2 shrink-0"
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5 tabular-nums">
          <p class="text-sm font-normal text-[#9CA3AF]">
            直播时间
          </p>
          <p
            v-if="data.startTime"
            class="text-[17px] font-medium leading-normal text-white"
          >
            {{ formatToMinute(data.startTime) }}
          </p>
          <template v-if="data.endTime">
            <p class="text-sm font-normal text-[#6B7280]">
              至
            </p>
            <p class="text-[17px] font-medium leading-normal text-white">
              {{ formatToMinute(data.endTime) }}
            </p>
          </template>
        </div>
      </div>

      <div class="flex flex-col items-center gap-1.5">
        <p
          v-if="showReplayEntry && playbackExpired"
          class="max-w-sm text-sm text-amber-400/90"
        >
          回放已过期，无法继续观看
        </p>
        <template v-else>
          <p class="text-sm font-normal text-[#9CA3AF]">
            感谢观看
          </p>
          <span
            class="h-[1.5px] w-12 bg-[#F5B942]"
            aria-hidden="true"
          />
        </template>
      </div>

      <div class="flex w-[280px] max-w-full flex-col items-center gap-5">
        <button
          v-if="showReplayEntry"
          type="button"
          class="flex h-11 w-full items-center justify-center rounded-xl text-base font-medium text-white transition disabled:cursor-not-allowed"
          :class="
            playbackExpired
              ? 'bg-white/10 text-white/40 shadow-none'
              : 'bg-gradient-to-r from-[#2563EB] to-[#1E3A8A] shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:brightness-110 active:brightness-95 disabled:opacity-50'
          "
          :disabled="playbackExpired || replayLoading"
          @click="emit('replay')"
        >
          {{ replayLoading ? "加载中…" : "查看回放" }}
        </button>

        <button
          type="button"
          class="text-sm font-normal text-[#9CA3AF] transition hover:text-gray-200"
          @click="goHome"
        >
          返回首页
        </button>
      </div>
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
