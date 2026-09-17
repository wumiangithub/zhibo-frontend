<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  getActivity,
  getHostUrl,
  getEmbedUrl,
  STATE_LABEL,
  TYPE_LABEL,
  VERIFY_LABEL,
  type ActivityDetail,
} from "@/api/activity";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const copied = ref("");
const embedUrl = ref("");
const embedError = ref("");
const embedLoading = ref(false);

async function fetchDetail() {
  loading.value = true;
  error.value = "";
  try {
    detail.value = await getActivity(id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function copy(text: string, label: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = label;
    setTimeout(() => (copied.value = ""), 1500);
  } catch {
    copied.value = "";
  }
}

async function openHost() {
  try {
    const { hostUrl } = await getHostUrl(id);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取开播链接失败";
  }
}

async function loadEmbed() {
  embedLoading.value = true;
  embedError.value = "";
  try {
    const { embedUrl: url } = await getEmbedUrl(id);
    embedUrl.value = url;
  } catch (e) {
    embedError.value = e instanceof Error ? e.message : "获取嵌入地址失败";
  } finally {
    embedLoading.value = false;
  }
}

onMounted(fetchDetail);
</script>

<template>
  <div>
    <div class="mb-4 flex items-center gap-3">
      <RouterLink to="/activities" class="text-sm text-gray-500 hover:text-blue-600">
        ← 返回列表
      </RouterLink>
    </div>

    <p v-if="loading" class="text-sm text-gray-400">加载中…</p>
    <p v-else-if="error && !detail" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
      {{ error }}
    </p>

    <template v-else-if="detail">
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-800">{{ detail.title }}</h2>
            <p class="mt-1 text-sm text-gray-400">ID: {{ detail.id }}</p>
          </div>
          <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
            {{ STATE_LABEL[detail.state] ?? detail.state }}
          </span>
        </div>

        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-gray-400">类型</dt>
            <dd class="text-gray-700">{{ TYPE_LABEL[detail.type] ?? detail.type }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">开始时间</dt>
            <dd class="text-gray-700">{{ detail.startTime }}</dd>
          </div>
          <div v-if="detail.endTime && !detail.endTime.startsWith('0000')">
            <dt class="text-gray-400">结束时间</dt>
            <dd class="text-gray-700">{{ detail.endTime }}</dd>
          </div>
          <div v-if="detail.verify !== undefined">
            <dt class="text-gray-400">观看限制</dt>
            <dd class="text-gray-700">{{ VERIFY_LABEL[detail.verify] ?? detail.verify }}</dd>
          </div>
          <div v-if="detail.pv !== undefined">
            <dt class="text-gray-400">热度</dt>
            <dd class="text-gray-700">{{ detail.pv }}</dd>
          </div>
          <div v-if="detail.createdAt" class="sm:col-span-2">
            <dt class="text-gray-400">创建时间</dt>
            <dd class="text-gray-700">{{ detail.createdAt }}</dd>
          </div>
          <div v-if="detail.introduction" class="sm:col-span-2">
            <dt class="text-gray-400">简介</dt>
            <dd class="whitespace-pre-wrap text-gray-700">{{ detail.introduction }}</dd>
          </div>
        </dl>
      </div>

      <div class="mt-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="mb-3 text-base font-semibold text-gray-800">运营操作</h3>

        <div class="flex flex-wrap items-center gap-3">
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            @click="openHost"
          >
            主持人开播（新窗口）
          </button>
          <button
            v-if="detail.shareLink"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            @click="copy(detail.shareLink!, '分享链接已复制')"
          >
            复制分享链接
          </button>
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            :disabled="embedLoading"
            @click="loadEmbed"
          >
            {{ embedLoading ? "加载中…" : "加载后台嵌入预览" }}
          </button>
        </div>

        <p v-if="copied" class="mt-2 text-sm text-green-600">{{ copied }}</p>
        <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
        <p v-if="embedError" class="mt-2 text-sm text-red-600">{{ embedError }}</p>

        <div v-if="embedUrl" class="mt-4">
          <iframe
            :src="embedUrl"
            class="aspect-video w-full rounded-md border border-gray-200"
            allowfullscreen
            allow="fullscreen; autoplay"
          />
        </div>
      </div>
    </template>
  </div>
</template>
