<script setup lang="ts">
/**
 * 通知中心二级页：接真 list / read。
 */
import { onMounted, reactive, ref } from "vue";
import { ElInput, ElMessageBox, ElOption, ElPagination, ElSelect } from "element-plus";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import {
  listNotifications,
  readAllNotifications,
  readNotification,
  type NotificationItem,
} from "@/api/notifications";
import { ApiError } from "@/api/http";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

const crumbs: AppBreadcrumbItem[] = [
  { label: "工作台", to: "/" },
  { label: "通知中心" },
];

const TYPE_OPTIONS: { label: string; value: number }[] = [
  { label: "全部", value: 0 },
  { label: "【直播】状态异常通知", value: 1 },
  { label: "【直播报备】合规风控审核结果通知", value: 2 },
  { label: "【直播】合规风控审核结果通知", value: 3 },
  { label: "【素材库】合规风控审核结果通知", value: 4 },
];

const AUDIT_OPTIONS = [
  { label: "全部", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已驳回", value: 2 },
] as const;

const filters = reactive({
  keyword: "",
  type: 0,
  auditResult: 0,
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

const list = ref<NotificationItem[]>([]);
const total = ref(0);
const loading = ref(false);
const readAllLoading = ref(false);
const selectedId = ref<string | null>(null);

const ADMIN_NOTIFICATIONS_CHANGED = "admin-notifications-changed";

const pageCount = () => Math.max(1, Math.ceil(total.value / query.pageSize));

async function loadList() {
  if (loading.value) return;
  loading.value = true;
  try {
    const data = await listNotifications({
      page: query.page,
      pageSize: query.pageSize,
      keyword: filters.keyword.trim() || undefined,
      type: filters.type || undefined,
      auditResult: filters.auditResult || undefined,
    });
    list.value = data.list ?? [];
    total.value = Number(data.total) || 0;
    query.page = data.page ?? query.page;
    query.pageSize = data.pageSize ?? query.pageSize;
  } catch (e) {
    list.value = [];
    total.value = 0;
    const msg = e instanceof ApiError ? e.message : "通知加载失败";
    toast(msg);
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadList();
}

function resetFilter() {
  filters.keyword = "";
  filters.type = 0;
  filters.auditResult = 0;
  query.page = 1;
  void loadList();
}

function onPageChange(p: number) {
  query.page = p;
  void loadList();
}

function onPageSizeChange(size: number) {
  query.pageSize = size;
  query.page = 1;
  void loadList();
}

async function onItemClick(item: NotificationItem) {
  selectedId.value = item.id;
  if (!item.unread) return;
  try {
    await readNotification(item.id);
    item.unread = false;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "标记已读失败";
    toast(msg);
  }
}

async function onReadAll() {
  try {
    await ElMessageBox.confirm("确定将全部通知标为已读？", "全部已读", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }
  if (readAllLoading.value) return;
  readAllLoading.value = true;
  try {
    await readAllNotifications();
    toast("已全部标为已读");
    void loadList();
    window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_CHANGED));
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "全部已读失败";
    toast(msg);
  } finally {
    readAllLoading.value = false;
  }
}

onMounted(() => {
  void loadList();
});
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
        <button
          type="button"
          class="notice-read-all-link"
          :disabled="readAllLoading"
          @click="onReadAll"
        >
          全部已读
        </button>
      </div>

      <ul class="notice-list hover-scrollbar">
        <li
          v-for="item in list"
          :key="item.id"
          class="notice-row"
          :class="{ 'is-active': selectedId === item.id, 'is-unread': item.unread }"
          @click="onItemClick(item)"
        >
          <p class="notice-text">
            <span class="notice-cat">[{{ item.category }}]</span>{{ item.title }}：{{ item.body }}
          </p>
          <time class="notice-time">{{ item.createdTime }}</time>
        </li>
        <li
          v-if="!loading && list.length === 0"
          class="notice-empty"
        >
          暂无通知
        </li>
      </ul>

      <div class="admin-pager">
        <span class="admin-pager__total">
          共 {{ total }} 条记录 第 {{ query.page }}/{{ pageCount() }} 页
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

.notice-read-all-link {
  margin-left: auto;
  flex: none;
  border: 0;
  padding: 0;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--primary);
  cursor: pointer;
  outline: none;
  white-space: nowrap;
}

.notice-read-all-link:hover:not(:disabled) {
  color: var(--primary-hover);
  text-decoration: underline;
}

.notice-read-all-link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
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

.notice-row.is-unread .notice-text {
  color: var(--text);
  font-weight: 500;
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
