<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getWatchSdk, type WatchSdkData } from "@/api/watch";
import { listWatchRecords, type WatchRecordItem } from "@/api/replayWatch";
import NativeReplayPlayer from "@/components/watch/NativeReplayPlayer.vue";
import { useReplayWatch } from "@/composables/useReplayWatch";
import {
  getViewerId,
  isViewerAuthQueryKey,
  readNicknameFromSearch,
  syncViewerAccessTokenFromUrl,
  syncViewerIdFromUrl,
} from "@/utils/viewerAuth";
import { getStoredNickname, storeNickname } from "@/api/watch";
import { ensureWxJsSdk } from "@/utils/miniProgram";

const route = useRoute();
const router = useRouter();

const activityId = computed(() => String(route.params.id ?? ""));
const recordIdParam = computed(() => {
  const raw = route.query.recordId;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const loading = ref(true);
const error = ref("");
const sdkData = ref<WatchSdkData | null>(null);
const record = ref<WatchRecordItem | null>(null);

const routeQuery = route.query as Record<string, unknown>;
syncViewerIdFromUrl(routeQuery);
syncViewerAccessTokenFromUrl(routeQuery);
const urlNickname = readNicknameFromSearch(routeQuery);
if (urlNickname) storeNickname(urlNickname);

const speedAllow = computed(() => sdkData.value?.playbackSpeedAllow !== false);
const fastForwardAllow = computed(
  () => sdkData.value?.playbackFastForwardAllow !== false,
);

const replayWatch = useReplayWatch({
  activityId: () => activityId.value,
  recordId: () => record.value?.id ?? recordIdParam.value,
  active: () => {
    const d = sdkData.value;
    if (!d || d.playbackEnabled === false || d.playbackExpired) return false;
    return !!record.value?.tosUrl;
  },
});

function preservedQuery(): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(route.query)) {
    if (k === "recordId") continue;
    if (isViewerAuthQueryKey(k)) continue;
    if (v == null) continue;
    q[k] = v as string | string[];
  }
  return q;
}

function goBackToWatch() {
  void router.replace({
    name: "watch",
    params: { id: activityId.value },
    query: preservedQuery(),
  });
}

async function load() {
  loading.value = true;
  error.value = "";
  record.value = null;
  try {
    await ensureWxJsSdk();
    const id = activityId.value;
    if (!id) {
      error.value = "活动无效";
      return;
    }
    const rid = recordIdParam.value;
    if (rid == null) {
      error.value = "请选择回放";
      return;
    }

    const [sdk, records] = await Promise.all([
      getWatchSdk(id, {
        nickname: getStoredNickname().trim() || undefined,
        viewerId: getViewerId() ?? undefined,
      }),
      listWatchRecords(id),
    ]);
    sdkData.value = sdk;

    if (sdk.playbackEnabled === false) {
      error.value = "回放未开启";
      return;
    }
    if (sdk.playbackExpired) {
      error.value = "回放已过期";
      return;
    }

    const hit = (records.list ?? []).find((row) => Number(row.id) === rid);
    if (!hit?.tosUrl) {
      error.value = "回放不存在或未就绪";
      return;
    }
    record.value = hit;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [activityId.value, recordIdParam.value] as const,
  () => {
    void load();
  },
);

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-black text-white">
    <header
      class="flex flex-none items-center border-b border-gray-800 px-3 py-2 md:px-4"
    >
      <h1 class="min-w-0 flex-1 truncate text-sm font-medium md:text-base">
        {{ record?.title || sdkData?.title || "回放" }}
      </h1>
    </header>

    <main class="flex min-h-0 flex-1 flex-col justify-center">
      <p
        v-if="loading"
        class="py-16 text-center text-sm text-gray-400"
      >
        加载中…
      </p>
      <div
        v-else-if="error"
        class="flex flex-col items-center gap-4 px-6 py-16 text-center"
      >
        <p class="text-sm text-amber-400">
          {{ error }}
        </p>
        <button
          type="button"
          class="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
          @click="goBackToWatch"
        >
          返回直播间
        </button>
      </div>
      <NativeReplayPlayer
        v-else-if="record?.tosUrl"
        :src="record.tosUrl"
        :title="record.title"
        :speed-allow="speedAllow"
        :fast-forward-allow="fastForwardAllow"
        @play="replayWatch.onPlay()"
        @pause="replayWatch.onPause()"
        @ended="replayWatch.onEnded()"
      />
    </main>
  </div>
</template>
