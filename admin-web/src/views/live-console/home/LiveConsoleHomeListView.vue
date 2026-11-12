<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElDatePicker,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import {
  ActivityReady,
  activityReadyLabel,
  listActivities,
  LIVE_STATE_LABEL,
  LIVE_TYPE_LABEL,
  RISK_STATUS_LABEL,
  SELL_TYPE_LABEL,
  SHELF_STATUS_LABEL,
  type ActivityListItem,
  type ActivitySortKey,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/activity";
import { buildConsoleUrl } from "@/utils/liveLinks";

const loading = ref(false);
const error = ref("");
const list = ref<ActivityListItem[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const filters = reactive({
  keyword: "",
  shelfStatus: "all" as "all" | ShelfStatus,
  state: "all" as "all" | number,
  startRange: null as [string, string] | null,
});

const query = reactive({
  page: 1,
  pageSize: 10,
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

function ownersText(item: ActivityListItem) {
  const names = (item.owners ?? []).map((o) => o.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function firstOwner(item: ActivityListItem) {
  const names = (item.owners ?? []).map((o) => o.userName).filter(Boolean);
  return names[0] ?? "--";
}

function sellLabel(item: ActivityListItem) {
  return item.sellType ? SELL_TYPE_LABEL[item.sellType] : "";
}

function validityLabelOf(item: ActivityListItem) {
  return item.validityLabel?.trim() || "长期有效";
}

function productsText(item: ActivityListItem) {
  const names = (item.products ?? []).map((p) => p.productName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function riskOf(item: ActivityListItem): RiskStatus {
  return item.riskStatus ?? "pending";
}

function riskClass(status?: RiskStatus) {
  if (status === "passed") return "risk--passed";
  if (status === "rejected") return "risk--rejected";
  return "risk--pending";
}

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

function goConsole(id: string) {
  window.open(buildConsoleUrl(id), "_blank", "noopener");
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

function asRow(row: unknown): ActivityListItem {
  return row as ActivityListItem;
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-panel admin-panel--row-72 console-home-list">
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
          min-width="280"
        >
          <template #default="{ row }">
            <div class="name-cell">
              <div class="cover">
                <img
                  v-if="asRow(row).coverUrl"
                  :src="asRow(row).coverUrl"
                  :alt="asRow(row).title"
                >
                <span
                  v-else
                  class="cover-ph"
                >无封面</span>
              </div>
              <div class="name-meta">
                <p class="title">{{ asRow(row).title }}</p>
                <div class="meta-tags">
                  <span
                    v-if="sellLabel(asRow(row))"
                    class="meta-tag"
                    :class="asRow(row).sellType === 'free' ? 'is-free' : 'is-sell'"
                  >{{ sellLabel(asRow(row)) }}</span>
                  <span class="meta-tag is-validity">{{ validityLabelOf(asRow(row)) }}</span>
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
            {{ LIVE_TYPE_LABEL[asRow(row).type] ?? asRow(row).type }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="上架状态"
          width="128"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${shelfTone(shelfOf(asRow(row)))}`"
            >
              <i class="dot" />
              {{ SHELF_STATUS_LABEL[shelfOf(asRow(row))] }}
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
            {{ formatStartTime(asRow(row).startTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="归属人"
          width="96"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="(asRow(row).owners?.length ?? 0) > 1"
              :content="ownersText(asRow(row))"
              placement="top"
            >
              <span class="ellipsis">{{ firstOwner(asRow(row)) }}</span>
            </ElTooltip>
            <span
              v-else
              class="ellipsis"
            >{{ firstOwner(asRow(row)) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="直播状态"
          width="108"
        >
          <template #default="{ row }">
            <span
              class="status-dot"
              :class="`is-${stateTone(asRow(row).state)}`"
            >
              <i class="dot" />
              {{ LIVE_STATE_LABEL[asRow(row).state] ?? asRow(row).state }}
            </span>
            <span
              v-if="asRow(row).type === 4 && asRow(row).ready !== ActivityReady.OK"
              class="ready-tag"
              :class="asRow(row).ready === ActivityReady.FAIL ? 'is-fail' : 'is-pending'"
            >
              {{ activityReadyLabel(asRow(row).ready) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="关联商品"
          min-width="140"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="productsText(asRow(row)) !== '--'"
              :content="productsText(asRow(row))"
              placement="top"
            >
              <span class="product-ellipsis">{{ productsText(asRow(row)) }}</span>
            </ElTooltip>
            <span v-else>--</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="风控合规审核"
          width="132"
        >
          <template #default="{ row }">
            <span
              class="risk-tag"
              :class="riskClass(riskOf(asRow(row)))"
            >
              {{ RISK_STATUS_LABEL[riskOf(asRow(row))] }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="120"
          fixed="right"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="admin-op"
              @click="goConsole(asRow(row).id)"
            >
              直播中控台
            </button>
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
  background: #f1f5f9;
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
.product-ellipsis {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.risk-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
.risk--passed {
  color: var(--success, #16a34a);
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.risk--rejected {
  color: var(--danger);
  background: #fff1f0;
  border-color: #fecaca;
}
.risk--pending {
  color: var(--text-3);
  background: #f8fafc;
  border-color: #e2e8f0;
}
</style>
