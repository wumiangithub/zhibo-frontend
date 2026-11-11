<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import {
  formatLearnDurationSec,
  listViewers,
  viewerBanBadges,
  registerChannelLabel,
  updateViewerBlacklist,
  updateViewerTags,
  type ViewerKeywordType,
  type ViewerListItem,
  type ViewerTagMatch,
} from "@/api/viewer";
import { listViewerTags, ViewerTagType, type ViewerTagItem } from "@/api/viewerTag";
import { exportViewerRows } from "./exportViewerRows";

const router = useRouter();
const loading = ref(false);
const rows = ref<ViewerListItem[]>([]);
const total = ref(0);
const selected = ref<ViewerListItem[]>([]);
const page = ref(1);
const pageSize = ref(10);
const sort = ref<string | undefined>();
const order = ref<"asc" | "desc" | undefined>();

const filters = reactive({
  keywordType: "nickname" as ViewerKeywordType,
  keyword: "",
  tagMatch: "any" as ViewerTagMatch,
  tagIds: [] as number[],
  consumeAmountMin: undefined as number | undefined,
  consumeAmountMax: undefined as number | undefined,
  consumeCountMin: undefined as number | undefined,
  consumeCountMax: undefined as number | undefined,
});

const keywordPlaceholder: Record<ViewerKeywordType, string> = {
  nickname: "请输入用户昵称",
  id: "请输入用户ID",
  phone: "请输入手机号",
};

/** 筛选用：全部未软删标签 */
const filterTags = ref<ViewerTagItem[]>([]);
const manualTags = ref<ViewerTagItem[]>([]);
const tagDialogVisible = ref(false);
const tagTarget = ref<ViewerListItem | null>(null);
const tagDraftIds = ref<number[]>([]);
const tagSaving = ref(false);
const tagSelectOpen = ref(false);

const blacklistDialogVisible = ref(false);
const blacklistTarget = ref<ViewerListItem | null>(null);
const blacklistDraft = reactive({
  banComment: false,
  banPurchase: false,
  banAccess: false,
});
const blacklistSaving = ref(false);

async function fetchList() {
  loading.value = true;
  try {
    const res = await listViewers({
      page: page.value,
      pageSize: pageSize.value,
      keywordType: filters.keywordType,
      keyword: filters.keyword.trim() || undefined,
      tagMatch: filters.tagMatch,
      tagIds: filters.tagIds.length ? [...filters.tagIds] : undefined,
      consumeAmountMin: filters.consumeAmountMin,
      consumeAmountMax: filters.consumeAmountMax,
      consumeCountMin: filters.consumeCountMin,
      consumeCountMax: filters.consumeCountMax,
      sort: sort.value,
      order: order.value,
    });
    rows.value = (res.list ?? []).map((row) => ({
      ...row,
      banComment: row.banComment ?? 0,
      banPurchase: row.banPurchase ?? 0,
      banAccess: row.banAccess ?? 0,
      tagIds: row.tagIds ?? [],
      tagLabels: row.tagLabels ?? [],
    }));
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.keywordType = "nickname";
  filters.keyword = "";
  filters.tagMatch = "any";
  filters.tagIds = [];
  filters.consumeAmountMin = undefined;
  filters.consumeAmountMax = undefined;
  filters.consumeCountMin = undefined;
  filters.consumeCountMax = undefined;
  page.value = 1;
  sort.value = undefined;
  order.value = undefined;
  void fetchList();
}

async function loadFilterTags() {
  try {
    const res = await listViewerTags({ page: 1, pageSize: 100 });
    filterTags.value = res.list ?? [];
  } catch {
    filterTags.value = [];
  }
}

function onSortChange(payload: { prop: string | null; order: string | null }) {
  const map: Record<string, string> = {
    createdTime: "createdTime",
    lastVisitTime: "lastVisitTime",
    consumeCount: "consumeCount",
    consumeAmount: "consumeAmount",
    lastConsumeTime: "lastConsumeTime",
    totalLearnDurationSec: "totalLearnDuration",
    todayLearnDurationSec: "todayLearnDuration",
    completedCourseCount: "completedCourseCount",
    firstPayTime: "firstPayTime",
  };
  const key = payload.prop ? map[payload.prop] : undefined;
  if (!key || !payload.order) {
    sort.value = undefined;
    order.value = undefined;
  } else {
    sort.value = key;
    order.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchList();
}

function onSelectionChange(list: ViewerListItem[]) {
  selected.value = list;
}

function onImportPlaceholder() {
  ElMessage.info("导入功能即将开放");
}

function onExport() {
  if (!selected.value.length) {
    ElMessage.warning("请先勾选要导出的用户");
    return;
  }
  exportViewerRows(selected.value);
}

async function ensureManualTags() {
  if (manualTags.value.length) return;
  const res = await listViewerTags({ page: 1, pageSize: 100, type: ViewerTagType.MANUAL });
  manualTags.value = res.list ?? [];
  // 筛选下拉也刷新一份手动标签（新建后回来可再点查询）
  if (!filterTags.value.length) {
    filterTags.value = manualTags.value;
  }
}

async function openTagDialog(row: ViewerListItem) {
  tagTarget.value = row;
  tagDraftIds.value = [];
  tagDialogVisible.value = true;
  try {
    await ensureManualTags();
    const manualIdSet = new Set(manualTags.value.map((t) => t.id));
    tagDraftIds.value = (row.tagIds ?? []).filter((id) => manualIdSet.has(id));
  } catch (e) {
    tagDialogVisible.value = false;
    tagTarget.value = null;
    ElMessage.error(e instanceof Error ? e.message : "加载标签失败");
  }
}

function closeTagDialog() {
  tagDialogVisible.value = false;
  tagTarget.value = null;
  tagDraftIds.value = [];
  tagSelectOpen.value = false;
}

function onTagSelectVisible(open: boolean) {
  tagSelectOpen.value = open;
}

function goCreateTag() {
  closeTagDialog();
  void router.push("/user/tags/create");
}

async function confirmTags() {
  const row = tagTarget.value;
  if (!row) return;
  tagSaving.value = true;
  try {
    const res = await updateViewerTags(row.uid, [...tagDraftIds.value]);
    row.tagIds = res.tagIds ?? [];
    row.tagLabels = res.tagLabels ?? [];
    ElMessage.success("标签已更新");
    closeTagDialog();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    tagSaving.value = false;
  }
}

function openBlacklistDialog(row: ViewerListItem) {
  blacklistTarget.value = row;
  blacklistDraft.banComment = row.banComment === 1;
  blacklistDraft.banPurchase = row.banPurchase === 1;
  blacklistDraft.banAccess = row.banAccess === 1;
  blacklistDialogVisible.value = true;
}

function closeBlacklistDialog() {
  blacklistDialogVisible.value = false;
  blacklistTarget.value = null;
}

async function confirmBlacklist() {
  const row = blacklistTarget.value;
  if (!row) return;
  const next = {
    banComment: (blacklistDraft.banComment ? 1 : 0) as 0 | 1,
    banPurchase: (blacklistDraft.banPurchase ? 1 : 0) as 0 | 1,
    banAccess: (blacklistDraft.banAccess ? 1 : 0) as 0 | 1,
  };
  blacklistSaving.value = true;
  try {
    const res = await updateViewerBlacklist(row.uid, next);
    row.banComment = res.banComment;
    row.banPurchase = res.banPurchase;
    row.banAccess = res.banAccess;
    row.status = res.status;
    ElMessage.success("黑名单已更新");
    closeBlacklistDialog();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    blacklistSaving.value = false;
  }
}

onMounted(() => {
  void loadFilterTags();
  void fetchList();
});
</script>

<template>
  <div class="admin-panel admin-panel--row-64 user-list">
    <div class="admin-filter-bar">
      <div class="admin-filter-fields">
      <div class="admin-filter-item">
        <span class="admin-filter-label">用户</span>
        <ElSelect
          v-model="filters.keywordType"
          style="width: 110px"
        >
          <ElOption
            label="昵称"
            value="nickname"
          />
          <ElOption
            label="用户ID"
            value="id"
          />
          <ElOption
            label="手机号"
            value="phone"
          />
        </ElSelect>
        <ElInput
          v-model="filters.keyword"
          clearable
          :placeholder="keywordPlaceholder[filters.keywordType]"
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">标签</span>
        <ElSelect
          v-model="filters.tagMatch"
          style="width: 110px"
        >
          <ElOption
            label="满足其一"
            value="any"
          />
          <ElOption
            label="不包含"
            value="none"
          />
          <ElOption
            label="同时满足"
            value="all"
          />
        </ElSelect>
        <ElSelect
          v-model="filters.tagIds"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择"
          style="width: 200px"
        >
          <ElOption
            v-for="t in filterTags"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </ElSelect>
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">累计消费金额</span>
        <ElInputNumber
          v-model="filters.consumeAmountMin"
          :controls="false"
          :min="0"
          placeholder="最低金额"
          style="width: 110px"
        />
        <span class="sep">-</span>
        <ElInputNumber
          v-model="filters.consumeAmountMax"
          :controls="false"
          :min="0"
          placeholder="最高金额"
          style="width: 110px"
        />
        <span class="unit">元</span>
      </div>
      <div class="admin-filter-item">
        <span class="admin-filter-label">累计消费次数</span>
        <ElInputNumber
          v-model="filters.consumeCountMin"
          :controls="false"
          :min="0"
          :precision="0"
          placeholder="最低次数"
          style="width: 110px"
        />
        <span class="sep">-</span>
        <ElInputNumber
          v-model="filters.consumeCountMax"
          :controls="false"
          :min="0"
          :precision="0"
          placeholder="最高次数"
          style="width: 110px"
        />
        <span class="unit">次</span>
      </div>
      </div>
      <div class="admin-filter-actions">
        <button type="button" class="admin-btn admin-btn--primary" @click="onSearch">查询</button>
        <button type="button" class="admin-btn admin-btn--ghost" @click="onReset">重置</button>
      </div>
    </div>

    <div class="admin-toolbar">
      <button type="button" class="admin-btn admin-btn--primary" @click="onImportPlaceholder">+ 导入用户</button>
      <button type="button" class="admin-btn admin-btn--ghost" @click="onExport">导出</button>
    </div>

    <div class="admin-table-wrap">
      <ElTable
        v-loading="loading"
        :data="rows"
        row-key="id"
        height="100%"
        empty-text="暂无用户"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <ElTableColumn
          type="selection"
          width="48"
          fixed
        />
        <ElTableColumn
          label="用户"
          min-width="200"
          fixed
        >
          <template #default="{ row }">
            <div class="user-cell">
              <img
                v-if="row.avatarUrl"
                class="avatar"
                :src="row.avatarUrl"
                alt=""
              >
              <span
                v-else
                class="avatar avatar-ph"
              />
              <div class="user-meta">
                <span class="user-name">{{ row.nickname }}</span>
                <div
                  v-if="viewerBanBadges(row as ViewerListItem).length"
                  class="ban-line"
                >
                  <span
                    v-for="badge in viewerBanBadges(row as ViewerListItem)"
                    :key="badge"
                    class="banned"
                  >{{ badge }}</span>
                </div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="uid"
          label="用户ID"
          min-width="100"
        />
        <ElTableColumn
          label="来源渠道"
          width="100"
        >
          <template #default="{ row }">
            {{ registerChannelLabel(row.registerChannel) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="绑定手机号"
          width="130"
        >
          <template #default="{ row }">
            {{ row.phoneMasked || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="createdTime"
          label="注册时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.createdTime || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="consumeCount"
          label="累计消费次数"
          width="148"
          sortable="custom"
        />
        <ElTableColumn
          prop="consumeAmount"
          label="累计消费金额"
          width="148"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.consumeAmount || "0.00" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="lastConsumeTime"
          label="最近消费时间"
          min-width="170"
          sortable="custom"
        >
          <template #default>
            —
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="lastVisitTime"
          label="最近访问时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.lastVisitTime || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="totalLearnDurationSec"
          label="累计学习时长"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatLearnDurationSec(row.totalLearnDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="todayLearnDurationSec"
          label="今日学习时长"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatLearnDurationSec(row.todayLearnDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="completedCourseCount"
          label="完成课程数"
          width="140"
          sortable="custom"
          align="center"
        >
          <template #default="{ row }">
            {{ row.completedCourseCount ?? 0 }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="最近购买商品"
          min-width="160"
        >
          <template #default="{ row }">
            {{ row.recentPurchaseProduct || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="firstPayTime"
          label="首次支付时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.firstPayTime || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="标签"
          min-width="140"
        >
          <template #default="{ row }">
            <ElTooltip
              v-if="row.tagLabels && row.tagLabels.length"
              :content="row.tagLabels.join('、')"
              placement="top"
              :show-after="200"
            >
              <div class="tag-line">
                <span
                  v-for="(tag, idx) in row.tagLabels"
                  :key="`${row.uid}-${idx}`"
                  class="tag-pill"
                >{{ tag }}</span>
              </div>
            </ElTooltip>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="操作"
          width="168"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="admin-ops">
              <button
                type="button"
                class="admin-op"
                @click="void openTagDialog(row as ViewerListItem)"
              >
                贴标签
              </button>
              <button
                type="button"
                class="admin-op"
                @click="openBlacklistDialog(row as ViewerListItem)"
              >
                黑名单设置
              </button>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="admin-pager">
      <span class="admin-pager__total">共 {{ total }} 条记录</span>
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="sizes, prev, pager, next, jumper"
        @current-change="fetchList"
        @size-change="
          () => {
            page = 1;
            fetchList();
          }
        "
      />
    </div>

    <ElDialog
      v-model="tagDialogVisible"
      width="440px"
      class="user-list-dlg user-list-dlg--tag"
      align-center
      :show-close="false"
      destroy-on-close
      @closed="closeTagDialog"
    >
      <template #header>
        <div class="ul-dlg-head">
          <div>
            <div class="ul-dlg-title">贴标签</div>
            <div class="ul-dlg-sub">
              为用户 <b>{{ tagTarget?.nickname || tagTarget?.uid }}</b> 添加标签
            </div>
          </div>
          <button
            type="button"
            class="ul-dlg-close"
            aria-label="关闭"
            @click="closeTagDialog"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </template>
      <div class="ul-dlg-body ul-dlg-body--tag">
        <ElSelect
          v-model="tagDraftIds"
          multiple
          filterable
          :teleported="false"
          placeholder="请选择标签"
          class="ul-tag-select"
          :class="{ 'is-open': tagSelectOpen }"
          popper-class="user-list-tag-popper"
          style="width: 100%"
          @visible-change="onTagSelectVisible"
        >
          <ElOption
            v-for="t in manualTags"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </ElSelect>
        <button
          type="button"
          class="ul-tag-create"
          @mousedown.prevent
          @click="goCreateTag"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          >
            <path d="M7 2.5v9M2.5 7h9" />
          </svg>
          新建标签
        </button>
      </div>
      <template #footer>
        <div class="ul-dlg-foot">
          <ElButton
            class="ul-dlg-btn ul-dlg-btn--ghost"
            @click="closeTagDialog"
          >
            取消
          </ElButton>
          <ElButton
            class="ul-dlg-btn ul-dlg-btn--primary"
            type="primary"
            :loading="tagSaving"
            @click="confirmTags"
          >
            确定
          </ElButton>
        </div>
      </template>
    </ElDialog>

    <ElDialog
      v-model="blacklistDialogVisible"
      width="440px"
      class="user-list-dlg"
      align-center
      :show-close="false"
      destroy-on-close
      @closed="closeBlacklistDialog"
    >
      <template #header>
        <div class="ul-dlg-head">
          <div>
            <div class="ul-dlg-title">黑名单设置</div>
            <div class="ul-dlg-sub">
              为用户 <b>{{ blacklistTarget?.nickname || blacklistTarget?.uid }}</b> 设置限制
            </div>
          </div>
          <button
            type="button"
            class="ul-dlg-close"
            aria-label="关闭"
            @click="closeBlacklistDialog"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </template>
      <div class="ul-dlg-body ul-dlg-body--bl">
        <button
          type="button"
          class="ul-bl-opt"
          :class="{ 'is-on': blacklistDraft.banComment }"
          @click="blacklistDraft.banComment = !blacklistDraft.banComment"
        >
          <span class="ul-bl-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-4 3.2V15H7.5A2.5 2.5 0 0 1 5 12.5v-6z" />
              <path d="M9 9.5h6" />
            </svg>
          </span>
          <span class="ul-bl-copy">
            <span class="ul-bl-title">禁止评论</span>
            <span class="ul-bl-desc">该用户无法在直播间发表评论</span>
          </span>
          <span
            class="ul-bl-switch"
            :class="{ 'is-on': blacklistDraft.banComment }"
          />
        </button>
        <button
          type="button"
          class="ul-bl-opt"
          :class="{ 'is-on': blacklistDraft.banPurchase }"
          @click="blacklistDraft.banPurchase = !blacklistDraft.banPurchase"
        >
          <span class="ul-bl-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9.2" cy="19" r="1.15" />
              <circle cx="17" cy="19" r="1.15" />
              <path d="M4.5 5.5h1.8l1.7 9.2h9.4l1.7-6.2H7.2" />
            </svg>
          </span>
          <span class="ul-bl-copy">
            <span class="ul-bl-title">禁止购买</span>
            <span class="ul-bl-desc">该用户无法购买本场商品</span>
          </span>
          <span
            class="ul-bl-switch"
            :class="{ 'is-on': blacklistDraft.banPurchase }"
          />
        </button>
        <button
          type="button"
          class="ul-bl-opt is-warn"
          :class="{ 'is-on': blacklistDraft.banAccess }"
          @click="blacklistDraft.banAccess = !blacklistDraft.banAccess"
        >
          <span class="ul-bl-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="8.2" />
              <path d="M8.2 8.2l7.6 7.6" />
            </svg>
          </span>
          <span class="ul-bl-copy">
            <span class="ul-bl-title">禁止访问</span>
            <span class="ul-bl-desc">该用户将无法进入直播间</span>
          </span>
          <span
            class="ul-bl-switch"
            :class="{ 'is-on': blacklistDraft.banAccess }"
          />
        </button>
      </div>
      <template #footer>
        <div class="ul-dlg-foot">
          <ElButton
            class="ul-dlg-btn ul-dlg-btn--ghost"
            @click="closeBlacklistDialog"
          >
            取消
          </ElButton>
          <ElButton
            class="ul-dlg-btn ul-dlg-btn--primary"
            type="primary"
            :loading="blacklistSaving"
            @click="confirmBlacklist"
          >
            确定
          </ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.sep,
.unit {
  font-size: 13px;
  color: var(--text-4);
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.avatar-ph {
  background: var(--line-soft);
}
.user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  line-height: 1.3;
}
.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-weight: 700;
  color: var(--text);
}
.ban-line {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
}
.banned {
  flex: none;
  font-size: 11px;
  line-height: 16px;
  color: var(--text-4);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0 3px;
  white-space: nowrap;
}
.tag-line {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
}
.tag-pill {
  flex: none;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 11px;
  border: 1px solid var(--gold);
  color: var(--gold-deep);
  font-size: 12px;
  white-space: nowrap;
}
</style>

<style>
/* 用户列表弹窗：ElDialog 传送到 body，用独立类避免影响其它页 */
.user-list-dlg {
  padding: 0;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.user-list-dlg--tag {
  height: 400px;
  display: flex;
  flex-direction: column;
}
.user-list-dlg--tag .el-dialog__header,
.user-list-dlg--tag .el-dialog__footer {
  flex: none;
}
.user-list-dlg--tag .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.user-list-dlg .el-dialog__header {
  padding: 0;
  margin: 0;
}
.user-list-dlg .el-dialog__body,
.user-list-dlg .el-dialog__footer {
  padding: 0;
}
.ul-dlg-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 14px 24px;
}
.ul-dlg-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text, #0F172A);
  line-height: 24px;
}
.ul-dlg-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3, #64748B);
  line-height: 18px;
}
.ul-dlg-sub b {
  color: var(--text-2, #334155);
  font-weight: 600;
}
.ul-dlg-close {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--text-4, #94A3B8);
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: -2px;
  padding: 0;
}
.ul-dlg-close:hover {
  background: #F8FAFC;
  color: var(--text-3, #64748B);
}
.ul-dlg-body {
  padding: 4px 24px 8px 24px;
}
.ul-dlg-body--tag {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 24px 0;
}
.ul-dlg-body--bl {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ul-dlg-foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 20px;
  margin-top: 8px;
  border-top: 1px solid var(--line-soft, #EEF2F7);
}
.user-list-dlg .ul-dlg-btn.el-button {
  height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
}
.user-list-dlg .ul-dlg-btn--ghost.el-button {
  background: #fff;
  border: 1px solid var(--line, #E2E8F0);
  color: var(--text-2, #334155);
  font-weight: 600;
}
.user-list-dlg .ul-dlg-btn--ghost.el-button:hover,
.user-list-dlg .ul-dlg-btn--ghost.el-button:focus {
  background: #F8FAFC;
  border-color: var(--line, #E2E8F0);
  color: var(--text-2, #334155);
}
.user-list-dlg .ul-dlg-btn--primary.el-button {
  background: var(--primary, #2563EB);
  border-color: var(--primary, #2563EB);
  color: #fff;
  font-weight: 700;
}
.user-list-dlg .ul-dlg-btn--primary.el-button:hover,
.user-list-dlg .ul-dlg-btn--primary.el-button:focus {
  background: #1D4ED8;
  border-color: #1D4ED8;
  color: #fff;
}

.ul-bl-opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line-soft, #EEF2F7);
  background: #F8FAFC;
  border-radius: 12px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}
.ul-bl-opt.is-on {
  background: #EFF6FF;
  border-color: #DBEAFE;
}
.ul-bl-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: #EEF2F7;
  color: var(--text-2, #334155);
}
.ul-bl-opt.is-on .ul-bl-icon {
  background: #DBEAFE;
  color: var(--primary, #2563EB);
}
.ul-bl-opt.is-warn .ul-bl-icon,
.ul-bl-opt.is-warn.is-on .ul-bl-icon {
  background: #FEE2E2;
  color: #EF4444;
}
.ul-bl-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}
.ul-bl-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ul-bl-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #0F172A);
  line-height: 20px;
}
.ul-bl-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3, #64748B);
  line-height: 18px;
}
.ul-bl-switch {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: #CBD5E1;
  position: relative;
  flex-shrink: 0;
}
.ul-bl-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.16);
  transition: left 0.15s ease;
}
.ul-bl-switch.is-on {
  background: var(--primary, #2563EB);
}
.ul-bl-switch.is-on::after {
  left: 20px;
}

.ul-dlg-body--tag .ul-tag-create {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: var(--primary, #2563EB);
  font-size: 13px;
  font-weight: 600;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  line-height: 20px;
  border-radius: 0;
}
.ul-tag-select.is-open + .ul-tag-create {
  border: 1px solid var(--line, #E2E8F0);
  border-top: 1px solid var(--line-soft, #EEF2F7);
  border-radius: 0 0 10px 10px;
  margin-top: 0;
}
.ul-tag-create:hover {
  color: #1D4ED8;
}
.ul-tag-create svg {
  display: block;
}

.user-list-dlg .ul-tag-select .el-select__wrapper {
  min-height: 36px;
  width: 100%;
  box-sizing: border-box;
  border-radius: 8px;
  padding: 4px 8px 4px 8px;
  box-shadow: none;
  border: 1px solid var(--line, #E2E8F0);
  background: #fff;
  gap: 6px;
}
.user-list-dlg .ul-tag-select .el-select__wrapper.is-focused,
.user-list-dlg .ul-tag-select .el-select__wrapper.is-hovering.is-focused {
  border-color: var(--primary, #2563EB);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.user-list-dlg .ul-tag-select .el-select__selection {
  flex-wrap: wrap;
  gap: 6px;
}
.user-list-dlg .ul-tag-select .el-tag {
  height: 24px;
  padding: 0 4px 0 8px;
  background: #EFF6FF;
  color: var(--primary, #2563EB);
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  margin: 0;
}
.user-list-dlg .ul-tag-select .el-tag .el-tag__close {
  color: var(--primary, #2563EB);
}
.user-list-dlg .ul-tag-select .el-tag .el-tag__close:hover {
  background: #DBEAFE;
  color: var(--primary, #2563EB);
}

/* 选择器只占输入行，下拉进下方预留区滚动，避免箭头随整列居中 */
.ul-dlg-body--tag {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr;
}
.user-list-dlg--tag .ul-tag-select {
  display: contents !important;
}
.user-list-dlg--tag .ul-tag-select .el-select__wrapper {
  grid-row: 1;
  grid-column: 1;
  width: 100%;
}
.user-list-dlg--tag .ul-tag-select .el-select__popper,
.user-list-dlg--tag .user-list-tag-popper {
  position: static !important;
  transform: none !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100%;
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
  margin-top: 6px;
  align-self: stretch;
}
.ul-dlg-body--tag .ul-tag-create {
  grid-row: 3;
  grid-column: 1;
}
.user-list-dlg .user-list-tag-popper .el-popper__arrow {
  display: none;
}
.user-list-dlg--tag .user-list-tag-popper.el-select__popper,
.user-list-dlg--tag .user-list-tag-popper {
  border: 1px solid var(--line, #E2E8F0);
  border-radius: 10px;
  box-shadow: none;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.user-list-dlg--tag .ul-tag-select.is-open .user-list-tag-popper,
.user-list-dlg--tag .ul-tag-select.is-open .el-select__popper {
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
}
.user-list-dlg--tag .user-list-tag-popper .el-select-dropdown {
  flex: 1;
  min-height: 0;
  max-height: none !important;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.user-list-dlg--tag .user-list-tag-popper .el-scrollbar {
  flex: 1;
  min-height: 0;
}
.user-list-dlg--tag .user-list-tag-popper .el-select-dropdown__wrap,
.user-list-dlg--tag .user-list-tag-popper .el-scrollbar__wrap {
  max-height: none !important;
  height: 100%;
  overflow: auto;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__item {
  height: 36px;
  line-height: 36px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text, #0F172A);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__item.is-hovering {
  background: #F8FAFC;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__item.is-selected {
  background: #EFF6FF;
  color: var(--text, #0F172A);
  font-weight: 600;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__item.is-selected.is-hovering {
  background: #EFF6FF;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__item .el-icon {
  margin-left: auto;
  color: var(--primary, #2563EB);
  font-size: 14px;
}
.user-list-dlg .user-list-tag-popper .el-select-dropdown__footer {
  padding: 0;
  border-top: 1px solid var(--line-soft, #EEF2F7);
}
</style>
