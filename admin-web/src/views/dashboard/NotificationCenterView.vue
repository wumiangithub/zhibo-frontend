<script setup lang="ts">
/**
 * 通知中心二级页：只画 UI，Mock 数据本地筛选/分页，接口后续再接。
 */
import { computed, reactive, ref } from "vue";
import { ElInput, ElOption, ElPagination, ElSelect } from "element-plus";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";

/** 类型枚举（对齐产品卡：完整通知类型文案） */
type NoticeType =
  | "live_status_abnormal"
  | "live_report_audit"
  | "live_audit"
  | "material_audit";

type AuditResult = "passed" | "rejected" | "none";

const NOTICE_TYPE_META: Record<
  NoticeType,
  { label: string; cat: string; title: string }
> = {
  live_status_abnormal: {
    label: "【直播】状态异常通知",
    cat: "直播",
    title: "状态异常通知",
  },
  live_report_audit: {
    label: "【直播报备】合规风控审核结果通知",
    cat: "直播报备",
    title: "合规风控审核结果通知",
  },
  live_audit: {
    label: "【直播】合规风控审核结果通知",
    cat: "直播",
    title: "合规风控审核结果通知",
  },
  material_audit: {
    label: "【素材库】合规风控审核结果通知",
    cat: "素材库",
    title: "合规风控审核结果通知",
  },
};

type NoticeItem = {
  id: string;
  type: NoticeType;
  /** 冒号后的正文 */
  body: string;
  auditResult: AuditResult;
  time: string;
};

const crumbs: AppBreadcrumbItem[] = [
  { label: "工作台", to: "/" },
  { label: "通知中心" },
];

const TYPE_OPTIONS: { label: string; value: "all" | NoticeType }[] = [
  { label: "全部", value: "all" },
  { label: NOTICE_TYPE_META.live_status_abnormal.label, value: "live_status_abnormal" },
  { label: NOTICE_TYPE_META.live_report_audit.label, value: "live_report_audit" },
  { label: NOTICE_TYPE_META.live_audit.label, value: "live_audit" },
  { label: NOTICE_TYPE_META.material_audit.label, value: "material_audit" },
];

/** 审核结果枚举 */
const AUDIT_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "已通过", value: "passed" },
  { label: "已驳回", value: "rejected" },
] as const;

/** Mock：对齐稿面文案结构，后续换接口 */
const ALL_NOTICES: NoticeItem[] = [
  {
    id: "1",
    type: "live_status_abnormal",
    body: "直播间IDXXXXXXXX 状态异常，直播间IDXXXXXXXXXXXXXX",
    auditResult: "none",
    time: "2026-07-13 18:32:00",
  },
  {
    id: "2",
    type: "live_report_audit",
    body: "审核-已通过",
    auditResult: "passed",
    time: "2026-07-13 18:32:00",
  },
  {
    id: "3",
    type: "live_audit",
    body: "审核-已通过",
    auditResult: "passed",
    time: "2026-07-13 18:32:00",
  },
  {
    id: "4",
    type: "material_audit",
    body: "审核-已驳回",
    auditResult: "rejected",
    time: "2026-07-13 18:32:00",
  },
  {
    id: "5",
    type: "live_audit",
    body: "审核-已驳回",
    auditResult: "rejected",
    time: "2026-07-13 17:05:00",
  },
  {
    id: "6",
    type: "live_status_abnormal",
    body: "直播间ID882910「十月公开课 · 市场解读」推流中断，请及时排查。",
    auditResult: "none",
    time: "2026-07-12 21:18:00",
  },
  {
    id: "7",
    type: "live_audit",
    body: "直播「产品发布会直播专场」审核通过，可正常开播。",
    auditResult: "passed",
    time: "2026-07-12 16:40:00",
  },
  {
    id: "8",
    type: "material_audit",
    body: "素材「活动主视觉封面-A」审核通过，已可在直播间使用。",
    auditResult: "passed",
    time: "2026-07-12 11:22:00",
  },
  {
    id: "9",
    type: "live_report_audit",
    body: "审核-已驳回：简介含未授权第三方 Logo",
    auditResult: "rejected",
    time: "2026-07-11 19:08:00",
  },
  {
    id: "10",
    type: "live_audit",
    body: "直播「测试直播功能-秦」审核未通过：封面含未授权第三方 Logo。",
    auditResult: "rejected",
    time: "2026-07-11 14:55:00",
  },
  {
    id: "11",
    type: "live_status_abnormal",
    body: "直播间ID449201 推流中断后已恢复，请确认画面是否正常。",
    auditResult: "none",
    time: "2026-07-10 22:01:00",
  },
  {
    id: "12",
    type: "live_report_audit",
    body: "审核-已通过",
    auditResult: "passed",
    time: "2026-07-10 09:30:00",
  },
];

const filters = reactive({
  keyword: "",
  type: "all" as "all" | NoticeType,
  auditResult: "all" as "all" | Exclude<AuditResult, "none">,
});

/** 已生效的筛选（点查询才写入） */
const applied = reactive({
  keyword: "",
  type: "all" as "all" | NoticeType,
  auditResult: "all" as "all" | Exclude<AuditResult, "none">,
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

function noticeLine(item: NoticeItem) {
  const meta = NOTICE_TYPE_META[item.type];
  return `[${meta.cat}]${meta.title}：${item.body}`;
}

const filtered = computed(() => {
  const kw = applied.keyword.trim().toLowerCase();
  return ALL_NOTICES.filter((item) => {
    if (applied.type !== "all" && item.type !== applied.type) return false;
    if (applied.auditResult !== "all" && item.auditResult !== applied.auditResult) return false;
    if (!kw) return true;
    return noticeLine(item).toLowerCase().includes(kw);
  });
});

const total = computed(() => filtered.value.length);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));

const pageList = computed(() => {
  const start = (query.page - 1) * query.pageSize;
  return filtered.value.slice(start, start + query.pageSize);
});

function search() {
  applied.keyword = filters.keyword;
  applied.type = filters.type;
  applied.auditResult = filters.auditResult;
  query.page = 1;
}

function resetFilter() {
  filters.keyword = "";
  filters.type = "all";
  filters.auditResult = "all";
  applied.keyword = "";
  applied.type = "all";
  applied.auditResult = "all";
  query.page = 1;
}

function onPageChange(p: number) {
  query.page = p;
}

function onPageSizeChange(size: number) {
  query.pageSize = size;
  query.page = 1;
}

/** 预留：后续接详情/跳转 */
const selectedId = ref<string | null>(null);
function onItemClick(item: NoticeItem) {
  selectedId.value = item.id;
}
</script>

<template>
  <div class="notice-center">
    <AppBreadcrumb :items="crumbs" />

    <div class="panel">
      <h1 class="page-title">通知中心</h1>

      <div class="admin-filter-bar">
        <div class="admin-filter-fields">
          <div class="admin-filter-item">
            <span class="admin-filter-label">关键字</span>
            <ElInput
              v-model="filters.keyword"
              clearable
              placeholder="请输入关键字"
              style="width: 200px"
              @keyup.enter="search"
            />
          </div>
          <div class="admin-filter-item">
            <span class="admin-filter-label">类型</span>
            <ElSelect
              v-model="filters.type"
              style="width: 280px"
            >
              <ElOption
                v-for="opt in TYPE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
          </div>
          <div class="admin-filter-item">
            <span class="admin-filter-label">审核结果</span>
            <ElSelect
              v-model="filters.auditResult"
              style="width: 120px"
            >
              <ElOption
                v-for="opt in AUDIT_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
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

      <ul class="notice-list hover-scrollbar">
        <li
          v-for="item in pageList"
          :key="item.id"
          class="notice-row"
          :class="{ 'is-active': selectedId === item.id }"
          @click="onItemClick(item)"
        >
          <p class="notice-text">
            <span class="notice-cat">[{{ NOTICE_TYPE_META[item.type].cat }}]</span>{{ NOTICE_TYPE_META[item.type].title }}：{{ item.body }}
          </p>
          <time class="notice-time">{{ item.time }}</time>
        </li>
        <li
          v-if="pageList.length === 0"
          class="notice-empty"
        >
          暂无通知
        </li>
      </ul>

      <div class="admin-pager">
        <span class="admin-pager__total">
          共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount }} 页
        </span>
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
  </div>
</template>

<style scoped>
.notice-center {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}

.notice-center > :deep(.app-breadcrumb) {
  flex: none;
}

.panel {
  box-sizing: border-box;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--white);
  box-shadow: var(--shadow);
}

.page-title {
  flex: none;
  margin: 0;
  padding: 20px 20px 4px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.notice-list {
  margin: 0;
  padding: 0 8px 8px;
  list-style: none;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.notice-row {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin: 0 12px;
  padding: 16px 8px;
  border-bottom: 1px solid var(--line-soft);
  cursor: pointer;
  transition: background-color 0.15s;
}

.notice-row:last-child {
  border-bottom: 0;
}

.notice-row:hover,
.notice-row.is-active {
  background: var(--bg);
  border-radius: 8px;
}

.notice-text {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-2);
  word-break: break-word;
}

.notice-cat {
  color: var(--text);
  font-weight: 500;
}

.notice-time {
  flex: none;
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-4);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.notice-empty {
  padding: 48px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-4);
}
</style>
