<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import {
  getActivity,
  getHostUrl,
  getEmbedUrl,
  updateActivity,
  endActivity,
  deleteActivity,
  STATE_LABEL,
  TYPE_LABEL,
  VERIFY_LABEL,
  type ActivityDetail,
} from "@/api/activity";

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const copied = ref("");
const embedUrl = ref("");
const embedError = ref("");
const embedLoading = ref(false);

const editing = ref(false);
const editTitle = ref("");
const editStartTime = ref("");
const saving = ref(false);

const confirmAction = ref<"end" | "delete" | null>(null);
const actionLoading = ref(false);

function toDateTimeLocal(s: string): string {
  if (!s) return "";
  return s.replace(" ", "T").slice(0, 16);
}

function toApiTime(s: string): string {
  return s.replace("T", " ") + ":00";
}

const canEnd = computed(() => {
  if (!detail.value) return false;
  return detail.value.state === 1 || detail.value.state === 2;
});

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

async function copyHost() {
  try {
    const { hostUrl } = await getHostUrl(id);
    await copy(hostUrl, "开播链接已复制，可粘贴到有摄像头的电脑打开");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取开播链接失败";
  }
}

function copyWatchLink() {
  copy(`http://localhost:5174/watch/${id}`, "观看链接已复制");
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

function startEdit() {
  if (!detail.value) return;
  editTitle.value = detail.value.title;
  editStartTime.value = toDateTimeLocal(detail.value.startTime);
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

async function saveEdit() {
  if (!detail.value) return;
  saving.value = true;
  error.value = "";
  try {
    const payload: Record<string, string> = {};
    if (editTitle.value.trim() && editTitle.value !== detail.value.title) {
      payload.title = editTitle.value.trim();
    }
    const newTime = toApiTime(editStartTime.value);
    if (newTime !== detail.value.startTime) {
      payload.startTime = newTime;
    }
    if (Object.keys(payload).length > 0) {
      await updateActivity(id, payload);
      await fetchDetail();
    }
    editing.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    saving.value = false;
  }
}

async function confirmEnd() {
  actionLoading.value = true;
  error.value = "";
  try {
    await endActivity(id);
    await fetchDetail();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "结束直播失败";
  } finally {
    actionLoading.value = false;
    confirmAction.value = null;
  }
}

async function confirmDelete() {
  actionLoading.value = true;
  error.value = "";
  try {
    await deleteActivity(id);
    router.push("/activities");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "删除失败";
    actionLoading.value = false;
    confirmAction.value = null;
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
          <div class="flex-1">
            <template v-if="editing">
              <input
                v-model="editTitle"
                type="text"
                class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xl font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
              />
            </template>
            <template v-else>
              <h2 class="text-xl font-semibold text-gray-800">{{ detail.title }}</h2>
            </template>
            <p class="mt-1 text-sm text-gray-400">ID: {{ detail.id }}</p>
          </div>
          <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
            {{ STATE_LABEL[detail.state] ?? detail.state }}
          </span>
        </div>

        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-gray-400">类型</dt>
            <dd class="text-gray-700">{{ TYPE_LABEL[detail.type] ?? detail.type }}（不可改）</dd>
          </div>
          <div>
            <dt class="text-gray-400">开始时间</dt>
            <dd v-if="!editing" class="text-gray-700">{{ detail.startTime }}</dd>
            <dd v-else>
              <input
                v-model="editStartTime"
                type="datetime-local"
                class="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
            </dd>
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
          <RouterLink
            :to="`/activities/${id}/stats`"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            统计
          </RouterLink>
          <template v-if="!editing">
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="startEdit"
            >
              编辑
            </button>
          </template>
          <template v-else>
            <button
              class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="saving"
              @click="saveEdit"
            >
              {{ saving ? "保存中…" : "保存" }}
            </button>
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              :disabled="saving"
              @click="cancelEdit"
            >
              取消
            </button>
          </template>
          <button
            v-if="canEnd"
            class="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            @click="confirmAction = 'end'"
          >
            结束直播
          </button>
          <button
            class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="confirmAction = 'delete'"
          >
            删除活动
          </button>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            @click="openHost"
          >
            主持人开播（新窗口）
          </button>
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            @click="copyHost"
          >
            复制开播链接
          </button>
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            @click="copyWatchLink"
          >
            复制观看链接
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

    <Teleport to="body">
      <div
        v-if="confirmAction"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="!actionLoading && (confirmAction = null)"
      >
        <div class="w-80 rounded-lg bg-white p-6 shadow-lg">
          <h4 class="text-base font-semibold text-gray-800">
            {{ confirmAction === "end" ? "结束直播" : "删除活动" }}
          </h4>
          <p class="mt-2 text-sm text-gray-600">
            {{
              confirmAction === "end"
                ? "确定要结束这场直播吗？结束后无法重新开播。"
                : "确定要删除这个活动吗？此操作不可撤销。"
            }}
          </p>
          <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          <div class="mt-4 flex justify-end gap-3">
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              :disabled="actionLoading"
              @click="confirmAction = null"
            >
              取消
            </button>
            <button
              v-if="confirmAction === 'end'"
              class="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              :disabled="actionLoading"
              @click="confirmEnd"
            >
              {{ actionLoading ? "处理中…" : "确定结束" }}
            </button>
            <button
              v-else
              class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              :disabled="actionLoading"
              @click="confirmDelete"
            >
              {{ actionLoading ? "处理中…" : "确定删除" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
