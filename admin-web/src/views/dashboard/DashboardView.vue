<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElTable, ElTableColumn } from "element-plus";
import { useToast } from "@/composables/useToast";
import {
  getBusinessMetrics,
  getRecentLives,
  RECENT_LIVES_PAGE_SIZE,
  type BusinessMetrics,
  type RecentLiveRow,
} from "@/api/dashboard";
import {
  listNotifications,
  NOTIFICATION_PREVIEW_PAGE_SIZE,
  readNotification,
  type NotificationItem,
} from "@/api/notifications";
import { LIVE_STATE_LABEL } from "@/api/activity";
import { formatDurationSec } from "@/api/audience";
import { ApiError } from "@/api/http";

const router = useRouter();
const { toast } = useToast();

function formatCount(n: number): string {
  return Number(n || 0).toLocaleString("en-US");
}

function formatYuan(raw: string | null | undefined): string {
  const n = Number(raw);
  const v = Number.isFinite(n) ? n : 0;
  return `¥${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function stateTone(state: number) {
  if (state === 1) return "success";
  if (state === 2) return "preview";
  if (state === 5) return "replay";
  if (state === 3) return "ended";
  if (state === 4) return "replay";
  return "muted";
}

function displayTime(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

const metrics = ref<BusinessMetrics>({
  todayVisitorCount: 0,
  todayNewUserCount: 0,
  todayPayAmount: "0.00",
  todayOrderCount: 0,
  totalPayUserCount: 0,
  totalUserCount: 0,
  totalPayAmount: "0.00",
  statsTime: "",
});
const refreshedAt = ref("");
const loading = ref(false);

const recentLiveRows = ref<RecentLiveRow[]>([]);
const livesPage = ref(0);
const livesTotal = ref(0);
const livesLoading = ref(false);
const livesLoadingMore = ref(false);
const tableRef = ref<InstanceType<typeof ElTable> | null>(null);
let tableScrollEl: HTMLElement | null = null;

const hasMoreLives = computed(
  () => recentLiveRows.value.length < livesTotal.value,
);

const livesFooterText = computed(() => {
  if (livesLoading.value) return "";
  if (!recentLiveRows.value.length) return "";
  if (livesLoadingMore.value) return "加载中…";
  if (!hasMoreLives.value) return "没有更多了";
  return "";
});

const bizMetrics = computed(() => [
  { key: "visit", label: "今日访客数", value: formatCount(metrics.value.todayVisitorCount) },
  { key: "newUser", label: "今日新增用户数", value: formatCount(metrics.value.todayNewUserCount) },
  { key: "payAmount", label: "今日支付金额", value: formatYuan(metrics.value.todayPayAmount) },
  { key: "order", label: "今日订单数", value: formatCount(metrics.value.todayOrderCount) },
  { key: "payUsers", label: "累计支付人数", value: formatCount(metrics.value.totalPayUserCount) },
  { key: "users", label: "累计用户", value: formatCount(metrics.value.totalUserCount) },
  { key: "totalPay", label: "累计支付金额", value: formatYuan(metrics.value.totalPayAmount) },
]);

async function loadBusinessMetrics() {
  if (loading.value) return;
  loading.value = true;
  try {
    const data = await getBusinessMetrics();
    metrics.value = data;
    refreshedAt.value = data.statsTime || "";
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "经营数据加载失败";
    toast(msg);
  } finally {
    loading.value = false;
  }
}

async function loadRecentLivesFirst() {
  if (livesLoading.value) return;
  livesLoading.value = true;
  livesPage.value = 0;
  livesTotal.value = 0;
  try {
    const data = await getRecentLives(1, RECENT_LIVES_PAGE_SIZE);
    recentLiveRows.value = data.list ?? [];
    livesPage.value = data.page ?? 1;
    livesTotal.value = Number(data.total) || 0;
    await nextTick();
    bindTableScroll();
  } catch (e) {
    recentLiveRows.value = [];
    livesPage.value = 0;
    livesTotal.value = 0;
    const msg = e instanceof ApiError ? e.message : "最近直播数据加载失败";
    toast(msg);
  } finally {
    livesLoading.value = false;
  }
}

async function loadMoreRecentLives() {
  if (livesLoading.value || livesLoadingMore.value || !hasMoreLives.value) return;
  const next = livesPage.value + 1;
  livesLoadingMore.value = true;
  try {
    const data = await getRecentLives(next, RECENT_LIVES_PAGE_SIZE);
    const chunk = data.list ?? [];
    if (chunk.length) {
      const seen = new Set(recentLiveRows.value.map((r) => r.id));
      recentLiveRows.value = [
        ...recentLiveRows.value,
        ...chunk.filter((r) => !seen.has(r.id)),
      ];
    }
    livesPage.value = data.page ?? next;
    livesTotal.value = Number(data.total) || livesTotal.value;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "加载更多失败";
    toast(msg);
  } finally {
    livesLoadingMore.value = false;
  }
}

function onTableScroll() {
  if (!tableScrollEl) return;
  if (livesLoading.value || livesLoadingMore.value || !hasMoreLives.value) return;
  const { scrollTop, scrollHeight, clientHeight } = tableScrollEl;
  if (scrollHeight - scrollTop - clientHeight <= 64) {
    void loadMoreRecentLives();
  }
}

function bindTableScroll() {
  unbindTableScroll();
  const root = tableRef.value?.$el as HTMLElement | undefined;
  if (!root) return;
  tableScrollEl =
    (root.querySelector(".el-scrollbar__wrap") as HTMLElement | null) ||
    (root.querySelector(".el-table__body-wrapper") as HTMLElement | null);
  tableScrollEl?.addEventListener("scroll", onTableScroll, { passive: true });
}

function unbindTableScroll() {
  tableScrollEl?.removeEventListener("scroll", onTableScroll);
  tableScrollEl = null;
}

const notices = ref<NotificationItem[]>([]);
const noticesLoading = ref(false);

async function loadNotices() {
  if (noticesLoading.value) return;
  noticesLoading.value = true;
  try {
    const data = await listNotifications({
      page: 1,
      pageSize: NOTIFICATION_PREVIEW_PAGE_SIZE,
    });
    notices.value = data.list ?? [];
  } catch (e) {
    notices.value = [];
    const msg = e instanceof ApiError ? e.message : "通知加载失败";
    toast(msg);
  } finally {
    noticesLoading.value = false;
  }
}

async function onNoticeClick(item: NotificationItem) {
  if (item.unread) {
    try {
      await readNotification(item.id);
      item.unread = false;
    } catch {
      /* 已读失败不挡跳转 */
    }
  }
  void router.push({ name: "notification-center" });
}

onMounted(() => {
  loadBusinessMetrics();
  void loadRecentLivesFirst();
  void loadNotices();
});

onBeforeUnmount(() => {
  unbindTableScroll();
});
</script>

<template>
  <div class="dash">
    <div class="dash-main">
      <!-- 经营数据 -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">经营数据</h2>
          <button
            type="button"
            class="refresh-btn"
            :disabled="loading"
            title="刷新"
            @click="loadBusinessMetrics"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7"
              />
            </svg>
          </button>
          <span class="refresh-time">{{ refreshedAt }}</span>
        </div>

        <div class="metrics">
          <div
            v-for="item in bizMetrics"
            :key="item.key"
            class="metric"
          >
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value">{{ item.value }}</div>
          </div>
        </div>
      </section>

      <!-- 最近直播数据：普通表格，最左序号，名称列不缩进 -->
      <section class="card card-table">
        <div class="card-head">
          <h2 class="card-title">最近直播数据</h2>
        </div>

        <div
          v-loading="livesLoading"
          class="table-scroll"
        >
          <ElTable
            ref="tableRef"
            :data="recentLiveRows"
            row-key="id"
            height="100%"
            class="live-table"
            :header-cell-style="{
              background: '#F8FAFC',
              color: 'var(--text-3)',
              fontWeight: '400',
              fontSize: '13px',
            }"
            :cell-style="{ fontSize: '13px', color: 'var(--text-2)' }"
          >
            <ElTableColumn
              type="index"
              label="序号"
              width="64"
              align="center"
            />
            <ElTableColumn
              label="直播名称"
              min-width="220"
            >
              <template #default="{ row }">
                <div class="live-name">
                  <div class="cover">
                    <img
                      v-if="row.coverUrl"
                      :src="row.coverUrl"
                      alt=""
                    >
                    <span
                      v-else
                      class="cover-ph"
                    >无封面</span>
                  </div>
                  <span
                    class="live-title"
                    :title="row.title"
                  >{{ row.title }}</span>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="直播开始时间"
              min-width="168"
            >
              <template #default="{ row }">
                {{ displayTime(row.startTime) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="直播状态"
              min-width="100"
            >
              <template #default="{ row }">
                <span
                  class="status-dot"
                  :class="`is-${stateTone(row.state)}`"
                >
                  <i class="dot" />
                  {{ LIVE_STATE_LABEL[row.state] ?? row.state }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="直播结束时间"
              min-width="168"
            >
              <template #default="{ row }">
                {{ displayTime(row.endTime) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="直播间浏览量"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.roomViewCount) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="直播间访问人数"
              min-width="130"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.roomVisitorCount) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="累计观看人次"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.watchViewCount) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="累计观看人数"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.watchViewerCount) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="人均观看时长"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                {{ formatDurationSec(row.avgWatchDurationSec) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="最高在线人数"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.maxOnlinePeak) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="当日新增用户数"
              min-width="130"
              align="right"
            >
              <template #default="{ row }">
                {{ formatCount(row.newUserCount) }}
              </template>
            </ElTableColumn>
            <template #empty>
              <span class="table-empty">{{ livesLoading ? "加载中…" : "暂无最近直播" }}</span>
            </template>
            <template
              v-if="livesFooterText"
              #append
            >
              <div class="lives-footer">
                {{ livesFooterText }}
              </div>
            </template>
          </ElTable>
        </div>
      </section>
    </div>

    <!-- 通知中心 -->
    <aside class="card notice-panel">
      <button
        type="button"
        class="notice-head"
        @click="router.push({ name: 'notification-center' })"
      >
        <span>通知中心</span>
        <svg
          class="notice-chevron"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      <ul class="notice-list hover-scrollbar">
        <li
          v-for="item in notices"
          :key="item.id"
          class="notice-item"
          @click="onNoticeClick(item)"
        >
          <div class="notice-title-row">
            <p class="notice-title">
              <span class="notice-cat">[{{ item.category }}]</span>
              {{ item.title }}
            </p>
            <span
              v-if="item.unread"
              class="notice-dot"
              aria-label="未读"
            />
          </div>
          <p class="notice-body">{{ item.body }}</p>
        </li>
        <li
          v-if="!noticesLoading && notices.length === 0"
          class="notice-item notice-empty"
        >
          <p class="notice-body">暂无通知</p>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dash-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.card {
  box-sizing: border-box;
  border-radius: 12px;
  background: var(--white);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.refresh-btn {
  display: inline-flex;
  border: 0;
  background: transparent;
  padding: 2px;
  color: var(--text-4);
  outline: none;
  cursor: pointer;
}

.refresh-btn:hover {
  color: var(--primary);
}

.refresh-time {
  font-size: 12px;
  color: var(--text-4);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px 24px;
  padding: 20px 20px 24px;
}

.metric-label {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-3);
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.card-table {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 12px;
}

/* 外层不滚，只让 ElTable 内部出一条滚动条 */
.table-scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
  margin-top: 12px;
  padding: 0 12px 0;
  overflow: hidden;
}

.live-table {
  width: 100%;
  height: 100%;
}

.lives-footer {
  padding: 8px 0 4px;
  text-align: center;
  font-size: 12px;
  color: var(--text-4);
}

.live-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cover {
  display: flex;
  flex: none;
  width: 64px;
  height: 36px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--line-soft);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-ph {
  font-size: 11px;
  color: var(--text-4);
}

.live-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: var(--text);
}

.table-empty {
  font-size: 13px;
  color: var(--text-4);
}

.notice-panel {
  display: flex;
  width: 300px;
  flex: none;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.notice-head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 16px 20px 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  outline: none;
  cursor: pointer;
}

.notice-head:hover {
  color: var(--primary);
}

.notice-chevron {
  width: 14px;
  height: 14px;
  color: var(--text-4);
}

.notice-list {
  margin: 0;
  padding: 4px 12px 16px;
  list-style: none;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.notice-item {
  box-sizing: border-box;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--bg);
  padding: 12px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.notice-item:last-child {
  margin-bottom: 0;
}

.notice-item:hover {
  background: var(--primary-soft);
}

.notice-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.notice-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text);
}

.notice-cat {
  color: var(--text-3);
  font-weight: 500;
}

.notice-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--danger);
}

.notice-body {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-3);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .dash {
    flex-direction: column;
  }

  .notice-panel {
    width: 100%;
    max-height: 360px;
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
