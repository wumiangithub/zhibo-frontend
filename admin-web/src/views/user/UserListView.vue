<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ElButton,
  ElCheckbox,
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

function onSortChange(payload: { prop: string; order: string | null }) {
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
  const key = map[payload.prop];
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
    const res = await updateViewerTags(row.id, [...tagDraftIds.value]);
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
    const res = await updateViewerBlacklist(row.id, next);
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
  <div class="user-list">
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">用户</span>
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
      <div class="filter-item">
        <span class="filter-label">标签</span>
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
      <div class="filter-item">
        <span class="filter-label">累计消费金额</span>
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
      <div class="filter-item">
        <span class="filter-label">累计消费次数</span>
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
      <ElButton @click="onReset">重置</ElButton>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <div class="toolbar">
      <ElButton
        type="primary"
        @click="onImportPlaceholder"
      >
        + 导入用户
      </ElButton>
      <ElButton @click="onExport">导出</ElButton>
    </div>

    <div class="table-wrap">
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
                  v-if="viewerBanBadges(row).length"
                  class="ban-line"
                >
                  <span
                    v-for="badge in viewerBanBadges(row)"
                    :key="badge"
                    class="banned"
                  >{{ badge }}</span>
                </div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="id"
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
                  :key="`${row.id}-${idx}`"
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
            <button
              type="button"
              class="link-btn"
              @click="void openTagDialog(row)"
            >
              贴标签
            </button>
            <button
              type="button"
              class="link-btn"
              @click="openBlacklistDialog(row)"
            >
              黑名单设置
            </button>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="pager">
      <span class="pager-total">共 {{ total }} 条记录</span>
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        background
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
      title="贴标签"
      width="480px"
      destroy-on-close
      @closed="closeTagDialog"
    >
      <div class="dialog-body">
        <ElSelect
          v-model="tagDraftIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
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
        <button
          type="button"
          class="link-btn create-tag"
          @click="goCreateTag"
        >
          新建标签
        </button>
      </div>
      <template #footer>
        <ElButton @click="closeTagDialog">取消</ElButton>
        <ElButton
          type="primary"
          :loading="tagSaving"
          @click="confirmTags"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="blacklistDialogVisible"
      title="黑名单设置"
      width="420px"
      destroy-on-close
      @closed="closeBlacklistDialog"
    >
      <div class="bl-dialog">
        <label class="bl-row">
          <span>禁止评论</span>
          <ElCheckbox v-model="blacklistDraft.banComment" />
        </label>
        <label class="bl-row">
          <span>禁止购买</span>
          <ElCheckbox v-model="blacklistDraft.banPurchase" />
        </label>
        <label class="bl-row">
          <span>禁止访问</span>
          <ElCheckbox v-model="blacklistDraft.banAccess" />
        </label>
      </div>
      <template #footer>
        <ElButton @click="closeBlacklistDialog">取消</ElButton>
        <ElButton
          type="primary"
          :loading="blacklistSaving"
          @click="confirmBlacklist"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.user-list {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.sep,
.unit {
  font-size: 13px;
  color: #999;
}
.toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
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
  background: #e8e8e8;
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
  color: #999;
  border: 1px solid #ddd;
  border-radius: 2px;
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
  border: 1px solid #fa8c16;
  color: #fa8c16;
  font-size: 12px;
  white-space: nowrap;
}
.link-btn {
  border: 0;
  background: transparent;
  padding: 0 6px 0 0;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
}
.link-btn:hover {
  opacity: 0.85;
}
.dialog-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.create-tag {
  padding: 0;
}
.bl-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}
.bl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
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
