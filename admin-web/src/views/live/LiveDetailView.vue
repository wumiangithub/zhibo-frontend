<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { getActivity, getHostUrl, STATE_LABEL, type ActivityDetail } from "@/api/activity";
import { useToast } from "@/composables/useToast";
import UiButton from "@/components/ui/UiButton.vue";
import BasicSettingsTab from "./detail/BasicSettingsTab.vue";
import BroadcastSettingsTab from "./detail/BroadcastSettingsTab.vue";
import OperationSettingsTab from "./detail/OperationSettingsTab.vue";
import LiveDataTab from "./detail/LiveDataTab.vue";

type TabKey = "basic" | "broadcast" | "operation" | "data";

const TAB_KEYS: TabKey[] = ["basic", "broadcast", "operation", "data"];

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const id = computed(() => Number(route.params.id));
const loading = ref(true);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const pageError = ref("");

const sideNav = [
  { key: "basic" as const, label: "基本设置" },
  { key: "broadcast" as const, label: "开播设置" },
  { key: "operation" as const, label: "运营设置" },
  { key: "data" as const, label: "直播数据" },
];

const activeTab = computed<TabKey>(() => {
  const q = String(route.query.tab ?? "");
  if (TAB_KEYS.includes(q as TabKey)) return q as TabKey;
  return "broadcast";
});

const statusLabel = computed(() => {
  if (!detail.value) return "";
  const map: Record<number, string> = {
    1: "直播中",
    2: "未开始",
    3: "已结束",
    4: "点播",
    5: "回放",
  };
  return map[detail.value.state] ?? STATE_LABEL[detail.value.state] ?? String(detail.value.state);
});

const timeRange = computed(() => {
  if (!detail.value) return "";
  const start = detail.value.startTime;
  const end =
    detail.value.endTime && !detail.value.endTime.startsWith("0000")
      ? detail.value.endTime
      : "";
  return end ? `${start} 至 ${end}` : start;
});

function setTab(key: TabKey) {
  void router.replace({
    path: route.path,
    query: key === "broadcast" ? {} : { tab: key },
  });
}

async function fetchDetail() {
  loading.value = true;
  error.value = "";
  try {
    detail.value = await getActivity(id.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function goLive() {
  try {
    const { hostUrl } = await getHostUrl(id.value);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : "获取开播链接失败";
  }
}

async function shareWatch() {
  try {
    await navigator.clipboard.writeText(`http://localhost:5174/watch/${id.value}`);
    toast("观看链接已复制");
  } catch {
    toast("复制失败");
  }
}

onMounted(fetchDetail);
watch(id, fetchDetail);
</script>

<template>
  <div class="live-detail">
    <div class="crumb">
      <RouterLink
        to="/live"
        class="crumb-link"
      >
        直播管理
      </RouterLink>
      <span class="crumb-sep">/</span>
      <span>详情</span>
    </div>

    <p
      v-if="loading"
      class="status-text"
    >
      加载中…
    </p>
    <p
      v-else-if="error && !detail"
      class="status-err"
    >
      {{ error }}
    </p>

    <template v-else-if="detail">
      <div class="hero card">
        <div class="hero-main">
          <div class="cover">
            <img
              v-if="detail.coverUrl"
              :src="detail.coverUrl"
              alt=""
              class="cover-img"
            />
            <span
              v-else
              class="cover-placeholder"
            >直播</span>
            <span class="cover-badge">{{ statusLabel }}</span>
          </div>
          <div class="hero-info">
            <h1 class="hero-title">{{ detail.title }}</h1>
            <p class="hero-time">直播时间：{{ timeRange }}</p>
            <div class="hero-links">
              <UiButton
                variant="link"
                @click="toast('「下架」暂未开放')"
              >
                下架
              </UiButton>
              <UiButton
                variant="link"
                @click="goLive"
              >
                去直播
              </UiButton>
              <UiButton
                variant="link"
                @click="toast('「更多」暂未开放')"
              >
                更多
              </UiButton>
            </div>
          </div>
        </div>
        <div class="hero-actions">
          <UiButton
            variant="default"
            @click="toast('「数据大屏」暂未开放')"
          >
            数据大屏
          </UiButton>
          <UiButton
            variant="default"
            @click="toast('「中控台」暂未开放')"
          >
            中控台
          </UiButton>
          <UiButton
            variant="primary"
            @click="shareWatch"
          >
            分享
          </UiButton>
        </div>
      </div>

      <p
        v-if="pageError"
        class="status-err"
      >
        {{ pageError }}
      </p>

      <div class="body card">
        <aside class="side">
          <button
            v-for="item in sideNav"
            :key="item.key"
            type="button"
            class="side-item"
            :class="{ 'is-active': activeTab === item.key }"
            @click="setTab(item.key)"
          >
            {{ item.label }}
          </button>
        </aside>

        <div class="panel">
          <BasicSettingsTab
            v-if="activeTab === 'basic'"
            :activity-id="id"
            :detail="detail"
            @refreshed="fetchDetail"
          />
          <BroadcastSettingsTab
            v-else-if="activeTab === 'broadcast'"
            :activity-id="id"
            @error="pageError = $event"
          />
          <OperationSettingsTab
            v-else-if="activeTab === 'operation'"
            :activity-id="id"
            :detail="detail"
            @refreshed="fetchDetail"
          />
          <LiveDataTab
            v-else
            :activity-id="id"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.live-detail {
  min-height: 100%;
}
.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.crumb-link {
  color: var(--color-text-secondary);
  text-decoration: none;
}
.crumb-link:hover {
  color: var(--color-primary);
}
.crumb-sep {
  color: var(--color-text-placeholder);
}
.status-text {
  font-size: 13px;
  color: var(--color-text-placeholder);
}
.status-err {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff1f0;
  color: var(--color-danger);
  font-size: 13px;
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 12px;
}
.hero-main {
  display: flex;
  gap: 14px;
  min-width: 0;
}
.cover {
  position: relative;
  flex: none;
  width: 96px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: #f0f0f0;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.cover-badge {
  position: absolute;
  left: 0;
  bottom: 0;
  padding: 1px 6px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
}
.hero-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}
.hero-time {
  margin: 6px 0 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: none;
}
.body {
  display: flex;
  min-height: 420px;
}
.side {
  flex: none;
  width: 140px;
  padding: 12px 8px;
  border-right: 1px solid var(--color-border-light);
}
.side-item {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  outline: none;
}
.side-item:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
.side-item.is-active {
  background: var(--color-primary-bg-active);
  color: var(--color-primary);
  font-weight: 600;
}
.panel {
  flex: 1;
  min-width: 0;
  padding: 16px 20px 24px;
}
</style>
