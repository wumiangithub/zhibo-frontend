<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ElDatePicker,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import {
  deleteActivity,
  listActivities,
  ActivityReady,
  activityReadyLabel,
  LIVE_STATE_LABEL,
  LIVE_TYPE_LABEL,
  SELL_TYPE_LABEL,
  setActivityShelf,
  SHELF_STATUS_LABEL,
  type ActivityListItem,
  type ActivitySortKey,
  type ShelfStatus,
} from "@/api/activity";
import ImagePreview from "@/components/ImagePreview.vue";
import type { ImagePreviewItem } from "@/components/ImagePreview.vue";
import ShareDialog from "@/components/share/ShareDialog.vue";
import { buildAudienceWatchUrl, buildLiveStudioPath } from "@/utils/liveLinks";
import { ActivityMemberRole } from "@/views/live/detail/role/roleTypes";
import AuditRecordsDrawer from "./components/AuditRecordsDrawer.vue";
import { exportLiveRows } from "./exportLiveRows";

const router = useRouter();

const loading = ref(false);
const error = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const shareVisible = ref(false);
const shareTitle = ref("");
const shareWatchUrl = ref("");

const auditDrawerVisible = ref(false);
const auditDrawerTitle = ref("");
const auditDrawerId = ref("");

/** 列表封面点击放大（共用 ImagePreview，对齐素材中心） */
const coverPreviewVisible = ref(false);
const coverPreviewItems = ref<ImagePreviewItem[]>([]);

const filters = reactive({
  keyword: "",
  shelfStatus: "all" as "all" | ShelfStatus,
  state: "all" as "all" | number,
  startRange: null as [string, string] | null,
});

const query = reactive({
  page: 1,
  pageSize: 10,
  /** 空 = 后端默认 createdTime desc；点列头后为 startTime */
  sort: "" as "" | ActivitySortKey,
  order: "desc" as "asc" | "desc",
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

const startFrom = computed({
  get: () => filters.startRange?.[0] || undefined,
  set: (v: string | undefined) => setStartRange(v || "", filters.startRange?.[1] || ""),
});

const startTo = computed({
  get: () => filters.startRange?.[1] || undefined,
  set: (v: string | undefined) => setStartRange(filters.startRange?.[0] || "", v || ""),
});

function setStartRange(from: string, to: string) {
  filters.startRange = from || to ? [from, to] : null;
}

function openCoverPreview(url?: string | null, title?: string) {
  if (!url) return;
  coverPreviewItems.value = [{ url, name: title || "封面" }];
  coverPreviewVisible.value = true;
}

function ownersText(item: ActivityListItem) {
  const names = (item.owners ?? []).map((o) => o.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function sellLabel(item: ActivityListItem) {
  return item.sellType ? SELL_TYPE_LABEL[item.sellType] : "";
}

function validityLabelOf(item: ActivityListItem) {
  return item.validityLabel?.trim() || "长期有效";
}

/** 缺字段时按契约新建默认：待上架 / 待审核（历史迁移应为 on/passed，由后端回填） */
function shelfOf(item: ActivityListItem): ShelfStatus {
  return item.shelfStatus ?? "pending";
}

function shelfTone(status?: ShelfStatus) {
  if (status === "on") return "success";
  if (status === "banned") return "danger";
  if (status === "pending") return "pending";
  return "ended";
}

function stateTone(state: number) {
  if (state === 1) return "success";
  if (state === 2) return "preview";
  if (state === 5) return "replay";
  if (state === 3) return "ended";
  if (state === 4) return "replay";
  return "muted";
}

function formatStartTime(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

async function fetchList() {
  const keepRows = list.value.length > 0;
  loading.value = true;
  error.value = "";
  selectedIds.value = [];
  try {
    const params: Record<string, unknown> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim();
    if (filters.shelfStatus && filters.shelfStatus !== "all") params.shelfStatus = filters.shelfStatus;
    if (filters.state !== "all" && filters.state !== 0) params.state = filters.state;
    if (filters.startRange?.[0]) params.startFrom = filters.startRange[0];
    if (filters.startRange?.[1]) params.startTo = filters.startRange[1];
    if (query.sort) {
      params.sort = query.sort;
      params.order = query.order;
    }
    const data = await listActivities(params);
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    if (!keepRows) {
      list.value = [];
      total.value = 0;
    }
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void fetchList();
}

function resetFilter() {
  filters.keyword = "";
  filters.shelfStatus = "all";
  filters.state = "all";
  filters.startRange = null;
  query.page = 1;
  query.sort = "";
  query.order = "desc";
  void fetchList();
}

function onSortChange(payload: { prop: string | null; order: string | null }) {
  if (payload.prop === "startTime" && payload.order) {
    query.sort = "startTime";
    query.order = payload.order === "ascending" ? "asc" : "desc";
  } else {
    query.sort = "";
    query.order = "desc";
  }
  query.page = 1;
  void fetchList();
}

function onSelectionChange(rows: ActivityListItem[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function goCreate() {
  void router.push("/live/create");
}

function onExport() {
  if (!selectedIds.value.length) {
    ElMessage.warning("请先勾选要导出的直播");
    return;
  }
  const rows = list.value.filter((i) => selectedIds.value.includes(i.id));
  exportLiveRows(rows);
}

function goLive(item: ActivityListItem) {
  if (!item.canBroadcast) return;
  void router.push(buildLiveStudioPath(item.id, ActivityMemberRole.HOST));
}

function openShare(item: ActivityListItem) {
  shareTitle.value = item.title;
  shareWatchUrl.value = buildAudienceWatchUrl(item.id);
  shareVisible.value = true;
}

async function onShelf(item: ActivityListItem, listed: boolean) {
  const action = listed ? "上架" : "下架";
  try {
    await ElMessageBox.confirm(`确定要${action}「${item.title}」吗？`, action, {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await setActivityShelf(item.id, listed);
    ElMessage.success(`${action}成功`);
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : `${action}失败`);
  }
}

async function onDelete(item: ActivityListItem) {
  try {
    await ElMessageBox.confirm("删除后不可恢复", "删除直播", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteActivity(item.id);
    ElMessage.success("已删除");
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onMoreCommand(cmd: string, item: ActivityListItem) {
  if (cmd === "share") openShare(item);
  else if (cmd === "audit") void router.push(`/live/${item.id}/audit`);
  else if (cmd === "on") void onShelf(item, true);
  else if (cmd === "off") void onShelf(item, false);
  else if (cmd === "delete") void onDelete(item);
}

function onPageChange(p: number) {
  query.page = p;
  void fetchList();
}

function onPageSizeChange(size: number) {
  query.pageSize = size;
  query.page = 1;
  void fetchList();
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-panel admin-panel--row-72 live-manage">
    <div class="admin-filter-bar">
      <div class="admin-filter-fields">
      <div class="admin-filter-item">
        <span class="admin-filter-label">直播名称</span>
        <ElInput
          v-model="filters.keyword"
          clearable
          placeholder="请输入直播名称"
          style="width: 168px"
          @keyup.enter="search"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">上架状态</span>
        <ElSelect
          v-model="filters.shelfStatus"
          placeholder="全部状态"
          style="width: 120px"
        >
          <ElOption
            label="全部状态"
            value="all"
          />
          <ElOption
            v-for="(label, key) in SHELF_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">直播状态</span>
        <ElSelect
          v-model="filters.state"
          placeholder="全部状态"
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
        <span class="admin-filter-label">直播开始时间</span>
        <ElDatePicker
          v-model="startFrom"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="开始日期"
          style="width: 132px"
        />
        <span class="range-sep">至</span>
        <ElDatePicker
          v-model="startTo"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="结束日期"
          style="width: 132px"
        />
      </div>
      </div>
      <div class="admin-filter-actions">
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          @click="search"
        >
          查询
        </button>
        <button
          type="button"
          class="admin-btn admin-btn--ghost"
          @click="resetFilter"
        >
          重置
        </button>
      </div>
    </div>

    <div class="admin-toolbar">
      <button
        type="button"
        class="admin-btn admin-btn--primary"
        @click="goCreate"
      >
        + 新建直播
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--ghost"
        @click="onExport"
      >
        导出
      </button>
    </div>

    <p
      v-if="error"
      class="admin-err"
    >
      {{ error }}
    </p>

    <div class="admin-table-wrap">
      <ElTable
        v-loading="loading"
        :data="list"
        row-key="id"
        height="100%"
        empty-text="暂无直播"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          type="selection"
          width="44"
        />
        <ElTableColumn
          label="直播名称"
          min-width="260"
        >
          <template #default="{ row }">
            <div class="name-cell">
              <div class="cover">
                <img
                  v-if="row.coverUrl"
                  :src="row.coverUrl"
                  :alt="row.title"
                  @click.stop="openCoverPreview(row.coverUrl, row.title)"
                >
                <span
                  v-else
                  class="cover-ph"
                >无封面</span>
              </div>
              <div class="name-meta">
                <p class="title">{{ row.title }}</p>
                <div class="meta-tags">
                  <span
                    v-if="sellLabel(row as ActivityListItem)"
                    class="meta-tag"
                    :class="(row as ActivityListItem).sellType === 'free' ? 'is-free' : 'is-sell'"
                  >{{ sellLabel(row as ActivityListItem) }}</span>
                  <span class="meta-tag is-validity">{{ validityLabelOf(row as ActivityListItem) }}</span>
                </div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="直播类型"
          width="108"
        >
          <template #default="{ row }">
            {{ LIVE_TYPE_LABEL[row.type] ?? row.type }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="上架状态"
          width="128"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${shelfTone(shelfOf(row as ActivityListItem))}`"
            >
              <i class="dot" />
              {{ SHELF_STATUS_LABEL[shelfOf(row as ActivityListItem)] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="startTime"
          label="直播开始时间"
          width="184"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatStartTime(row.startTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="归属人"
          width="88"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="ownersText(row as ActivityListItem) !== '--'"
              :content="ownersText(row as ActivityListItem)"
              placement="top"
            >
              <span class="ellipsis">{{ ownersText(row as ActivityListItem) }}</span>
            </ElTooltip>
            <span v-else>--</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="直播状态"
          width="108"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${stateTone(row.state)}`"
            >
              <i class="dot" />
              {{ LIVE_STATE_LABEL[row.state] ?? row.state }}
            </span>
            <span
              v-if="row.type === 4 && row.ready !== ActivityReady.OK"
              class="ready-tag"
              :class="row.ready === ActivityReady.FAIL ? 'is-fail' : 'is-pending'"
            >
              {{ activityReadyLabel(row.ready) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="220"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="admin-ops">
              <button
                type="button"
                class="admin-op"
                :disabled="!row.canBroadcast"
                @click="goLive(row as ActivityListItem)"
              >
                开播
              </button>
              <RouterLink
                :to="`/live/${row.id}`"
                class="admin-op"
              >
                编辑
              </RouterLink>
              <RouterLink
                :to="{ path: `/live/${row.id}`, query: { tab: 'data' } }"
                class="admin-op"
              >
                数据
              </RouterLink>
              <button
                type="button"
                class="admin-op"
                @click="openShare(row as ActivityListItem)"
              >
                分享
              </button>
              <!-- D109：去审核 / 审核记录入口暂隐藏，接口与路由保留 -->
              <ElDropdown
                trigger="click"
                @command="(cmd: string) => onMoreCommand(cmd, row as ActivityListItem)"
              >
                <button
                  type="button"
                  class="admin-op-more"
                  aria-label="更多"
                >
                  
                </button>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem
                      v-if="shelfOf(row as ActivityListItem) === 'pending' || shelfOf(row as ActivityListItem) === 'off'"
                      command="on"
                    >
                      上架
                    </ElDropdownItem>
                    <ElDropdownItem
                      v-if="shelfOf(row as ActivityListItem) === 'on'"
                      command="off"
                    >
                      下架
                    </ElDropdownItem>
                    <ElDropdownItem
                      command="delete"
                      divided
                    >
                      删除
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="admin-pager">
      <span class="admin-pager__total">共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页</span>
      <ElPagination
        :current-page="query.page"
        :page-size="query.pageSize"
        layout="sizes, prev, pager, next, jumper"
        :total="total"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <ShareDialog
      v-model="shareVisible"
      :title="shareTitle"
      :watch-url="shareWatchUrl"
    />

    <AuditRecordsDrawer
      v-model="auditDrawerVisible"
      :title="auditDrawerTitle"
      :activity-id="auditDrawerId"
    />

    <ImagePreview
      v-model="coverPreviewVisible"
      :items="coverPreviewItems"
    />
  </div>
</template>

<style scoped>
.range-sep {
  color: var(--text-3);
  white-space: nowrap;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.cover {
  width: 72px;
  height: 48px;
  flex: none;
  overflow: hidden;
  border-radius: 6px;
  background: #f0f0f0;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.cover-ph {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-4);
}
.name-meta {
  min-width: 0;
}
.title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.meta-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
}
.meta-tag.is-free {
  background: var(--gold-soft);
  color: var(--gold-deep);
}
.meta-tag.is-validity,
.meta-tag.is-sell {
  background: #F1F5F9;
  color: var(--text-3);
}
.ellipsis {
  display: inline-block;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.ready-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  vertical-align: middle;
}
.ready-tag.is-pending {
  color: var(--gold-deep);
  background: var(--gold-soft);
}
.ready-tag.is-fail {
  color: var(--danger);
  background: #fff1f0;
}
</style>
