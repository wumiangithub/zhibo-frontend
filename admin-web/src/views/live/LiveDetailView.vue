<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { ElIcon } from "element-plus";
import {
  ActivityReady,
  activityReadyLabel,
  getActivity,
  getHostUrl,
  type ActivityDetail,
  type ActivityId,
} from "@/api/activity";
import { getAccessToken } from "@/utils/authSession";
import { buildAudienceWatchUrl } from "@/utils/liveLinks";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import UiButton from "@/components/ui/UiButton.vue";
import ShareDialog from "@/components/share/ShareDialog.vue";
import BasicSettingsTab from "./detail/BasicSettingsTab.vue";
import BroadcastSettingsTab from "./detail/BroadcastSettingsTab.vue";
import LiveDataTab from "./detail/LiveDataTab.vue";
import CommerceSettingsTab from "./detail/CommerceSettingsTab.vue";
import PlaceholderModuleTab from "./detail/PlaceholderModuleTab.vue";

type TabKey = "basic" | "broadcast" | "commerce" | "userOps" | "data";

const TAB_KEYS: TabKey[] = ["basic", "broadcast", "commerce", "userOps", "data"];

const route = useRoute();
const router = useRouter();

const id = computed<ActivityId>(() => String(route.params.id));
const loading = ref(true);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const pageError = ref("");
const readyRefreshing = ref(false);
const basicTabRef = ref<InstanceType<typeof BasicSettingsTab> | null>(null);
const commerceTabRef = ref<InstanceType<typeof CommerceSettingsTab> | null>(null);
const shareVisible = ref(false);

type DirtyTab = {
  isDirty: () => boolean;
  confirmLeave: () => Promise<boolean>;
};

/** 录播且尚未就绪：显示转码状态旁的刷新按钮 */
const showReadyRefresh = computed(() => {
  const d = detail.value;
  if (!d || d.type !== 4) return false;
  return (d.ready ?? ActivityReady.OK) !== ActivityReady.OK;
});

/** 定时录播不支持主持人参会，顶栏「开播」勿再拉 host */
const timedHostUnsupported = computed(() => {
  const d = detail.value;
  return !!d && d.type === 4 && (d.isTiming ?? true);
});

const sideNav = [
  { key: "basic" as const, label: "基本设置" },
  { key: "broadcast" as const, label: "开播设置" },
  { key: "commerce" as const, label: "直播带货" },
  { key: "userOps" as const, label: "用户运营" },
  { key: "data" as const, label: "直播数据" },
];

const crumbs: AppBreadcrumbItem[] = [
  { label: "直播", to: "/live" },
  { label: "直播管理", to: "/live" },
  { label: "直播设置" },
];

const activeTab = computed<TabKey>(() => {
  const q = String(route.query.tab ?? "");
  if (TAB_KEYS.includes(q as TabKey)) return q as TabKey;
  return "basic";
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

function currentDirtyTab(): DirtyTab | null {
  if (activeTab.value === "basic") {
    return (basicTabRef.value as DirtyTab | null) ?? null;
  }
  if (activeTab.value === "commerce") {
    return (commerceTabRef.value as DirtyTab | null) ?? null;
  }
  return null;
}

async function confirmLeaveDirtyIfNeeded(): Promise<boolean> {
  const tab = currentDirtyTab();
  if (!tab?.isDirty?.()) return true;
  return tab.confirmLeave();
}

async function setTab(key: TabKey) {
  if (key === activeTab.value) return;
  if (!(await confirmLeaveDirtyIfNeeded())) return;
  const query: Record<string, string> = {};
  if (key !== "basic") query.tab = key;
  void router.replace({ path: route.path, query });
}

onBeforeRouteLeave(async () => confirmLeaveDirtyIfNeeded());

async function fetchDetail(opts?: { silent?: boolean }) {
  const silent = opts?.silent === true;
  if (silent) {
    if (readyRefreshing.value) return;
    readyRefreshing.value = true;
  } else {
    loading.value = true;
    error.value = "";
  }
  try {
    detail.value = await getActivity(id.value);
    if (silent) pageError.value = "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    if (silent) {
      pageError.value = msg;
    } else {
      error.value = msg;
    }
  } finally {
    if (silent) {
      readyRefreshing.value = false;
    } else {
      loading.value = false;
    }
  }
}

function refreshReadyStatus() {
  void fetchDetail({ silent: true });
}

async function goLive() {
  if (!detail.value?.canBroadcast || timedHostUnsupported.value) return;
  try {
    const { hostUrl } = await getHostUrl(id.value);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : "获取开播链接失败";
  }
}

function goConsole() {
  const token = getAccessToken() ?? "";
  const url = `http://localhost:5174/console/${id.value}?token=${encodeURIComponent(token)}`;
  window.open(url, "_blank", "noopener");
}

onMounted(fetchDetail);
watch(id, fetchDetail);
</script>

<template>
  <div class="live-detail">
    <AppBreadcrumb :items="crumbs" />

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
      <div class="summary card">
        <div class="summary-main">
          <div class="cover">
            <img
              v-if="detail.coverUrl"
              :src="detail.coverUrl"
              alt=""
              class="cover-img"
            >
            <span
              v-else
              class="cover-placeholder"
            >封面</span>
          </div>
          <div class="summary-info">
            <h1 class="summary-title">
              {{ detail.title }}
              <span
                v-if="detail.type === 4"
                class="ready-badge"
                :class="{
                  'is-ok': (detail.ready ?? ActivityReady.OK) === ActivityReady.OK,
                  'is-pending': detail.ready === ActivityReady.PENDING,
                  'is-fail': detail.ready === ActivityReady.FAIL,
                }"
              >【{{ activityReadyLabel(detail.ready) }}】</span>
              <button
                v-if="showReadyRefresh"
                type="button"
                class="ready-refresh"
                :disabled="readyRefreshing"
                title="刷新转码状态"
                @click="refreshReadyStatus"
              >
                <ElIcon
                  class="ready-refresh__icon"
                  :class="{ 'is-spinning': readyRefreshing }"
                  :size="14"
                >
                  <Refresh />
                </ElIcon>
              </button>
            </h1>
            <p class="summary-time">直播时间: {{ timeRange }}</p>
          </div>
        </div>
        <div class="summary-actions">
          <UiButton
            variant="default"
            :disabled="!detail.canBroadcast || timedHostUnsupported"
            :title="
              timedHostUnsupported
                ? '定时直播不支持主持人参会'
                : undefined
            "
            @click="goLive"
          >
            开播
          </UiButton>
          <UiButton
            variant="default"
            @click="goConsole"
          >
            中控台
          </UiButton>
          <UiButton
            variant="primary"
            @click="shareVisible = true"
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
            ref="basicTabRef"
            :activity-id="id"
            :detail="detail"
            @refreshed="fetchDetail"
          />
          <BroadcastSettingsTab
            v-else-if="activeTab === 'broadcast'"
            :activity-id="id"
            :can-broadcast="!!detail.canBroadcast"
            :live-title="detail.title"
            :start-time="detail.startTime"
            :provider="detail.provider"
            :host-locked="!!detail.reportId"
            :activity-type="detail.type"
            :is-timing="detail.isTiming"
            @error="pageError = $event"
            @refreshed="fetchDetail"
          />
          <CommerceSettingsTab
            v-else-if="activeTab === 'commerce'"
            ref="commerceTabRef"
            :activity-id="id"
            :detail="detail"
            @refreshed="fetchDetail"
          />
          <PlaceholderModuleTab
            v-else-if="activeTab === 'userOps'"
            title="用户运营"
          />
          <LiveDataTab
            v-else
            :activity-id="id"
          />
        </div>
      </div>
    </template>

    <ShareDialog
      v-model="shareVisible"
      :title="detail?.title ?? ''"
      :watch-url="buildAudienceWatchUrl(id)"
    />
  </div>
</template>

<style scoped>
.live-detail {
  min-height: 100%;
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
.summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 12px;
}
.summary-main {
  display: flex;
  gap: 14px;
  min-width: 0;
}
.cover {
  flex: none;
  width: 120px;
  height: 68px;
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
.summary-title {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
}
.ready-badge {
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}
.ready-badge.is-ok {
  color: #389e0d;
}
.ready-badge.is-pending {
  color: #d48806;
}
.ready-badge.is-fail {
  color: #cf1322;
}
.ready-refresh {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.ready-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.ready-refresh:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.ready-refresh__icon.is-spinning {
  animation: ready-spin 0.8s linear infinite;
}
@keyframes ready-spin {
  to {
    transform: rotate(360deg);
  }
}
.summary-time {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.summary-actions {
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
