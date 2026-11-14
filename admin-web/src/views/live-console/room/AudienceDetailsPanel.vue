<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Lock, Unlock } from "@element-plus/icons-vue";
import {
  exportConsoleAudienceDetails,
  listConsoleAudienceDetails,
  type AudienceDetailKeywordType,
  type AudienceDetailOnlineStatus,
  type ConsoleAudienceDetailItem,
} from "./api/console";
import { appendViewerTags, getViewerPhonePlain } from "@/api/viewer";
import { formatDurationSec } from "@/api/audience";
import { listViewerTags, ViewerTagType, type ViewerTagItem } from "@/api/viewerTag";
import { nicknameInitial } from "./utils/nicknameInitial";

const props = defineProps<{
  activityId: string;
}>();

type ShellTab = "audience" | "commerce" | "staff";

const shellTab = ref<ShellTab>("audience");
const loading = ref(false);
const exporting = ref(false);
const error = ref("");
const list = ref<ConsoleAudienceDetailItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const sort = ref("latestEnterTime");
const order = ref<"asc" | "desc">("desc");
const selected = ref<ConsoleAudienceDetailItem[]>([]);
const revealedPhones = reactive<Record<string, string>>({});
const revealing = reactive<Record<string, boolean>>({});

const draft = reactive({
  keywordType: "nickname" as AudienceDetailKeywordType,
  keyword: "",
  onlineStatus: "all" as AudienceDetailOnlineStatus,
  followerKeyword: "",
});
const applied = reactive({ ...draft });

const keywordPlaceholder = computed(() => {
  if (draft.keywordType === "username") return "请输入用户ID";
  if (draft.keywordType === "phone") return "请输入手机号";
  return "请输入用户昵称";
});

const tagDialogVisible = ref(false);
const tagSaving = ref(false);
const tagDraftIds = ref<number[]>([]);
const manualTags = ref<ViewerTagItem[]>([]);

const SORT_PROP_TO_KEY: Record<string, string> = {
  firstEnterTime: "firstEnterTime",
  latestEnterTime: "latestEnterTime",
  liveWatchDurationSec: "liveWatchDuration",
  replayWatchDurationSec: "replayWatchDuration",
  totalWatchDurationSec: "totalWatchDuration",
  leaveTime: "leaveTime",
  enterCount: "enterCount",
  online: "online",
  productClickCount: "productClickCount",
  pendingPayCount: "pendingPayCount",
  purchaseCount: "purchaseCount",
  totalPurchaseCount: "totalPurchaseCount",
  totalPurchaseAmount: "totalPurchaseAmount",
  commentCount: "commentCount",
  couponReceiveCount: "couponReceiveCount",
};

async function fetchList() {
  const id = props.activityId.trim();
  if (!id) {
    list.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await listConsoleAudienceDetails(id, {
      page: page.value,
      pageSize: pageSize.value,
      keywordType: applied.keywordType,
      keyword: applied.keyword.trim() || undefined,
      onlineStatus: applied.onlineStatus,
      followerKeyword: applied.followerKeyword.trim() || undefined,
      sort: sort.value,
      order: order.value,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? page.value;
    pageSize.value = res.pageSize ?? pageSize.value;
  } catch (e) {
    list.value = [];
    total.value = 0;
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function onQuery() {
  Object.assign(applied, { ...draft });
  page.value = 1;
  void fetchList();
}

function onReset() {
  draft.keywordType = "nickname";
  draft.keyword = "";
  draft.onlineStatus = "all";
  draft.followerKeyword = "";
  Object.assign(applied, { ...draft });
  page.value = 1;
  sort.value = "latestEnterTime";
  order.value = "desc";
  void fetchList();
}

function onRefresh() {
  void fetchList();
}

async function onExport() {
  const id = props.activityId.trim();
  if (!id) return;
  exporting.value = true;
  try {
    await exportConsoleAudienceDetails(id, {
      keywordType: applied.keywordType,
      keyword: applied.keyword.trim() || undefined,
      onlineStatus: applied.onlineStatus,
      followerKeyword: applied.followerKeyword.trim() || undefined,
      sort: sort.value,
      order: order.value,
    });
    ElMessage.success("已开始下载");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function onSortChange(payload: { prop: string; order: string | null }) {
  const key = SORT_PROP_TO_KEY[payload.prop];
  if (!key || !payload.order) {
    sort.value = "latestEnterTime";
    order.value = "desc";
  } else {
    sort.value = key;
    order.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchList();
}

function onSelectionChange(rows: ConsoleAudienceDetailItem[]) {
  selected.value = rows;
}

function onPageChange(p: number) {
  page.value = p;
  void fetchList();
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  void fetchList();
}

async function togglePhone(row: ConsoleAudienceDetailItem) {
  if (revealedPhones[row.username]) {
    delete revealedPhones[row.username];
    return;
  }
  if (!row.phoneMasked) {
    ElMessage.warning("未绑定手机号");
    return;
  }
  if (revealing[row.username]) return;
  revealing[row.username] = true;
  try {
    const res = await getViewerPhonePlain(row.username);
    revealedPhones[row.username] = res.phone;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取手机号失败");
  } finally {
    revealing[row.username] = false;
  }
}

async function ensureManualTags() {
  if (manualTags.value.length) return;
  const res = await listViewerTags({ page: 1, pageSize: 100, type: ViewerTagType.MANUAL });
  manualTags.value = res.list ?? [];
}

async function openTagDialog() {
  if (!selected.value.length) {
    ElMessage.warning("请先勾选用户");
    return;
  }
  tagDraftIds.value = [];
  tagDialogVisible.value = true;
  try {
    await ensureManualTags();
  } catch (e) {
    tagDialogVisible.value = false;
    ElMessage.error(e instanceof Error ? e.message : "加载标签失败");
  }
}

async function confirmTags() {
  if (!tagDraftIds.value.length) {
    ElMessage.warning("请选择标签");
    return;
  }
  tagSaving.value = true;
  try {
    const res = await appendViewerTags(
      selected.value.map((r) => r.username),
      [...tagDraftIds.value],
    );
    ElMessage.success(`已为 ${res.updated} 名用户追加标签`);
    tagDialogVisible.value = false;
    tagDraftIds.value = [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "贴标签失败");
  } finally {
    tagSaving.value = false;
  }
}

function avatarBroken(row: ConsoleAudienceDetailItem) {
  row.avatarUrl = undefined;
}

watch(
  () => props.activityId,
  () => {
    page.value = 1;
    selected.value = [];
    Object.keys(revealedPhones).forEach((k) => delete revealedPhones[k]);
    void fetchList();
  },
  { immediate: true },
);
</script>

<template>
  <section
    class="audience-details"
    aria-label="观众明细"
  >
    <header class="head">
      <div class="tabs">
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': shellTab === 'audience' }"
          @click="shellTab = 'audience'"
        >
          观众明细
        </button>
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': shellTab === 'commerce' }"
          @click="shellTab = 'commerce'"
        >
          带货明细
        </button>
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': shellTab === 'staff' }"
          @click="shellTab = 'staff'"
        >
          员工数据
        </button>
      </div>
      <span class="dim">统计维度：本场直播场次</span>
      <button
        type="button"
        class="refresh"
        title="刷新"
        :disabled="loading || shellTab !== 'audience'"
        @click="onRefresh"
      >
        <el-icon :size="16"><Refresh /></el-icon>
      </button>
    </header>

    <div
      v-if="shellTab !== 'audience'"
      class="empty-shell"
    >
      暂未开放
    </div>

    <div
      v-else
      class="body"
    >
      <div class="filters">
        <ElSelect
          v-model="draft.keywordType"
          style="width: 110px"
        >
          <ElOption
            label="用户昵称"
            value="nickname"
          />
          <ElOption
            label="用户ID"
            value="username"
          />
          <ElOption
            label="手机号"
            value="phone"
          />
        </ElSelect>
        <ElInput
          v-model="draft.keyword"
          clearable
          :placeholder="keywordPlaceholder"
          style="width: 180px"
          @keyup.enter="onQuery"
        />
        <span class="filter-label">状态</span>
        <ElSelect
          v-model="draft.onlineStatus"
          style="width: 100px"
        >
          <ElOption
            label="全部"
            value="all"
          />
          <ElOption
            label="在线"
            value="online"
          />
          <ElOption
            label="离线"
            value="offline"
          />
        </ElSelect>
        <span class="filter-label">跟进人</span>
        <ElInput
          v-model="draft.followerKeyword"
          clearable
          placeholder="请输入跟进人名称"
          style="width: 160px"
          @keyup.enter="onQuery"
        />
        <ElButton
          type="primary"
          @click="onQuery"
        >
          查询
        </ElButton>
        <ElButton
          :loading="exporting"
          @click="onExport"
        >
          导出
        </ElButton>
        <button
          type="button"
          class="link-btn"
          @click="onReset"
        >
          重置筛选条件
        </button>
      </div>

      <div class="batch">
        <span>已选 {{ selected.length }} 名用户</span>
        <ElButton
          size="small"
          @click="openTagDialog"
        >
          贴标签
        </ElButton>
      </div>

      <p
        v-if="error"
        class="err"
      >
        {{ error }}
      </p>

      <div class="table-wrap hover-scrollbar">
        <ElTable
          v-loading="loading"
          :data="list"
          height="100%"
          row-key="username"
          @selection-change="onSelectionChange"
          @sort-change="onSortChange"
        >
          <ElTableColumn
            type="selection"
            width="42"
            fixed
          />
          <ElTableColumn
            label="用户"
            min-width="140"
            fixed
          >
            <template #default="{ row }">
              <div class="user-cell">
                <img
                  v-if="row.avatarUrl"
                  class="avatar"
                  :src="row.avatarUrl"
                  alt=""
                  @error="avatarBroken(row)"
                >
                <span
                  v-else
                  class="avatar is-fallback"
                >{{ nicknameInitial(row.nickname) }}</span>
                <span class="nick">{{ row.nickname || "—" }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="username"
            label="用户ID"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            label="手机号"
            min-width="140"
          >
            <template #default="{ row }">
              <span class="phone-cell">
                <span>{{ revealedPhones[row.username] || row.phoneMasked || "—" }}</span>
                <button
                  v-if="row.phoneMasked"
                  type="button"
                  class="phone-lock"
                  :title="revealedPhones[row.username] ? '隐藏明文' : '查看明文'"
                  :disabled="!!revealing[row.username]"
                  @click="togglePhone(row)"
                >
                  <el-icon :size="14">
                    <Unlock v-if="revealedPhones[row.username]" />
                    <Lock v-else />
                  </el-icon>
                </button>
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="跟进人"
            width="100"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.followerName || "—" }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="firstEnterTime"
            label="首次进入时间"
            min-width="170"
            sortable="custom"
          />
          <ElTableColumn
            prop="latestEnterTime"
            label="最近进入时间"
            min-width="170"
            sortable="custom"
          />
          <ElTableColumn
            prop="liveWatchDurationSec"
            label="直播观看时长"
            width="130"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ formatDurationSec(row.liveWatchDurationSec) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="replayWatchDurationSec"
            label="回放观看时长"
            width="130"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ formatDurationSec(row.replayWatchDurationSec) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="totalWatchDurationSec"
            label="累计观看时长"
            width="130"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ formatDurationSec(row.totalWatchDurationSec) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="leaveTime"
            label="离线时间"
            min-width="170"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ row.leaveTime || "—" }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="enterCount"
            label="进出次数"
            width="100"
            sortable="custom"
          />
          <ElTableColumn
            prop="online"
            label="状态"
            width="90"
            sortable="custom"
          >
            <template #default="{ row }">
              <span
                class="status"
                :class="{ 'is-on': row.online }"
              >
                <i class="dot" />
                {{ row.online ? "在线" : "离线" }}
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="productClickCount"
            label="点击商品次数"
            width="120"
            sortable="custom"
          />
          <ElTableColumn
            prop="pendingPayCount"
            label="待支付次数"
            width="110"
            sortable="custom"
          />
          <ElTableColumn
            prop="purchaseCount"
            label="购买次数"
            width="100"
            sortable="custom"
          />
          <ElTableColumn
            prop="totalPurchaseCount"
            label="累计购买次数"
            width="120"
            sortable="custom"
          />
          <ElTableColumn
            prop="totalPurchaseAmount"
            label="累计购买金额"
            width="120"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ row.totalPurchaseAmount }}元
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="commentCount"
            label="评论次数"
            width="100"
            sortable="custom"
          />
          <ElTableColumn
            prop="couponReceiveCount"
            label="领券次数"
            width="100"
            sortable="custom"
          />
        </ElTable>
      </div>

      <div class="pager">
        <span class="total">共 {{ total }} 条</span>
        <ElPagination
          background
          layout="sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>

    <ElDialog
      v-model="tagDialogVisible"
      title="贴标签"
      width="420px"
      append-to-body
      destroy-on-close
    >
      <p class="dlg-tip">
        将为已选 {{ selected.length }} 名用户追加标签（保留原有标签）
      </p>
      <ElSelect
        v-model="tagDraftIds"
        multiple
        filterable
        placeholder="请选择标签"
        style="width: 100%"
      >
        <ElOption
          v-for="t in manualTags"
          :key="t.id"
          :label="t.name"
          :value="t.id"
        />
      </ElSelect>
      <template #footer>
        <ElButton @click="tagDialogVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="tagSaving"
          @click="confirmTags"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped>
.audience-details {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}

.head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.tabs {
  display: flex;
}

.tab {
  height: 44px;
  padding: 0 4px;
  margin-right: 24px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #333;
  font-size: 14px;
  cursor: pointer;
}

.tab.is-active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.dim {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.refresh {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  cursor: pointer;
}

.refresh:hover:not(:disabled) {
  background: #f5f5f5;
  color: #333;
}

.refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-shell {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

.body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 12px 16px 8px;
}

.filters {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-label {
  color: #666;
  font-size: 13px;
}

.link-btn {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.batch {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  color: #666;
  font-size: 13px;
}

.err {
  flex: none;
  margin: 0 0 8px;
  color: #ff4d4f;
  font-size: 13px;
}

.table-wrap {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  background: #f0f0f0;
}

.avatar.is-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 12px;
}

.nick {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.phone-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #999;
  cursor: pointer;
}

.phone-lock:hover:not(:disabled) {
  color: var(--color-primary);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #999;
  font-size: 13px;
}

.status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c4cc;
}

.status.is-on {
  color: #52c41a;
}

.status.is-on .dot {
  background: #52c41a;
}

.pager {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}

.total {
  color: #999;
  font-size: 12px;
}

.dlg-tip {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
}
</style>
