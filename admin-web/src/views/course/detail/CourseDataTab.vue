<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import {
  ElButton,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  CATALOG_CONTENT_KIND_LABEL,
  COURSE_ANALYTICS_ENTITLEMENT_LABEL,
  COURSE_ANALYTICS_PARTICIPATE_LABEL,
  exportCourseAnalyticsLessons,
  exportCourseAnalyticsUsers,
  listCourseAnalyticsLessons,
  listCourseAnalyticsUserLessons,
  listCourseAnalyticsUsers,
  type CourseAnalyticsLessonItem,
  type CourseAnalyticsLessonSortBy,
  type CourseAnalyticsUserItem,
  type CourseAnalyticsUserLessonItem,
  type CourseAnalyticsUserLessonListResult,
  type CourseCatalogContentKindValue,
} from "@/api/course";

const props = defineProps<{ courseId: string }>();

type LearningSub = "lessons" | "users";
type DataView = "list" | "progress";

const route = useRoute();
const router = useRouter();

const learningSub = ref<LearningSub>("lessons");
const dataView = ref<DataView>("list");

const keywordType = ref("nickname");
const keyword = ref("");
const appliedKeyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const lessonLoading = ref(false);
const lessonRows = ref<CourseAnalyticsLessonItem[]>([]);
const sortBy = ref<CourseAnalyticsLessonSortBy | "">("");
const sortOrder = ref<"asc" | "desc" | "">("");

const userLoading = ref(false);
const userRows = ref<CourseAnalyticsUserItem[]>([]);

const progressLoading = ref(false);
const progressUsername = ref<string | null>(null);
const progressSummary = ref<CourseAnalyticsUserLessonListResult | null>(null);
const progressRows = ref<CourseAnalyticsUserLessonItem[]>([]);

function syncFromRoute() {
  const sub = String(route.query.sub ?? "");
  if (sub === "progress") {
    dataView.value = "progress";
    learningSub.value = "users";
    const name = String(route.query.username ?? "").trim();
    progressUsername.value = name || null;
    return;
  }
  dataView.value = "list";
  learningSub.value = sub === "users" ? "users" : "lessons";
}

watch(
  () => [route.query.sub, route.query.username],
  () => syncFromRoute(),
  { immediate: true },
);

function replaceQuery(patch: Record<string, string | undefined>) {
  const query: Record<string, string> = { tab: "data" };
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && v !== "") query[k] = v;
  }
  void router.replace({ path: route.path, query });
}

function setLearningSub(sub: LearningSub) {
  if (learningSub.value === sub && dataView.value === "list") return;
  learningSub.value = sub;
  dataView.value = "list";
  page.value = 1;
  replaceQuery({ sub: sub === "lessons" ? undefined : sub });
}

function openProgress(row: CourseAnalyticsUserItem) {
  progressUsername.value = row.username;
  dataView.value = "progress";
  page.value = 1;
  replaceQuery({ sub: "progress", username: row.username });
}

function backFromProgress() {
  dataView.value = "list";
  learningSub.value = "users";
  progressUsername.value = null;
  progressSummary.value = null;
  progressRows.value = [];
  page.value = 1;
  replaceQuery({ sub: "users" });
}

function formatRate(n: number) {
  return `${Number(n ?? 0).toFixed(1)}%`;
}

function formatDuration(secRaw: number) {
  const sec = Math.max(0, Math.floor(secRaw || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}小时${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function contentKindLabel(kind?: number) {
  if (kind == null) return "—";
  return CATALOG_CONTENT_KIND_LABEL[kind as CourseCatalogContentKindValue] ?? String(kind);
}

function participateDotClass(status: number) {
  if (status === 2) return "dot--green";
  if (status === 1) return "dot--yellow";
  return "dot--grey";
}

function entitlementDotClass(state: string) {
  if (state === "valid") return "dot--green";
  return "dot--grey";
}

async function fetchLessons() {
  if (!props.courseId) return;
  lessonLoading.value = true;
  try {
    const data = await listCourseAnalyticsLessons(props.courseId, {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value || undefined,
      sortOrder: sortOrder.value || undefined,
    });
    lessonRows.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    lessonRows.value = [];
    total.value = 0;
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    lessonLoading.value = false;
  }
}

async function fetchUsers() {
  if (!props.courseId) return;
  userLoading.value = true;
  try {
    const data = await listCourseAnalyticsUsers(props.courseId, {
      page: page.value,
      pageSize: pageSize.value,
      keywordType: keywordType.value,
      keyword: appliedKeyword.value,
    });
    userRows.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    userRows.value = [];
    total.value = 0;
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    userLoading.value = false;
  }
}

async function fetchProgress() {
  if (!props.courseId || !progressUsername.value) {
    progressRows.value = [];
    progressSummary.value = null;
    total.value = 0;
    return;
  }
  progressLoading.value = true;
  try {
    const data = await listCourseAnalyticsUserLessons(props.courseId, {
      username: progressUsername.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    progressSummary.value = data;
    progressRows.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    progressRows.value = [];
    progressSummary.value = null;
    total.value = 0;
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    progressLoading.value = false;
  }
}

function onLessonSortChange(payload: { prop: string | null; order: string | null }) {
  const map: Record<string, CourseAnalyticsLessonSortBy> = {
    participateCount: "participateCount",
    participateRate: "participateRate",
    completeCount: "completeCount",
    completeRate: "completeRate",
  };
  const key = payload.prop ? map[payload.prop] : undefined;
  if (!key || !payload.order) {
    sortBy.value = "";
    sortOrder.value = "";
  } else {
    sortBy.value = key;
    sortOrder.value = payload.order === "ascending" ? "asc" : "desc";
  }
  page.value = 1;
  void fetchLessons();
}

function onSearch() {
  appliedKeyword.value = keyword.value.trim();
  page.value = 1;
  void fetchUsers();
}

async function onExport() {
  try {
    if (dataView.value === "list" && learningSub.value === "lessons") {
      await exportCourseAnalyticsLessons(props.courseId, {
        sortBy: sortBy.value || undefined,
        sortOrder: sortOrder.value || undefined,
      });
      ElMessage.success("已开始下载");
      return;
    }
    if (dataView.value === "list" && learningSub.value === "users") {
      await exportCourseAnalyticsUsers(props.courseId, {
        keywordType: keywordType.value,
        keyword: appliedKeyword.value,
      });
      ElMessage.success("已开始下载");
      return;
    }
    ElMessage.info("进度详情页不支持导出");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  }
}

const progressNickname = computed(
  () => progressSummary.value?.nickname || `用户 ${progressUsername.value ?? ""}`,
);

watch(
  () =>
    [
      props.courseId,
      learningSub.value,
      dataView.value,
      page.value,
      pageSize.value,
      progressUsername.value,
    ] as const,
  () => {
    if (dataView.value === "progress") {
      void fetchProgress();
      return;
    }
    if (learningSub.value === "lessons") void fetchLessons();
    else void fetchUsers();
  },
  { immediate: true },
);
</script>

<template>
  <div class="course-data-tab">
    <div
      v-if="dataView === 'list'"
      class="primary-tabs"
    >
      <button
        type="button"
        class="primary-tab is-active"
      >
        学习数据
      </button>
      <button
        type="button"
        class="primary-tab is-disabled"
        disabled
        title="交易数据下一期再做"
      >
        交易数据
      </button>
    </div>

    <div
      v-if="dataView === 'list'"
      class="toolbar"
    >
      <div class="sub-tabs">
        <button
          type="button"
          class="sub-tab"
          :class="{ 'is-active': learningSub === 'lessons' }"
          @click="setLearningSub('lessons')"
        >
          小节概况
        </button>
        <button
          type="button"
          class="sub-tab"
          :class="{ 'is-active': learningSub === 'users' }"
          @click="setLearningSub('users')"
        >
          用户详情
        </button>
      </div>

      <div class="toolbar-right">
        <template v-if="learningSub === 'users'">
          <ElSelect
            v-model="keywordType"
            class="kw-type"
          >
            <ElOption
              label="昵称"
              value="nickname"
            />
          </ElSelect>
          <ElInput
            v-model="keyword"
            class="kw-input"
            clearable
            placeholder="请输入学员昵称"
            @keyup.enter="onSearch"
          />
          <ElButton
            type="primary"
            @click="onSearch"
          >
            查询
          </ElButton>
        </template>
        <ElButton @click="onExport">
          导出
        </ElButton>
      </div>
    </div>

    <div
      v-else
      class="progress-head"
    >
      <button
        type="button"
        class="back-link"
        @click="backFromProgress"
      >
        <ElIcon :size="14">
          <ArrowLeft />
        </ElIcon>
        返回
      </button>
      <div class="progress-user">
        <img
          v-if="progressSummary?.avatarUrl"
          :src="progressSummary.avatarUrl"
          alt=""
          class="avatar-img"
        >
        <span
          v-else
          class="avatar-fallback"
        >{{ progressNickname.slice(0, 1) }}</span>
        <span class="progress-name">{{ progressNickname }}</span>
      </div>
      <div class="progress-summary">
        <span class="summary-label">用户小节进度</span>
        <span>小节完成数 <strong>{{ progressSummary?.completedLessonCount ?? 0 }}</strong></span>
        <span>小节完成率 <strong>{{ formatRate(progressSummary?.lessonCompletionRate ?? 0) }}</strong></span>
      </div>
    </div>

    <ElTable
      v-if="dataView === 'list' && learningSub === 'lessons'"
      v-loading="lessonLoading"
      :data="lessonRows"
      class="data-table hover-scrollbar"
      empty-text="暂无小节（目录无小节或尚未产生学习数据）"
      @sort-change="onLessonSortChange"
    >
      <ElTableColumn
        prop="title"
        label="小节名称"
        min-width="280"
      />
      <ElTableColumn
        prop="participateCount"
        label="参与人数"
        width="120"
        sortable="custom"
      />
      <ElTableColumn
        prop="participateRate"
        label="参与率"
        width="120"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatRate(row.participateRate) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        prop="completeCount"
        label="完成人数"
        width="120"
        sortable="custom"
      />
      <ElTableColumn
        prop="completeRate"
        label="完成率"
        width="120"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatRate(row.completeRate) }}
        </template>
      </ElTableColumn>
    </ElTable>

    <ElTable
      v-else-if="dataView === 'list' && learningSub === 'users'"
      v-loading="userLoading"
      :data="userRows"
      class="data-table hover-scrollbar"
      empty-text="暂无学员"
    >
      <ElTableColumn
        label="用户"
        min-width="180"
      >
        <template #default="{ row }">
          <div class="user-cell">
            <img
              v-if="row.avatarUrl"
              :src="row.avatarUrl"
              alt=""
              class="avatar-img sm"
            >
            <span
              v-else
              class="avatar-fallback sm"
            >{{ (row.nickname || "?").slice(0, 1) }}</span>
            <span>{{ row.nickname }}</span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="课程参与状态"
        width="130"
      >
        <template #default="{ row }">
          <span class="status-cell">
            <i
              class="dot"
              :class="participateDotClass(row.participateStatus)"
            />
            {{ COURSE_ANALYTICS_PARTICIPATE_LABEL[row.participateStatus] ?? "—" }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        prop="completedLessonCount"
        label="小节完成数"
        width="110"
      />
      <ElTableColumn
        label="小节完成率"
        width="110"
      >
        <template #default="{ row }">
          {{ formatRate(row.lessonCompletionRate) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="累计学习时长"
        width="160"
      >
        <template #default="{ row }">
          {{ formatDuration(row.learnDurationSec) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="课程权益状态"
        width="120"
      >
        <template #default="{ row }">
          <span class="status-cell">
            <i
              class="dot"
              :class="entitlementDotClass(row.entitlementDisplay)"
            />
            {{ COURSE_ANALYTICS_ENTITLEMENT_LABEL[row.entitlementDisplay] ?? "—" }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="操作"
        width="100"
        fixed="right"
      >
        <template #default="{ row }">
          <button
            type="button"
            class="op-link"
            @click="openProgress(row as CourseAnalyticsUserItem)"
          >
            进度详情
          </button>
        </template>
      </ElTableColumn>
    </ElTable>

    <template v-else>
      <h3 class="section-title">
        用户小节详情
      </h3>
      <ElTable
        v-loading="progressLoading"
        :data="progressRows"
        class="data-table hover-scrollbar"
        empty-text="暂无小节进度"
      >
        <ElTableColumn
          prop="title"
          label="小节名称"
          min-width="260"
        />
        <ElTableColumn
          label="类型"
          width="90"
        >
          <template #default="{ row }">
            {{ contentKindLabel(row.contentKind) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="参与状态"
          width="120"
        >
          <template #default="{ row }">
            <span class="status-cell">
              <i
                class="dot"
                :class="participateDotClass(row.participateStatus)"
              />
              {{ COURSE_ANALYTICS_PARTICIPATE_LABEL[row.participateStatus] ?? "—" }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="累计学习时长"
          width="160"
        >
          <template #default="{ row }">
            {{ formatDuration(row.learnDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="学习进度条时长"
          width="150"
        >
          <template #default="{ row }">
            {{
              row.progressBarSec == null ? "--" : formatDuration(row.progressBarSec)
            }}
          </template>
        </ElTableColumn>
      </ElTable>
    </template>

    <div class="pager">
      <span class="pager-total">共 {{ total }} 条记录 第 {{ page }}/{{ Math.max(1, Math.ceil(total / pageSize) || 1) }} 页</span>
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="sizes, prev, pager, next, jumper"
        background
      />
    </div>
  </div>
</template>

<style scoped>
.course-data-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.primary-tabs {
  display: flex;
  gap: 28px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
  flex: none;
}
.primary-tab {
  position: relative;
  padding: 0 0 12px;
  border: 0;
  background: transparent;
  font-size: 15px;
  color: #666;
  cursor: pointer;
}
.primary-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
}
.primary-tab.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--color-primary);
}
.primary-tab.is-disabled {
  color: #bfbfbf;
  cursor: not-allowed;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex: none;
}
.sub-tabs {
  display: inline-flex;
  gap: 0;
}
.sub-tab {
  position: relative;
  padding: 6px 14px;
  margin-left: -1px;
  border: 1px solid #d9d9d9;
  border-radius: 0;
  background: #fff;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}
.sub-tab:first-child {
  margin-left: 0;
  border-radius: 4px 0 0 4px;
}
.sub-tab:last-child {
  border-radius: 0 4px 4px 0;
}
.sub-tab.is-active {
  z-index: 1;
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}
.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.kw-type {
  width: 100px;
}
.kw-input {
  width: 200px;
}
.progress-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  flex: none;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.progress-user,
.user-cell,
.status-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-cell {
  gap: 8px;
}
.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-img.sm,
.avatar-fallback.sm {
  width: 28px;
  height: 28px;
  font-size: 12px;
}
.avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e6f4ff;
  color: var(--color-primary);
  font-size: 14px;
  flex: none;
}
.progress-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.progress-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  padding: 12px 16px;
  background: #fafbfc;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
}
.summary-label {
  font-weight: 600;
  color: #333;
}
.progress-summary strong {
  color: #1a1a1a;
  font-weight: 600;
  margin-left: 4px;
}
.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  flex: none;
}
.data-table {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.op-link {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #bfbfbf;
  flex: none;
}
.dot--green {
  background: var(--color-success, #52c41a);
}
.dot--yellow {
  background: #faad14;
}
.dot--grey {
  background: #bfbfbf;
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  flex: none;
}
.pager-total {
  font-size: 13px;
  color: #666;
  margin-right: auto;
}
</style>
