<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import AudienceTabBar from "@/components/audience/AudienceTabBar.vue";
import {
  cardsForTab,
  MOCK_NEWS,
  NEWS_TABS,
  type NewsTabKey,
} from "@/data/mockNews";

const router = useRouter();
const active = ref<NewsTabKey>("live");
const expanded = ref<Record<string, boolean>>({});

const cards = computed(() => cardsForTab(active.value));

function switchTab(key: NewsTabKey) {
  if (key === active.value) return;
  active.value = key;
}

function toggleLive(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
}

function openDetail(id: string) {
  void router.push({ name: "news-detail", params: { id } });
}
</script>

<template>
  <AudienceFrame>
    <div class="page">
      <div class="tabs">
        <button
          v-for="tab in NEWS_TABS"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ on: active === tab.key }"
          @click="switchTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div
        v-if="active === 'live'"
        class="scroll"
      >
        <p class="date">
          {{ MOCK_NEWS.liveDate }}
        </p>
        <div class="timeline">
          <div
            v-for="item in MOCK_NEWS.live"
            :key="item.id"
            class="tl-item"
          >
            <div class="rail">
              <span class="dot" />
              <span class="line" />
            </div>
            <div class="main">
              <p class="time">
                {{ item.time }}
              </p>
              <button
                type="button"
                class="card"
                :class="expanded[item.id] ? 'expanded' : 'clamped'"
                @click="toggleLive(item.id)"
              >
                <span class="card-text">{{ item.content }}</span>
              </button>
            </div>
          </div>
        </div>
        <p class="tip">
          样式预览 · 接口未接
        </p>
      </div>

      <div
        v-else
        class="scroll"
      >
        <div class="list">
          <button
            v-for="item in cards"
            :key="item.id"
            type="button"
            class="news"
            @click="openDetail(item.id)"
          >
            <p class="news-title">
              {{ item.title }}
            </p>
            <p class="meta">
              <span>{{ item.source }}</span>
              <span class="gap">{{ item.time }}</span>
            </p>
          </button>
        </div>
        <p class="tip">
          样式预览 · 接口未接
        </p>
      </div>

      <AudienceTabBar active="home" />
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}
.tabs {
  display: flex;
  height: 44px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.tab {
  flex: 1;
  border: 0;
  background: transparent;
  color: #333333;
  font-size: 15px;
  position: relative;
  cursor: pointer;
}
.tab.on {
  color: #1677ff;
  font-weight: 600;
}
.tab.on::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 24px;
  height: 3px;
  border-radius: 3px;
  background: #1677ff;
  transform: translateX(-50%);
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.date {
  margin: 0;
  padding: 12px 16px 4px;
  font-size: 13px;
  color: #8c8c8c;
}
.timeline {
  padding: 4px 12px 12px 16px;
}
.tl-item {
  display: flex;
  align-items: stretch;
}
.rail {
  width: 12px;
  margin-right: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff4d4f;
  flex-shrink: 0;
}
.line {
  width: 0;
  flex: 1;
  border-left: 1px dashed #d9d9d9;
  margin-top: 4px;
}
.tl-item:last-child .line {
  border-left-color: transparent;
}
.main {
  flex: 1;
  min-width: 0;
  padding-bottom: 12px;
}
.time {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  line-height: 20px;
}
.card {
  display: block;
  width: 100%;
  margin: 0;
  border: 0;
  text-align: left;
  background: #ffffff;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  font-size: 14px;
  line-height: 1.65;
  color: #262626;
  cursor: pointer;
  overflow: hidden;
}
.card-text {
  display: block;
}
/* clamp 必须打在非 button 的内层：Chromium 对 button + -webkit-line-clamp 会算对高度但不裁切绘制 */
.card.clamped .card-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  word-break: break-word;
}
.list {
  padding: 8px 12px 12px;
}
.news {
  display: block;
  width: 100%;
  text-align: left;
  background: #ffffff;
  border-radius: 8px;
  padding: 14px 14px 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}
.news-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #111111;
  line-height: 1.55;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 17px;
}
.gap {
  margin-left: 8px;
}
.tip {
  margin: 0;
  text-align: center;
  color: #bfbfbf;
  font-size: 11px;
  padding: 4px 0 20px;
}
</style>
