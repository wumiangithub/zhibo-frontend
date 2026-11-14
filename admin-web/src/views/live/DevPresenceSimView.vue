<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ElAvatar,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
} from "element-plus";
import {
  listActivities,
  listEmployees,
  LIVE_STATE_LABEL,
  type ActivityListItem,
  type EmployeeItem,
} from "@/api/activity";
import { simulateDevPresence } from "@/api/devPresence";
import { listViewers, type ViewerListItem } from "@/api/viewer";
import { listAttendees } from "@/views/live-console/room/api/console";

type PresenceTab = "viewer" | "employee";

interface PresenceRow {
  /** 写入进出表的用户键：观众 username / 员工 e{id} */
  presenceKey: string;
  displayName: string;
  subLabel: string;
  avatarUrl?: string;
}

const activeTab = ref<PresenceTab>("viewer");
const stateFilter = ref<number | "all">(1);
const activityId = ref<string>("");
const activityOptions = ref<ActivityListItem[]>([]);
const activitiesLoading = ref(false);

const loading = ref(false);
const viewerRows = ref<ViewerListItem[]>([]);
const viewerTotal = ref(0);
const employeeAll = ref<EmployeeItem[]>([]);
const page = ref(1);
const pageSize = ref(20);

/** 本场当前在线（含观众 + 员工 e*） */
const onlineSet = ref<Set<string>>(new Set());
const onlineLoading = ref(false);
const busyKeys = ref<Set<string>>(new Set());
const batchBusy = ref(false);

const selectedActivity = computed(() =>
  activityOptions.value.find((a) => a.id === activityId.value),
);

const pageRows = computed<PresenceRow[]>(() => {
  if (activeTab.value === "viewer") {
    return viewerRows.value.map((r) => ({
      presenceKey: r.username,
      displayName: r.nickname || "—",
      subLabel: r.username,
      avatarUrl: r.avatarUrl,
    }));
  }
  const start = (page.value - 1) * pageSize.value;
  return employeeAll.value.slice(start, start + pageSize.value).map((e) => ({
    presenceKey: `e${e.id}`,
    displayName: e.userName || "—",
    subLabel: e.departmentName ? `e${e.id} · ${e.departmentName}` : `e${e.id}`,
    avatarUrl: e.avatar,
  }));
});

const pageTotal = computed(() =>
  activeTab.value === "viewer" ? viewerTotal.value : employeeAll.value.length,
);

const onlineCountForTab = computed(() => {
  let n = 0;
  for (const key of onlineSet.value) {
    const isStaff = /^e[1-9]\d{0,18}$/i.test(key);
    if (activeTab.value === "employee" ? isStaff : !isStaff) n += 1;
  }
  return n;
});

async function loadActivities() {
  activitiesLoading.value = true;
  try {
    const params: { page: number; pageSize: number; state?: number } = {
      page: 1,
      pageSize: 100,
    };
    if (stateFilter.value !== "all") {
      params.state = stateFilter.value;
    }
    const data = await listActivities(params);
    activityOptions.value = data.list ?? [];
    if (
      activityId.value &&
      !activityOptions.value.some((a) => a.id === activityId.value)
    ) {
      activityId.value = "";
    }
    if (!activityId.value && activityOptions.value.length) {
      activityId.value = activityOptions.value[0]!.id;
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载直播间失败");
    activityOptions.value = [];
    activityId.value = "";
  } finally {
    activitiesLoading.value = false;
  }
}

async function loadOnlineKind(kind: "student" | "assistant", into: Set<string>) {
  let p = 1;
  const ps = 100;
  for (;;) {
    const res = await listAttendees(activityId.value, {
      tab: "online",
      page: p,
      pageSize: ps,
      kind,
    });
    for (const row of res.list ?? []) {
      if (row.username && row.online) into.add(row.username);
    }
    const got = (res.list ?? []).length;
    if (got < ps || p >= 20) break;
    p += 1;
  }
}

async function loadOnlineSet() {
  if (!activityId.value) {
    onlineSet.value = new Set();
    return;
  }
  onlineLoading.value = true;
  try {
    const next = new Set<string>();
    await loadOnlineKind("student", next);
    await loadOnlineKind("assistant", next);
    onlineSet.value = next;
  } catch {
    onlineSet.value = new Set();
  } finally {
    onlineLoading.value = false;
  }
}

async function fetchViewers() {
  loading.value = true;
  try {
    const res = await listViewers({
      page: page.value,
      pageSize: pageSize.value,
    });
    viewerRows.value = res.list ?? [];
    viewerTotal.value = Number(res.total) || 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载用户失败");
    viewerRows.value = [];
    viewerTotal.value = 0;
  } finally {
    loading.value = false;
  }
}

async function fetchEmployees() {
  loading.value = true;
  try {
    const res = await listEmployees();
    employeeAll.value = res.list ?? [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
    employeeAll.value = [];
  } finally {
    loading.value = false;
  }
}

async function fetchCurrentTab() {
  if (activeTab.value === "viewer") await fetchViewers();
  else await fetchEmployees();
}

function isOnline(key: string) {
  return onlineSet.value.has(key);
}

function markBusy(keys: string[], on: boolean) {
  const next = new Set(busyKeys.value);
  for (const u of keys) {
    if (on) next.add(u);
    else next.delete(u);
  }
  busyKeys.value = next;
}

async function toggleOne(row: PresenceRow, type: "Join" | "Leave") {
  if (!activityId.value) {
    ElMessage.warning("请先选择直播间");
    return;
  }
  const key = row.presenceKey?.trim();
  if (!key) return;
  markBusy([key], true);
  try {
    const res = await simulateDevPresence(activityId.value, {
      type,
      usernames: [key],
    });
    const item = res.items?.[0];
    if (!item?.ok) {
      ElMessage.error(item?.error || "操作失败");
      return;
    }
    const next = new Set(onlineSet.value);
    if (type === "Join") next.add(key);
    else next.delete(key);
    onlineSet.value = next;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    markBusy([key], false);
  }
}

async function batchToggle(type: "Join" | "Leave") {
  if (!activityId.value) {
    ElMessage.warning("请先选择直播间");
    return;
  }
  const label = activeTab.value === "viewer" ? "用户" : "员工";
  const targets = pageRows.value
    .map((r) => r.presenceKey?.trim())
    .filter((u): u is string => Boolean(u))
    .filter((u) => (type === "Join" ? !isOnline(u) : isOnline(u)));
  if (!targets.length) {
    ElMessage.info(type === "Join" ? `本页没有可上线的${label}` : `本页没有可下线的${label}`);
    return;
  }
  batchBusy.value = true;
  markBusy(targets, true);
  try {
    const res = await simulateDevPresence(activityId.value, {
      type,
      usernames: targets,
    });
    const next = new Set(onlineSet.value);
    for (const item of res.items ?? []) {
      if (!item.ok || !item.username) continue;
      if (type === "Join") next.add(item.username);
      else next.delete(item.username);
    }
    onlineSet.value = next;
    if (res.failed > 0) {
      ElMessage.warning(`成功 ${res.ok}，失败 ${res.failed}`);
    } else {
      ElMessage.success(type === "Join" ? `已上线 ${res.ok} 人` : `已下线 ${res.ok} 人`);
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批量操作失败");
  } finally {
    markBusy(targets, false);
    batchBusy.value = false;
  }
}

function activityLabel(row: ActivityListItem) {
  const state = LIVE_STATE_LABEL[row.state] ?? String(row.state);
  return `${row.title}（${state}）`;
}

watch(stateFilter, () => {
  void loadActivities();
});

watch(activityId, () => {
  void loadOnlineSet();
});

watch(activeTab, () => {
  page.value = 1;
  void fetchCurrentTab();
});

watch([page, pageSize], () => {
  if (activeTab.value === "viewer") void fetchViewers();
  /* 员工端分页是本地切片，不必重拉 */
});

onMounted(async () => {
  await loadActivities();
  await Promise.all([fetchCurrentTab(), loadOnlineSet()]);
});
</script>

<template>
  <div class="admin-page hover-scrollbar">
    <div class="page-head">
      <h1 class="page-title">
        模拟上下线
      </h1>
      <p class="page-desc">
        本地联调灌数：给选定直播间模拟观众 / 员工上线下线，写入进出名单与流水。员工写入键为 e +
        员工账号 id。仅 spring profile=local 可用。
      </p>
    </div>

    <div class="admin-filter-bar">
      <div class="admin-filter-item">
        <span class="admin-filter-label">直播状态</span>
        <ElSelect
          v-model="stateFilter"
          style="width: 120px"
        >
          <ElOption
            label="全部状态"
            value="all"
          />
          <ElOption
            v-for="(label, key) in LIVE_STATE_LABEL"
            :key="key"
            :label="label"
            :value="Number(key)"
          />
        </ElSelect>
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">直播间</span>
        <ElSelect
          v-model="activityId"
          filterable
          clearable
          placeholder="请选择直播间"
          :loading="activitiesLoading"
          style="width: 360px"
        >
          <ElOption
            v-for="item in activityOptions"
            :key="item.id"
            :label="activityLabel(item)"
            :value="item.id"
          />
        </ElSelect>
      </div>
      <div
        v-if="selectedActivity"
        class="admin-filter-item meta"
      >
        本 Tab 在线约 {{ onlineCountForTab }} 人
        <span
          v-if="onlineLoading"
          class="muted"
        >（刷新中）</span>
      </div>
    </div>

    <ElTabs
      v-model="activeTab"
      class="presence-tabs"
    >
      <ElTabPane
        label="用户"
        name="viewer"
      />
      <ElTabPane
        label="员工"
        name="employee"
      />
    </ElTabs>

    <div class="admin-toolbar">
      <button
        type="button"
        class="admin-btn admin-btn--primary"
        :disabled="!activityId || batchBusy || loading"
        @click="batchToggle('Join')"
      >
        本页全部上线
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--ghost"
        :disabled="!activityId || batchBusy || loading"
        @click="batchToggle('Leave')"
      >
        本页全部下线
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--ghost"
        :disabled="!activityId || onlineLoading"
        @click="loadOnlineSet"
      >
        刷新在线态
      </button>
    </div>

    <ElTable
      v-loading="loading"
      :data="pageRows"
      row-key="presenceKey"
      class="user-table"
    >
      <ElTableColumn
        :label="activeTab === 'viewer' ? '用户' : '员工'"
        min-width="280"
      >
        <template #default="{ row }">
          <div class="user-cell">
            <ElAvatar
              :size="40"
              :src="row.avatarUrl || undefined"
            >
              {{ (row.displayName || row.presenceKey || "?").slice(0, 1) }}
            </ElAvatar>
            <div class="user-meta">
              <div class="nickname">
                {{ row.displayName }}
              </div>
              <div class="username">
                {{ row.subLabel }}
              </div>
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="本场状态"
        width="120"
      >
        <template #default="{ row }">
          <span :class="isOnline(row.presenceKey) ? 'status-on' : 'status-off'">
            {{ isOnline(row.presenceKey) ? "在线" : "离线" }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="操作"
        width="140"
        fixed="right"
      >
        <template #default="{ row }">
          <button
            v-if="!isOnline(row.presenceKey)"
            type="button"
            class="admin-btn admin-btn--primary admin-btn--sm"
            :disabled="!activityId || busyKeys.has(row.presenceKey) || batchBusy"
            @click="toggleOne(row, 'Join')"
          >
            上线
          </button>
          <button
            v-else
            type="button"
            class="admin-btn admin-btn--ghost admin-btn--sm"
            :disabled="!activityId || busyKeys.has(row.presenceKey) || batchBusy"
            @click="toggleOne(row, 'Leave')"
          >
            下线
          </button>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="pageTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  padding: 20px 24px 40px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.page-head {
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.page-desc {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #8c8c8c;
  max-width: 720px;
}

.admin-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  margin-bottom: 12px;
}

.admin-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-filter-label {
  font-size: 13px;
  color: #595959;
  white-space: nowrap;
}

.admin-filter-item.meta {
  font-size: 13px;
  color: #595959;
}

.muted {
  color: #bfbfbf;
}

.presence-tabs {
  margin-bottom: 4px;
}

.presence-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.user-table {
  width: 100%;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-meta {
  min-width: 0;
}

.nickname {
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.3;
}

.username {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.status-on {
  color: #52c41a;
  font-size: 13px;
}

.status-off {
  color: #8c8c8c;
  font-size: 13px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.admin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 13px;
  cursor: pointer;
  background: #fff;
}

.admin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-btn--primary {
  background: #1677ff;
  border-color: #1677ff;
  color: #fff;
}

.admin-btn--ghost {
  border-color: #d9d9d9;
  color: #1a1a1a;
}

.admin-btn--sm {
  height: 28px;
  padding: 0 12px;
}
</style>
