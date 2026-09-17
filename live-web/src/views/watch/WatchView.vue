<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getWatch,
  getStoredGuestId,
  storeGuestId,
  type WatchData,
} from "@/api/watch";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const data = ref<WatchData | null>(null);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const guestId = getStoredGuestId();
    const res = await getWatch(id, guestId ? { guestId } : {});
    storeGuestId(res.guestId);
    data.value = res;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <!-- 移动优先：默认全屏铺满；md 断点(≥768px)起居中限宽 -->
  <div class="min-h-dvh bg-black text-white md:flex md:items-center md:justify-center md:bg-gray-900">
    <div
      class="flex min-h-dvh flex-col md:min-h-0 md:aspect-video md:w-[960px] md:max-w-full md:overflow-hidden md:rounded-lg"
    >
      <div
        v-if="loading"
        class="flex flex-1 items-center justify-center text-sm text-gray-400"
      >
        加载中…
      </div>
      <div
        v-else-if="error"
        class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p class="text-sm text-red-400">{{ error }}</p>
        <button
          class="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
          @click="load"
        >
          重试
        </button>
      </div>
      <iframe
        v-else-if="data"
        :src="data.embedUrl"
        class="h-full w-full flex-1 border-0"
        allowfullscreen
        allow="fullscreen; microphone; camera; autoplay; display-capture"
      />
    </div>
  </div>
</template>
