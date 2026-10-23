<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getHostUrl } from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import {
  isLiveRoomRole,
  type LiveRoomRole,
} from "@/views/live/detail/role/roleTypes";

const route = useRoute();

const activityId = computed(() => String(route.params.activityId ?? "").trim());
const role = computed<LiveRoomRole | null>(() => {
  const raw = Number(route.query.role);
  return isLiveRoomRole(raw) ? raw : null;
});

const loading = ref(true);
const error = ref("");
const pageUrl = ref("");

/**
 * 对齐微吼 iframe 示例 allow；camera/microphone 用 *，避免页内再跳其它微吼域名后丢权限。
 * 参考：allow="camera; microphone; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; display-capture"
 */
const STUDIO_IFRAME_ALLOW =
  "camera *; microphone *; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; display-capture";

/** 父页非 HTTPS 时，部分浏览器会拦 iframe 内摄像头（localhost 除外）。 */
const insecureParent = computed(
  () =>
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1",
);

async function load() {
  if (!activityId.value) {
    error.value = "活动无效";
    pageUrl.value = "";
    loading.value = false;
    return;
  }
  if (role.value == null) {
    error.value = "缺少开播角色";
    pageUrl.value = "";
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  pageUrl.value = "";
  try {
    const data = await getHostUrl(activityId.value, role.value);
    const url = (data.hostUrl ?? "").trim();
    if (!url) {
      error.value = "暂无参会地址";
      return;
    }
    pageUrl.value = url;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取参会地址失败";
  } finally {
    loading.value = false;
  }
}

/** 当前窗口跳转微吼参会页（顶层 HTTPS），绕过本站 HTTP 嵌 iframe 无摄像头。 */
function openExternally() {
  const url = pageUrl.value.trim();
  if (!url) return;
  window.location.replace(url);
}

onMounted(() => {
  void load();
});

watch(
  () => [activityId.value, role.value] as const,
  () => {
    void load();
  },
);
</script>

<template>
  <div class="live-studio">
    <div class="studio-body">
      <div
        v-if="insecureParent"
        class="studio-warn"
      >
        <p class="studio-warn-text">
          当前页面不是 HTTPS，浏览器可能禁止 iframe 内使用摄像头 / 麦克风。可点「外部打开」直接进入微吼开播页。
        </p>
        <UiButton
          variant="primary"
          :disabled="!pageUrl"
          @click="openExternally"
        >
          外部打开
        </UiButton>
      </div>
      <p
        v-if="loading"
        class="studio-state"
      >
        加载参会页…
      </p>
      <div
        v-else-if="error"
        class="studio-state is-error"
      >
        <p>{{ error }}</p>
        <UiButton
          variant="primary"
          @click="load"
        >
          重试
        </UiButton>
      </div>
      <iframe
        v-else-if="pageUrl"
        class="studio-frame"
        :src="pageUrl"
        title="开播参会"
        allowfullscreen
        :allow="STUDIO_IFRAME_ALLOW"
      />
    </div>
  </div>
</template>

<style scoped>
.live-studio {
  box-sizing: border-box;
  height: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0b0f17;
}
.studio-body {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
.studio-warn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding: 8px 16px;
  background: #fff3cd;
  border-bottom: 1px solid #ffe69c;
}
.studio-warn-text {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: #5c3d00;
}
.studio-frame {
  display: block;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #000;
}
.studio-state {
  margin: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  font-size: 14px;
  line-height: 22px;
  color: #c5cbd6;
  text-align: center;
}
.studio-state.is-error {
  color: #ff8f8f;
}
</style>
