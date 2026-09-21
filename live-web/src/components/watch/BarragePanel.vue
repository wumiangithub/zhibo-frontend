<script setup lang="ts">
import { ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import {
  AREA_OPTIONS,
  FONT_OPTIONS,
  SPEED_OPTIONS,
  BARRAGE_COLORS,
  type BarrageController,
} from "@/composables/useBarrage";

const props = defineProps<{ barrage: BarrageController }>();
const barrage = props.barrage;

const inputEl = ref<HTMLInputElement | null>(null);
const showEmoji = ref(false);

function insertEmoji(name: string) {
  const next = insertEmojiAtCursor(inputEl.value, barrage.danmakuInput, name, 60);
  if (next !== null) barrage.danmakuInput = next;
  showEmoji.value = false;
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- 表情面板打开时的全屏遮罩：点面板外任意处关闭 -->
    <div
      v-if="showEmoji"
      class="fixed inset-0 z-40"
      @click="showEmoji = false"
    ></div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <!-- 弹幕开关 -->
      <div class="mb-4 flex items-center justify-between">
        <span class="text-sm text-gray-300">弹幕显示</span>
        <button
          type="button"
          class="relative h-6 w-11 rounded-full transition-colors"
          :class="barrage.barrageOn ? 'bg-red-500' : 'bg-gray-600'"
          @click="barrage.toggleBarrage"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            :class="barrage.barrageOn ? 'left-[22px]' : 'left-0.5'"
          ></span>
        </button>
      </div>

      <div class="space-y-4 text-sm">
        <!-- 显示区域 -->
        <div>
          <p class="mb-2 text-gray-400">显示区域</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(label, idx) in AREA_OPTIONS"
              :key="label"
              type="button"
              class="rounded-md px-3 py-1.5 text-xs transition-colors"
              :class="barrage.barrageSettings.area === idx ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
              @click="barrage.barrageSettings.area = idx"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <!-- 不透明度 -->
        <div>
          <p class="mb-2 text-gray-400">不透明度 <span class="text-gray-500">{{ barrage.barrageSettings.opacity }}%</span></p>
          <input
            v-model.number="barrage.barrageSettings.opacity"
            type="range"
            min="0"
            max="100"
            step="5"
            class="w-full accent-red-500"
          />
        </div>

        <!-- 字体大小 -->
        <div>
          <p class="mb-2 text-gray-400">字体大小</p>
          <div class="flex gap-2">
            <button
              v-for="opt in FONT_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-md px-3 py-1.5 text-xs transition-colors"
              :class="barrage.barrageSettings.fontSize === opt.value ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
              @click="barrage.barrageSettings.fontSize = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 弹幕颜色 -->
        <div>
          <p class="mb-2 text-gray-400">弹幕颜色</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in BARRAGE_COLORS"
              :key="c"
              type="button"
              class="h-7 w-7 rounded-full border-2 transition-transform"
              :class="barrage.barrageSettings.color === c ? 'scale-110 border-white' : 'border-transparent'"
              :style="{ backgroundColor: c }"
              @click="barrage.barrageSettings.color = c"
            ></button>
          </div>
        </div>

        <!-- 弹幕速度 -->
        <div>
          <p class="mb-2 text-gray-400">弹幕速度</p>
          <div class="flex gap-2">
            <button
              v-for="opt in SPEED_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-md px-3 py-1.5 text-xs transition-colors"
              :class="barrage.barrageSettings.speed === opt.value ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
              @click="barrage.barrageSettings.speed = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹幕输入栏 -->
    <div class="flex-none border-t border-gray-800 p-3">
      <div class="flex items-center gap-2">
        <span
          class="h-4 w-4 flex-none rounded-full border border-gray-600"
          :style="{ backgroundColor: barrage.barrageSettings.color }"
        ></span>
        <div class="relative z-50 flex-none">
          <button
            class="rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title="表情"
            @click="showEmoji = !showEmoji"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <EmojiPanel
            v-if="showEmoji"
            @insert="insertEmoji"
          />
        </div>
        <input
          ref="inputEl"
          v-model="barrage.danmakuInput"
          type="text"
          maxlength="60"
          placeholder="发个弹幕…"
          class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
          @keyup.enter="barrage.sendDanmaku"
        />
        <button
          class="flex-none rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          :disabled="!barrage.danmakuInput.trim()"
          @click="barrage.sendDanmaku"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>
