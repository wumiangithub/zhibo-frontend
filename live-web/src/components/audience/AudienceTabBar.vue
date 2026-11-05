<script setup lang="ts">
import { useRouter } from "vue-router";

defineProps<{
  active: "home" | "mine";
}>();

const router = useRouter();

function goHome() {
  void router.push({ name: "news-home" });
}

function goMine() {
  void router.push({ name: "mine" });
}
</script>

<template>
  <nav class="bar">
    <button
      type="button"
      class="item"
      :class="{ on: active === 'home' }"
      @click="goHome"
    >
      <img
        :src="active === 'home' ? '/audience/tab-home-active.png' : '/audience/tab-home.png'"
        alt=""
      >
      <span>首页</span>
    </button>
    <button
      type="button"
      class="item"
      :class="{ on: active === 'mine' }"
      @click="goMine"
    >
      <img
        :src="active === 'mine' ? '/audience/tab-mine-active.png' : '/audience/tab-mine.png'"
        alt=""
      >
      <span>我的</span>
    </button>
  </nav>
</template>

<style scoped>
.bar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  background: #ffffff;
  border-top: 1px solid #f0f0f0;
}
.item {
  flex: 1;
  border: 0;
  background: transparent;
  color: #999999;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
}
.item img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.item.on {
  color: #1677ff;
}
</style>
