<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { MoreFilled, Share } from "@element-plus/icons-vue";
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMessage,
  ElMessageBox,
} from "element-plus";
import {
  getCourse,
  setCourseShelf,
  SHELF_STATUS_LABEL,
  type CourseDetail,
  type ShelfStatus,
} from "@/api/course";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import ShareDialog from "@/components/share/ShareDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { buildCourseShareUrl } from "@/utils/courseLinks";
import DeleteCourseDialog from "./components/DeleteCourseDialog.vue";
import CourseBasicInfoTab from "./detail/CourseBasicInfoTab.vue";
import CourseCatalogTab from "./detail/CourseCatalogTab.vue";
import CourseDataTab from "./detail/CourseDataTab.vue";
import CourseSalesSettingsTab from "./detail/CourseSalesSettingsTab.vue";
import CourseUsersTab from "./detail/CourseUsersTab.vue";

type TabKey = "basic" | "catalog" | "sales" | "users" | "data";

const TAB_KEYS: TabKey[] = ["basic", "catalog", "sales", "users", "data"];

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const id = computed(() => String(route.params.id ?? ""));
const loading = ref(true);
const error = ref("");
const detail = ref<CourseDetail | null>(null);
const basicTabRef = ref<InstanceType<typeof CourseBasicInfoTab> | null>(null);
const salesTabRef = ref<InstanceType<typeof CourseSalesSettingsTab> | null>(null);
const deleteDialogVisible = ref(false);
const shareVisible = ref(false);

const courseShareUrl = computed(() =>
  buildCourseShareUrl(id.value, auth.user?.id),
);

const sideNav = [
  { key: "basic" as const, label: "基本信息" },
  { key: "catalog" as const, label: "课程目录" },
  { key: "sales" as const, label: "售卖设置" },
  { key: "users" as const, label: "用户列表" },
  { key: "data" as const, label: "数据分析" },
];

const validityText = computed(() => detail.value?.validityLabel?.trim() || "长期有效");

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

const showShelfOn = computed(() => {
  const status = detail.value?.shelfStatus;
  return status === "pending" || status === "off";
});

const showShelfOff = computed(() => detail.value?.shelfStatus === "on");

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
  if (activeTab.value === "sales") {
    return (salesTabRef.value as DirtyTab | null) ?? null;
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

function onShare() {
  shareVisible.value = true;
}

async function onShelf(listed: boolean) {
  const d = detail.value;
  if (!d) return;
  const action = listed ? "上架" : "下架";
  try {
    await ElMessageBox.confirm(`确定要${action}「${d.title}」吗？`, action, {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await setCourseShelf(d.id, listed);
    ElMessage.success(`${action}成功`);
    void fetchDetail({ silent: true });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : `${action}失败`);
  }
}

function onDelete() {
  if (!detail.value) return;
  deleteDialogVisible.value = true;
}

function onDeleteConfirmed() {
  ElMessage.success("已删除");
  void router.push("/course");
}

function onMoreCommand(cmd: string) {
  if (cmd === "on") void onShelf(true);
  else if (cmd === "off") void onShelf(false);
  else if (cmd === "delete") onDelete();
}

onMounted(fetchDetail);
watch(id, () => {
  void fetchDetail();
});
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
              <span class="meta-sep">|</span>
              <span>{{ validityText }}</span>
            </div>
          </div>
        </div>
        <div class="summary-actions">
          <button
            type="button"
            class="action-btn"
            @click="onShare"
          >
            <ElIcon :size="16">
              <Share />
            </ElIcon>
            分享
          </button>
          <ElDropdown
            trigger="click"
            @command="onMoreCommand"
          >
            <button
              type="button"
              class="action-btn action-more"
              aria-label="更多"
            >
              <ElIcon :size="16">
                <MoreFilled />
              </ElIcon>
              更多
            </button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem
                  v-if="showShelfOn"
                  command="on"
                  :disabled="!detail.canList"
                >
                  上架
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="showShelfOff"
                  command="off"
                  :disabled="!detail.canUnlist"
                >
                  下架
                </ElDropdownItem>
                <ElDropdownItem
                  command="delete"
                  :divided="showShelfOn || showShelfOff"
                >
                  删除
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
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
          <CourseSalesSettingsTab
            v-else-if="activeTab === 'sales'"
            ref="salesTabRef"
            :course-id="id"
            :detail="detail"
            @refreshed="onTabRefreshed"
          />
          <CourseUsersTab
            v-else-if="activeTab === 'users'"
            :course-id="id"
          />
          <CourseDataTab
            v-else-if="activeTab === 'data'"
            :course-id="id"
          />
        </div>
      </div>
    </template>

    <DeleteCourseDialog
      v-if="detail"
      v-model="deleteDialogVisible"
      :course-id="detail.id"
      @confirmed="onDeleteConfirmed"
    />

    <ShareDialog
      v-model="shareVisible"
      :title="detail?.title ?? ''"
      :watch-url="courseShareUrl"
      brand-line="钱坤云直播平台 发现一门精彩课程"
      hint="给用户分享这个课程："
      watch-verb="点击学习"
      title-fallback="课程"
    />
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
  overflow: hidden;
}
.course-settings.is-fill .panel > * {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
.summary-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  flex: none;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 0;
  background: transparent;
  color: #666;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.action-btn:hover,
.action-more:hover {
  color: var(--color-primary);
}
.action-more {
  outline: none;
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
  /* 底 padding 留给目录等 tab；基本信息底部间隙在 Tab 内 spacer，勿改成 0 */
  padding: 20px 24px;
}
</style>
