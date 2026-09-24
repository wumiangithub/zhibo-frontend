<script setup lang="ts">
import voiceStyleImg from "@/assets/images/live/voice-style.png";
import immerseStyleImg from "@/assets/images/live/immerse-style.jpg";

defineProps<{
  name: string;
  startTime: string;
  /** video | recorded | voice */
  mode?: "video" | "recorded" | "voice";
  /** traditional | immersive */
  viewerStyle?: "traditional" | "immersive";
}>();
</script>

<template>
  <div class="phone-preview">
    <div class="phone-preview__notch" />
    <div
      class="phone-preview__screen"
      :class="{ 'is-immerse': viewerStyle === 'immersive' }"
    >
      <!-- 沉浸直播间：整屏贴图，无 Tab / 介绍 -->
      <img
        v-if="viewerStyle === 'immersive'"
        class="phone-preview__immerse"
        :src="immerseStyleImg"
        alt="沉浸直播间"
      >

      <template v-else>
        <div
          class="phone-preview__cover"
          :class="{ 'is-voice': mode === 'voice' }"
        >
          <img
            v-if="mode === 'voice'"
            class="phone-preview__voice-img"
            :src="voiceStyleImg"
            alt="语音直播"
          >
          <svg
            v-else
            class="h-8 w-8 text-white/80"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div class="phone-preview__tabs">
          <span class="phone-preview__tab">互动</span>
          <span class="phone-preview__tab">排行榜</span>
          <span class="phone-preview__tab is-active">介绍</span>
        </div>
        <div class="phone-preview__body">
          <p class="phone-preview__time">{{ startTime || "2026-09-23 10:00" }} 开始</p>
          <p class="phone-preview__name">{{ name || "直播名称" }}</p>
          <p class="phone-preview__intro">直播简介将在此处展示</p>
        </div>
      </template>

      <div class="phone-preview__watermark">技术支持：钱坤云直播</div>
    </div>
  </div>
</template>

<style scoped>
.phone-preview {
  width: 280px;
  margin: 0 auto;
  background: #1a1a1a;
  border-radius: 28px;
  padding: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}
.phone-preview__notch {
  width: 90px;
  height: 18px;
  margin: 0 auto 6px;
  background: #1a1a1a;
  border-radius: 0 0 12px 12px;
}
.phone-preview__screen {
  position: relative;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  height: 540px;
  display: flex;
  flex-direction: column;
}
.phone-preview__screen.is-immerse {
  background: #000;
  align-items: flex-start;
  justify-content: flex-start;
}
.phone-preview__immerse {
  width: 100%;
  height: auto;
  display: block;
}
.phone-preview__cover {
  height: 200px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: none;
}
.phone-preview__cover.is-voice {
  background: #1a1a1a;
  padding: 0;
}
.phone-preview__voice-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.phone-preview__tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
}
.phone-preview__tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  color: #666;
}
.phone-preview__tab.is-active {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}
.phone-preview__body {
  flex: 1;
  padding: 12px;
  font-size: 12px;
  color: #333;
  overflow-y: auto;
}
.phone-preview__time {
  color: #999;
  margin-bottom: 6px;
}
.phone-preview__name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.phone-preview__intro {
  color: #999;
}
.phone-preview__watermark {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  z-index: 2;
  text-align: center;
  font-size: 10px;
  color: #bbb;
  pointer-events: none;
}
</style>
