<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import {
  getCourse,
  SHELF_STATUS_LABEL,
  type CourseDetail,
  type ShelfStatus,
} from "@/api/course";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import CourseBasicInfoTab from "./detail/CourseBasicInfoTab.vue";
import CourseCatalogTab from "./detail/CourseCatalogTab.vue";

type TabKey = "basic" | "catalog" | "sales";

const TAB_KEYS: TabKey[] = ["basic", "catalog", "sales"];

const route = useRoute();
const router = useRouter();

const id = computed(() => String(route.params.id ?? ""));
const loading = ref(true);
const error = ref("");
const detail = ref<CourseDetail | null>(null);
const basicTabRef = ref<InstanceType<typeof CourseBasicInfoTab> | null>(null);

const sideNav = [
  { key: "basic" as const, label: "基本信息" },
  { key: "catalog" as const, label: "课程目录" },
  { key: "sales" as const, label: "售卖设置" },
];

const crumbs: AppBreadcrumbItem[] = [
  { label: "课程", to: "/course" },
  { label: "课程管理", to: "/course" },
  { label: "课程设置" },
];

const activeTab = computed<TabKey>(() => {
  const q = String(route.query.tab ?? "");
  if (TAB_KEYS.includes(q as TabKey)) return q as TabKey;
  return "basic";
});

const shelfLabel = computed(() => {
  const status = detail.value?.shelfStatus as ShelfStatus | undefined;
  if (!status) return "";
  return SHELF_STATUS_LABEL[status] ?? status;
});

function shelfDotClass(status?: ShelfStatus) {
  if (status === "on") return "dot--green";
  if (status === "banned") return "dot--red";
  return "dot--grey";
}

type DirtyTab = {
  isDirty: () => boolean;
  confirmLeave: () => Promise<boolean>;
};

function currentDirtyTab(): DirtyTab | null {
  if (activeTab.value === "basic") {
    return (basicTabRef.value as DirtyTab | null) ?? null;
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
  if (!silent) {
    loading.value = true;
    error.value = "";
  }
  try {
    detail.value = await getCourse(id.value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    if (!silent) error.value = msg;
  } finally {
    if (!silent) loading.value = false;
  }
}

function onTabRefreshed() {
  void fetchDetail({ silent: true });
}

onMounted(fetchDetail);
watch(id, fetchDetail);
</script>

<template>
  <div class="course-settings is-fill">
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
            </h1>
            <div class="summary-meta">
              <span>小节数 {{ detail.contentCount ?? 0 }}</span>
              <span class="meta-sep">|</span>
              <span>累计用户数 {{ detail.totalUserCount ?? 0 }}</span>
              <span
                v-if="shelfLabel"
                class="shelf-badge"
              >
                <i
                  class="dot"
                  :class="shelfDotClass(detail.shelfStatus)"
                />
                {{ shelfLabel }}
              </span>
            </div>
          </div>
        </div>
      </div>

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
          <CourseBasicInfoTab
            v-if="activeTab === 'basic'"
            ref="basicTabRef"
            :course-id="id"
            :detail="detail"
            @refreshed="onTabRefreshed"
          />
          <CourseCatalogTab
            v-else-if="activeTab === 'catalog'"
            :course-id="id"
            @refreshed="onTabRefreshed"
          />
          <div
            v-else
            class="placeholder"
          >
            <p>{{ sideNav.find((item) => item.key === activeTab)?.label }}下一期再做。</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.course-settings {
  min-height: 100%;
}
/* 撑满视口剩余高度，避免正文卡片下方大块灰底 */
.course-settings.is-fill {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.course-settings.is-fill > :deep(.app-breadcrumb) {
  flex: none;
}
.course-settings.is-fill .summary {
  flex: none;
}
.course-settings.is-fill .body {
  flex: 1;
  min-height: 0;
}
.course-settings.is-fill .panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}
.course-settings.is-fill .panel > * {
  flex: 1;
  min-height: 0;
}
.status-text,
.status-err {
  margin: 16px 0;
  font-size: 14px;
}
.status-err {
  color: var(--color-danger);
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 16px 20px;
}
.summary-main {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.cover {
  width: 96px;
  height: 54px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f5f6f8;
  border-radius: 4px;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #bbb;
  font-size: 12px;
}
.summary-info {
  min-width: 0;
}
.summary-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.summary-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}
.meta-sep {
  color: #d9d9d9;
}
.shelf-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #bfbfbf;
}
.dot--green {
  background: var(--color-success);
}
.dot--red {
  background: var(--color-danger);
}
.dot--grey {
  background: #bfbfbf;
}
.body {
  display: flex;
  margin-top: 12px;
  overflow: hidden;
}
.side {
  width: 160px;
  flex-shrink: 0;
  padding: 12px 0;
  border-right: 1px solid #f0f0f0;
  background: #fafbfc;
}
.side-item {
  display: block;
  width: 100%;
  padding: 12px 20px;
  text-align: left;
  font-size: 14px;
  color: #333;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  cursor: pointer;
}
.side-item:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.side-item.is-active {
  color: var(--color-primary);
  font-weight: 600;
  background: var(--color-primary-bg);
  border-left-color: var(--color-primary);
}
.panel {
  flex: 1;
  min-width: 0;
  padding: 20px 24px;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 280px;
  color: #999;
  font-size: 14px;
}
</style>
