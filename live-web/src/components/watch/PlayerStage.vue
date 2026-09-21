<script setup lang="ts">
import BarrageLayer from "@/components/watch/BarrageLayer.vue";
import type { PlayerController } from "@/composables/usePlayerControls";
import type { BarrageController } from "@/composables/useBarrage";
import type { RoomStatsController } from "@/composables/useRoomStats";

defineProps<{
  player: PlayerController;
  barrage: BarrageController;
  stats: RoomStatsController;
  title: string;
  /** type=1 音频直播：浏览器常因自动播放策略把音轨挂起 */
  isAudioLive: boolean;
}>();

const emit = defineEmits<{ share: []; gift: [] }>();
</script>

<template>
  <div class="relative min-h-0 min-w-0 flex-1 bg-black">
    <button
      v-if="player.needsTapToPlay"
      type="button"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center"
      @click="player.resumePlayback"
    >
      <span class="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium hover:bg-green-700">
        {{ isAudioLive ? '点击收听' : '点击播放' }}
      </span>
      <span class="text-xs text-gray-300">
        {{ isAudioLive ? '浏览器限制自动出声，点一下即可听见直播' : '浏览器限制自动播放，点一下开始观看' }}
      </span>
    </button>

    <div
      v-if="isAudioLive"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6"
    >
      <div class="flex flex-col items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
          <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
          直播中
        </span>
        <h2 class="mt-2 text-xl font-semibold text-white">{{ title }}</h2>
      </div>

      <div class="flex items-end gap-1">
        <span v-for="i in 5" :key="i" class="w-1.5 rounded-full bg-green-500" :style="{ height: `${20 + Math.random() * 40}px`, animation: `audioWave 1s ease-in-out ${i * 0.1}s infinite alternate` }"></span>
      </div>

      <p class="text-sm text-gray-400">
        正在播放音频直播
      </p>
    </div>

    <div
      id="player"
      class="h-full w-full"
      :class="{
        'opacity-0': isAudioLive,
        'player-fallback-fullscreen': player.pseudoFullscreen,
      }"
      @click="player.handlePlayerClick"
    />
    <div
      id="docWrap"
      class="hidden"
    />

    <BarrageLayer :barrage="barrage" />

    <!-- 礼物/点赞/在线/分享：Teleport 进 SDK 控制栏，靠右对齐 -->
    <Teleport v-if="player.controllerEl" :to="player.controllerEl">
      <div class="player-bar-actions">
        <!-- 弹幕开关：点击切换显示，设置在弹幕 tab 内 -->
        <button
          type="button"
          :title="barrage.barrageOn ? '关弹幕' : '开弹幕'"
          :class="{ 'is-off': !barrage.barrageOn }"
          @click="barrage.toggleBarrage"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 3V7a1 1 0 011-1z" />
          </svg>
        </button>
        <!-- 礼物占位 -->
        <button
          type="button"
          title="礼物"
          @click="emit('gift')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </button>
        <!-- 点赞 -->
        <button
          type="button"
          title="点赞"
          @click="stats.handleLike"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span class="text-xs">{{ stats.likeCount }}</span>
        </button>
        <!-- 分享 -->
        <button
          type="button"
          title="分享"
          @click="emit('share')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* SDK 会给 #player 写内联 position: relative，这里必须 !important 才能覆盖 */
#player.player-fallback-fullscreen {
  position: fixed !important;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100dvh;
  /* video 的 letterbox 区域是透明的，不垫黑会透出底下的顶栏/聊天面板 */
  background: #000;
}

/* SDK 控制栏默认半透明黑，和黑色播放区糊在一起，改成灰底做区分 */
#player :deep(.vh-player-controller) {
  background: #1f2937;
}

/* SDK 默认把功能组（清晰度/音量/弹幕/全屏）float 到右边，改成跟在播放按钮后左对齐 */
#player :deep(.vh-player-right) {
  float: left;
  margin-right: 0;
}

/* Teleport 进控制栏的互动按钮：靠右、与栏同高，hover 只变色 */
.player-bar-actions {
  position: absolute;
  top: 0;
  right: 10px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.player-bar-actions button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: #fff;
}

.player-bar-actions button:hover {
  color: #ef4444;
}

/* 弹幕关闭态：图标变灰，hover 仍只变色 */
.player-bar-actions button.is-off {
  color: #6b7280;
}

/* SDK 控制栏按 content-box 计算高度（24 内容 + 13*2 padding = 50），
   全局 border-box 会把盒子压扁导致图标和胶囊按钮错位 */
#player :deep(*) {
  box-sizing: content-box;
}

/* 清晰度下拉：对齐参考稿的深灰面板 + 居中条目 + 选中标红 */
#player :deep(.vh-definition-list) {
  bottom: 54px;
  left: 50%;
  transform: translateX(-50%);
  width: 72px;
  padding: 4px 0;
  background: #262626;
  border-radius: 4px;
  overflow: hidden;
}

#player :deep(.vh-quality-item) {
  height: 44px;
  line-height: 44px;
  border-radius: 0;
  background: transparent;
  color: #fff;
  font-size: 14px;
}

/* hover 统一只变文字/图标颜色，不加背景 */
#player :deep(.vh-quality-item:hover) {
  background: transparent;
  color: #ef4444;
}

#player :deep(.vh-quality-item.is-active) {
  color: #ef4444;
}

/* 清晰度按钮对齐参考稿：红字、无胶囊底 */
#player :deep(.vh-definition-btn) {
  background: transparent;
  color: #ef4444;
}

#player :deep(.vh-definition-btn:hover) {
  background: transparent;
  color: #f87171;
}

/* 微吼自带弹幕按钮/下拉移除：弹幕统一走侧栏「弹幕」tab + 自建浮层，避免两套入口 */
#player :deep(.vh-barrage-btn),
#player :deep(.vh-barrage-list),
#player :deep(.vhallPlayer-brarage-btn),
#player :deep(.vhallPlayer-brarage-popup) {
  display: none;
}

#player :deep(.vh-speed-btn) {
  background: transparent;
  color: #fff;
}

#player :deep(.vh-speed-btn:hover) {
  background: transparent;
  color: #ef4444;
}

/* 音量滑杆弹层：SDK 默认纯黑块 + 浏览器蓝色滑杆，改成与下拉同色系面板 + 红滑杆 */
#player :deep(.vh-voice-list) {
  background: #262626;
  border-radius: 4px;
}

#player :deep(#vhVoiceSlide) {
  accent-color: #ef4444;
  background: #4b5563;
  border-radius: 3px;
}

/* 全屏图标是 PNG，SDK hover 会换蓝色图；改用 mask 着色，hover 变红 */
#player :deep(#vhFullScreen) {
  background-image: none !important;
  background-color: #fff;
  -webkit-mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAMFBMVEVHcEzu7u7////t7e34+Pjt7e3t7e3////y8vLt7e3t7e3t7e3u7u7v7+/t7e3t7e0duasSAAAAD3RSTlMAbQPGDZW4CBPQ7KJMTkjzr+TDAAAAv0lEQVQoz53SMQ6CMBTG8TdoGFy4QQkJOrC6Q3R0aaL3kMmZY3iCrj1Kj+ARGJqYOD37utB+jYtv/OUfKPQRlbNjGTMm5CJxnZD6Re8xJ39qG4LqmL9RsWU/Al0xU3wbIFOsz5AF2kAWiCB7hYNLNq3U+5kkq+F3VENBdDET/TtbMyMt/ERy/AlZl97CniVz6Wmqu2Tyfes8JMspZjnFDOgQMiDJLFB4GgNJllFn4y7ocod0dgvFDvXlDlEr09AXDGWMDVnjKjQAAAAASUVORK5CYII=");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 20px;
  mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAMFBMVEVHcEzu7u7////t7e34+Pjt7e3t7e3////y8vLt7e3t7e3t7e3u7u7v7+/t7e3t7e0duasSAAAAD3RSTlMAbQPGDZW4CBPQ7KJMTkjzr+TDAAAAv0lEQVQoz53SMQ6CMBTG8TdoGFy4QQkJOrC6Q3R0aaL3kMmZY3iCrj1Kj+ARGJqYOD37utB+jYtv/OUfKPQRlbNjGTMm5CJxnZD6Re8xJ39qG4LqmL9RsWU/Al0xU3wbIFOsz5AF2kAWiCB7hYNLNq3U+5kkq+F3VENBdDET/TtbMyMt/ERy/AlZl97CniVz6Wmqu2Tyfes8JMspZjnFDOgQMiDJLFB4GgNJllFn4y7ocod0dgvFDvXlDlEr09AXDGWMDVnjKjQAAAAASUVORK5CYII=");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 20px;
}

#player :deep(#vhExitFullScreen) {
  background-image: none !important;
  background-color: #fff;
  -webkit-mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAKlBMVEVHcEz19fXu7u7////t7e3t7e3t7e3////v7+/t7e3t7e3t7e3t7e3t7e3BLMSkAAAADXRSTlMAD20Dv5XMCUuz8qLol+ANWAAAAMFJREFUKM+N0TEKwkAQheHZhGBroblHXDyAlVUg4AmsJZDKi9gFPYIgpPAekiIG5y7OWO28jeKUX/6wySxRPLP2jpRw30TEGyJXdsGLNfdzeTAEWa7Zmh8BOc0yQ5rtgTRbWqIj8wHIlfwCogWzpdQXpSV3YYYq4W80mO2ojDf6b1KvAx+s0/0+JpumK48V0NYeqASXlcmGIJNd15AJ5ZAJyS08G0sEmRJkK/nwVLJT8Nvt7nOnAyzI5xFRca4mVvkGHmmBR0NR+YMAAAAASUVORK5CYII=");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 20px;
  mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAKlBMVEVHcEz19fXu7u7////t7e3t7e3t7e3////v7+/t7e3t7e3t7e3t7e3t7e3BLMSkAAAADXRSTlMAD20Dv5XMCUuz8qLol+ANWAAAAMFJREFUKM+N0TEKwkAQheHZhGBroblHXDyAlVUg4AmsJZDKi9gFPYIgpPAekiIG5y7OWO28jeKUX/6wySxRPLP2jpRw30TEGyJXdsGLNfdzeTAEWa7Zmh8BOc0yQ5rtgTRbWqIj8wHIlfwCogWzpdQXpSV3YYYq4W80mO2ojDf6b1KvAx+s0/0+JpumK48V0NYeqASXlcmGIJNd15AJ5ZAJyS08G0sEmRJkK/nwVLJT8Nvt7nOnAyzI5xFRca4mVvkGHmmBR0NR+YMAAAAASUVORK5CYII=");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 20px;
}

#player :deep(#vhFullScreen:hover),
#player :deep(#vhExitFullScreen:hover) {
  background-color: #ef4444;
}

/* 音量图标是 PNG，SDK 没给 hover 态，用亮度模拟变色 */
#player :deep(.vh-voice-btn:hover) {
  filter: brightness(1.6);
}

@keyframes audioWave {
  0% {
    transform: scaleY(0.5);
  }
  100% {
    transform: scaleY(1);
  }
}
</style>
