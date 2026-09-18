<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getWatchSdk,
  getStoredGuestId,
  storeGuestId,
  getStoredNickname,
  storeNickname,
  type WatchSdkData,
} from "@/api/watch";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const data = ref<WatchSdkData | null>(null);
const sdkReady = ref(false);
const sdkFailed = ref(false);
const useFallback = ref(false);
const roomHint = ref("");

const nicknameInput = ref(getStoredNickname());
const showNicknameForm = ref(!getStoredNickname());
const nicknameSaving = ref(false);

/** 3.9.1 实例；旧版全局 VHALL_SDK 不再使用 */
let sdkInstance: VhallSdkInstance | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(el);
  });
}

function formatSdkError(msg: unknown): string {
  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { msg?: string };
      return parsed.msg || msg;
    } catch {
      return msg;
    }
  }
  if (msg && typeof msg === "object" && "msg" in msg) {
    return String((msg as { msg?: string }).msg || JSON.stringify(msg));
  }
  if (msg != null) {
    return JSON.stringify(msg);
  }
  return "SDK 错误";
}

async function load() {
  loading.value = true;
  error.value = "";
  roomHint.value = "";
  sdkReady.value = false;
  sdkFailed.value = false;
  useFallback.value = false;
  data.value = null;
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
    sdkInstance = null;
  }
  try {
    const guestId = getStoredGuestId();
    const nickname = getStoredNickname() || undefined;
    const params: Record<string, string> = {};
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    const res = await getWatchSdk(id, params);
    storeGuestId(res.guestId);
    data.value = res;

    // 先结束 loading，让 #player / #docWrap 进 DOM
    loading.value = false;
    await nextTick();

    if (res.sdk.jqueryUrl) {
      await loadScript(res.sdk.jqueryUrl);
    }
    await loadScript(res.sdk.scriptUrl);

    if (!window.VhallSDK) {
      throw new Error("SDK 加载异常，未找到 VhallSDK（需 3.9.1）");
    }

    // 3.9.1：只用 email，不要同时传 account
    sdkInstance = new window.VhallSDK({
      app_key: res.sdk.appKey,
      signedat: res.sdk.signedAt,
      webinar_id: res.sdk.webinarId,
      email: res.sdk.email,
      username: res.sdk.username,
      sign: res.sdk.sign,
      sign_type: res.sdk.signType ?? 0,
      videoContent: "#player",
      docContent: "#docWrap",
    });

    sdkInstance.$on("error", (msg: unknown) => {
      sdkFailed.value = true;
      error.value = formatSdkError(msg);
    });

    sdkReady.value = true;
  } catch (e) {
    sdkFailed.value = true;
    error.value = e instanceof Error ? e.message : "加载失败";
    loading.value = false;
  }
}

function switchToFallback() {
  useFallback.value = true;
  error.value = "";
}

async function saveNickname() {
  const name = nicknameInput.value.trim();
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await load();
}

function changeNickname() {
  nicknameInput.value = getStoredNickname();
  showNicknameForm.value = true;
}

onMounted(() => {
  if (!showNicknameForm.value) {
    load();
  }
});

onBeforeUnmount(() => {
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  sdkInstance = null;
});
</script>

<template>
  <div class="min-h-dvh bg-black text-white md:flex md:items-center md:justify-center md:bg-gray-900">
    <div
      class="flex min-h-dvh flex-col md:min-h-0 md:aspect-video md:w-[960px] md:max-w-full md:overflow-hidden md:rounded-lg"
    >
      <div
        v-if="showNicknameForm"
        class="flex flex-1 flex-col items-center justify-center gap-4 p-6"
      >
        <h2 class="text-lg font-semibold text-green-400">进入观看</h2>
        <p class="text-sm text-gray-400">设置你的昵称（可选，默认「观众」）</p>
        <div class="flex items-center gap-2">
          <input
            v-model="nicknameInput"
            type="text"
            maxlength="50"
            placeholder="观众"
            class="w-48 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            @keyup.enter="saveNickname"
          />
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            :disabled="nicknameSaving"
            @click="saveNickname"
          >
            进入
          </button>
        </div>
        <button
          class="text-sm text-gray-500 hover:text-gray-300"
          @click="() => { showNicknameForm = false; load(); }"
        >
          跳过，使用默认昵称
        </button>
      </div>

      <template v-else>
        <div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
          <p class="text-sm text-gray-400">
            昵称：<span class="text-gray-200">{{ data?.nickname || getStoredNickname() || '观众' }}</span>
          </p>
          <button
            class="text-xs text-gray-500 hover:text-gray-300"
            @click="changeNickname"
          >
            修改
          </button>
        </div>

        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          加载中…
        </div>

        <div
          v-else-if="error && !useFallback"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
          <div class="flex gap-3">
            <button
              class="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              @click="load"
            >
              重试
            </button>
            <button
              v-if="sdkFailed && data?.embedUrl"
              class="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              @click="switchToFallback"
            >
              切换嵌入模式
            </button>
          </div>
        </div>

        <div
          v-else-if="data && useFallback"
          class="flex flex-1 items-center justify-center"
        >
          <iframe
            :src="data.embedUrl"
            class="h-full w-full flex-1 border-0"
            allowfullscreen
            allow="fullscreen; microphone; camera; autoplay; display-capture"
          />
        </div>

        <div
          v-else-if="data"
          class="relative flex flex-1 flex-col"
        >
          <p
            v-if="roomHint"
            class="absolute left-0 right-0 top-2 z-10 px-4 text-center text-xs text-amber-300"
          >
            {{ roomHint }}
          </p>
          <div
            id="player"
            class="min-h-0 w-full flex-1 bg-black"
          />
          <!-- 3.9.1 文档要求 docContent 必填；无文档时占位即可 -->
          <div
            id="docWrap"
            class="hidden"
          />
        </div>
      </template>
    </div>
  </div>
</template>
