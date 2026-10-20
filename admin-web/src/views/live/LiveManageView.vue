<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ElButton,
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
  ElTooltip,
} from "element-plus";
import {
  deleteActivity,
  getHostUrl,
  listActivities,
  LIVE_STATE_LABEL,
  LIVE_TYPE_LABEL,
  RISK_STATUS_LABEL,
  sellTagText,
  setActivityShelf,
  SHELF_STATUS_LABEL,
  type ActivityListItem,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/activity";
import ShareDialog from "@/components/share/ShareDialog.vue";
import { buildAudienceWatchUrl } from "@/utils/liveLinks";
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

const filters = reactive({
  keyword: "",
  shelfStatus: "" as "" | ShelfStatus,
  state: "" as "" | number,
  startRange: null as [string, string] | null,
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

const selectPage = computed({
  get: () => list.value.length > 0 && selectedIds.value.length === list.value.length,
  set: (v: boolean) => {
    selectedIds.value = v ? list.value.map((i) => i.id) : [];
  },
});

function ownersText(item: ActivityListItem) {
  const names = (item.owners ?? []).map((o) => o.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function productsText(item: ActivityListItem) {
  const names = (item.products ?? []).map((p) => p.productName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

/** 缺字段时按契约新建默认：待上架 / 待审核（历史迁移应为 on/passed，由后端回填） */
function shelfOf(item: ActivityListItem): ShelfStatus {
  return item.shelfStatus ?? "pending";
}

function riskOf(item: ActivityListItem): RiskStatus {
  return item.riskStatus ?? "pending";
}

function shelfDotClass(status?: ShelfStatus) {
  if (status === "on") return "dot--green";
  if (status === "banned") return "dot--red";
  return "dot--grey";
}

function stateDotClass(state: number) {
  return state === 1 ? "dot--green" : "dot--grey";
}

function riskClass(status?: RiskStatus) {
  if (status === "passed") return "risk--passed";
  if (status === "rejected") return "risk--rejected";
  return "risk--pending";
}

function formatStartTime(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

async function fetchList() {
  loading.value = true;
  error.value = "";
  selectedIds.value = [];
  try {
    const params: Record<string, unknown> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim();
    if (filters.shelfStatus) params.shelfStatus = filters.shelfStatus;
    if (filters.state !== "" && filters.state !== 0) params.state = filters.state;
    if (filters.startRange?.[0]) params.startFrom = filters.startRange[0];
    if (filters.startRange?.[1]) params.startTo = filters.startRange[1];
    const data = await listActivities(params);
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    list.value = [];
    total.value = 0;
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
  filters.shelfStatus = "";
  filters.state = "";
  filters.startRange = null;
  query.page = 1;
  void fetchList();
}

function toggleRow(id: string) {
  const i = selectedIds.value.indexOf(id);
  if (i >= 0) selectedIds.value.splice(i, 1);
  else selectedIds.value.push(id);
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

async function goLive(item: ActivityListItem) {
  if (!item.canBroadcast) return;
  try {
    const { hostUrl } = await getHostUrl(item.id);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取开播链接失败");
  }
}

function openShare(item: ActivityListItem) {
  shareTitle.value = item.title;
  shareWatchUrl.value = buildAudienceWatchUrl(item.id);
  shareVisible.value = true;
}

/** 审核记录侧栏：仅 UI Mock，后续接风控审核流 */
function openAuditRecords(item: ActivityListItem) {
  auditDrawerTitle.value = item.title;
  auditDrawerId.value = item.id;
  auditDrawerVisible.value = true;
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
  <div class="live-manage">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">直播名称</span>
        <ElInput
          v-model="filters.keyword"
          clearable
          placeholder="请输入直播名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">上架状态</span>
        <ElSelect
          v-model="filters.shelfStatus"
          clearable
          placeholder="全部状态"
          style="width: 140px"
        >
          <ElOption
            label="全部状态"
            value=""
          />
          <ElOption
            v-for="(label, key) in SHELF_STATUS_LABEL"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
      </div>
      <div class="filter-item">
        <span class="filter-label">直播状态</span>
        <ElSelect
          v-model="filters.state"
          clearable
          placeholder="全部状态"
          style="width: 140px"
        >
          <ElOption
            label="全部状态"
            value=""
          />
          <ElOption
            v-for="(label, key) in LIVE_STATE_LABEL"
            :key="key"
            :label="label"
            :value="Number(key)"
          />
        </ElSelect>
      </div>
      <div class="filter-item">
        <span class="filter-label">直播开始时间</span>
        <ElDatePicker
          v-model="filters.startRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          style="width: 260px"
        />
      </div>
      <ElButton @click="resetFilter">重置</ElButton>
      <ElButton
        type="primary"
        @click="search"
      >
        查询
      </ElButton>
    </div>

    <div class="toolbar">
      <ElButton
        type="primary"
        @click="goCreate"
      >
        + 新建直播
      </ElButton>
      <ElButton @click="onExport">导出</ElButton>
    </div>

    <p
      v-if="error"
      class="err-banner"
    >
      {{ error }}
    </p>

    <div class="table-wrap">
      <table class="live-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                v-model="selectPage"
                type="checkbox"
                class="row-check"
              >
            </th>
            <th>直播名称</th>
            <th>直播类型</th>
            <th>上架状态</th>
            <th>直播开始时间</th>
            <th>归属人</th>
            <th>直播状态</th>
            <th>关联商品</th>
            <th>风控合规审核</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              colspan="10"
              class="empty-cell"
            >
              加载中…
            </td>
          </tr>
          <tr v-else-if="list.length === 0">
            <td
              colspan="10"
              class="empty-cell"
            >
              暂无直播
            </td>
          </tr>
          <tr
            v-for="item in list"
            v-else
            :key="item.id"
          >
            <td>
              <input
                type="checkbox"
                class="row-check"
                :checked="selectedIds.includes(item.id)"
                @change="toggleRow(item.id)"
              >
            </td>
            <td>
              <div class="name-cell">
                <div class="cover">
                  <img
                    v-if="item.coverUrl"
                    :src="item.coverUrl"
                    :alt="item.title"
                  >
                  <span
                    v-else
                    class="cover-ph"
                  >无封面</span>
                </div>
                <div class="name-meta">
                  <p class="title">{{ item.title }}</p>
                  <p class="sell-tag">{{ sellTagText(item) }}</p>
                </div>
              </div>
            </td>
            <td>{{ LIVE_TYPE_LABEL[item.type] ?? item.type }}</td>
            <td>
              <span class="status-dot">
                <i
                  class="dot"
                  :class="shelfDotClass(shelfOf(item))"
                />
                {{ SHELF_STATUS_LABEL[shelfOf(item)] }}
              </span>
            </td>
            <td>{{ formatStartTime(item.startTime) }}</td>
            <td>
              <ElTooltip
                v-if="ownersText(item) !== '--'"
                :content="ownersText(item)"
                placement="top"
              >
                <span class="ellipsis">{{ ownersText(item) }}</span>
              </ElTooltip>
              <span v-else>--</span>
            </td>
            <td>
              <span class="status-dot">
                <i
                  class="dot"
                  :class="stateDotClass(item.state)"
                />
                {{ LIVE_STATE_LABEL[item.state] ?? item.state }}
              </span>
            </td>
            <td>
              <ElTooltip
                v-if="productsText(item) !== '--'"
                :content="productsText(item)"
                placement="top"
              >
                <span class="ellipsis">{{ productsText(item) }}</span>
              </ElTooltip>
              <span v-else>--</span>
            </td>
            <td>
              <span
                class="risk-tag"
                :class="riskClass(riskOf(item))"
              >
                {{ RISK_STATUS_LABEL[riskOf(item)] }}
              </span>
            </td>
            <td>
              <div class="ops">
                <button
                  type="button"
                  class="op-link"
                  :disabled="!item.canBroadcast"
                  @click="goLive(item)"
                >
                  开播
                </button>
                <RouterLink
                  :to="`/live/${item.id}`"
                  class="op-link"
                >
                  管理
                </RouterLink>
                <RouterLink
                  :to="{ path: `/live/${item.id}`, query: { tab: 'data' } }"
                  class="op-link"
                >
                  数据
                </RouterLink>
                <button
                  type="button"
                  class="op-link"
                  @click="openAuditRecords(item)"
                >
                  审核记录
                </button>
                <ElDropdown
                  trigger="click"
                  @command="(cmd: string) => onMoreCommand(cmd, item)"
                >
                  <button
                    type="button"
                    class="op-more"
                  >
                    ···
                  </button>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem command="share">分享</ElDropdownItem>
                      <ElDropdownItem command="audit">去审核</ElDropdownItem>
                      <ElDropdownItem
                        v-if="shelfOf(item) === 'pending' || shelfOf(item) === 'off'"
                        command="on"
                      >
                        上架
                      </ElDropdownItem>
                      <ElDropdownItem
                        v-if="shelfOf(item) === 'on'"
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
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="pager-total">共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页</span>
      <ElPagination
        :current-page="query.page"
        :page-size="query.pageSize"
        background
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
  </div>
</template>

<style scoped>
.live-manage {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 顶栏 52 + main padding 20*2，与素材中心一致，避免整页滚 */
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.filter-bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}
.err-banner {
  flex: none;
  margin: 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: #fff2f0;
  color: #cf1322;
  font-size: 13px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}
.live-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: 13px;
}
.live-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px;
  font-weight: 400;
  color: #999;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
}
.live-table td {
  padding: 12px;
  color: #666;
  border-bottom: 1px solid #f5f5f5;
  vertical-align: middle;
}
.live-table tr:hover td {
  background: #fafafa;
}
.col-check {
  width: 40px;
}
.row-check {
  accent-color: var(--color-primary);
  vertical-align: middle;
}
.empty-cell {
  padding: 64px 12px !important;
  text-align: center;
  color: #bfbfbf;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.cover {
  width: 64px;
  height: 48px;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
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
  color: #bfbfbf;
}
.name-meta {
  min-width: 0;
}
.title {
  margin: 0;
  font-weight: 500;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.sell-tag {
  margin: 2px 0 0;
  font-size: 12px;
  color: #f5222d;
}
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #bfbfbf;
}
.dot--green {
  background: #52c41a;
}
.dot--red {
  background: #f5222d;
}
.dot--grey {
  background: #bfbfbf;
}
.ellipsis {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.risk-tag {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 2px;
  border: 1px solid #d9d9d9;
  font-size: 12px;
}
.risk--passed {
  color: #52c41a;
  border-color: #b7eb8f;
  background: #f6ffed;
}
.risk--rejected {
  color: #f5222d;
  border-color: #ffa39e;
  background: #fff1f0;
}
.risk--pending {
  color: #595959;
  border-color: #d9d9d9;
  background: #fafafa;
}
.ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.op-link {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}
.op-link:hover {
  text-decoration: underline;
}
.op-link:disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  text-decoration: none;
}
.op-more {
  border: 0;
  background: transparent;
  padding: 0 4px;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}
.op-more:hover {
  color: var(--color-primary);
}
.pager {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.pager-total {
  font-size: 13px;
  color: #666;
  margin-right: auto;
}
</style>
