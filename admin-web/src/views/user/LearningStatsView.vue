<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTimePicker,
} from "element-plus";
import {
  formatLearnDurationSec,
  listLearningCourses,
  listLearningSummary,
  parseHhMmSsToSec,
  type LearnDurationOp,
  type LearningCourseItem,
  type LearningSummaryItem,
  type ViewerKeywordType,
  type ViewerTagMatch,
} from "@/api/viewer";
import { listViewerTags, type ViewerTagItem } from "@/api/viewerTag";
import { exportLearningCourseRows, exportLearningSummaryRows } from "./exportLearningRows";

type TabKey = "summary" | "courses";

const activeTab = ref<TabKey>("summary");
const loading = ref(false);
const filterTags = ref<ViewerTagItem[]>([]);

const summaryRows = ref<LearningSummaryItem[]>([]);
const summaryTotal = ref(0);
const summarySelected = ref<LearningSummaryItem[]>([]);
const summaryPage = ref(1);
const summaryPageSize = ref(10);
const summarySort = ref<string | undefined>();
const summaryOrder = ref<"asc" | "desc" | undefined>();

const courseRows = ref<LearningCourseItem[]>([]);
const courseTotal = ref(0);
const courseSelected = ref<LearningCourseItem[]>([]);
const coursePage = ref(1);
const coursePageSize = ref(10);

const summaryFilters = reactive({
  keywordType: "nickname" as ViewerKeywordType,
  keyword: "",
  tagMatch: "any" as ViewerTagMatch,
  tagIds: [] as number[],
  learnDurationOp: "gt" as LearnDurationOp,
  /** TimePicker 绑定 Date；空则不按时长筛 */
  learnDurationTime: undefined as Date | undefined,
});

const courseFilters = reactive({
  keywordType: "nickname" as ViewerKeywordType,
  keyword: "",
  tagMatch: "any" as ViewerTagMatch,
  tagIds: [] as number[],
});

const keywordPlaceholder: Record<ViewerKeywordType, string> = {
  nickname: "请输入用户昵称",
  id: "请输入用户ID",
  phone: "请输入手机号",
};

function timeToSec(d: Date | undefined): number | undefined {
  if (!d) return undefined;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const sec = parseHhMmSsToSec(`${hh}:${mm}:${ss}`);
  return sec == null ? undefined : sec;
}

async function loadFilterTags() {
  try {
    const res = await listViewerTags({ page: 1, pageSize: 100 });
    filterTags.value = res.list ?? [];
  } catch {
    filterTags.value = [];
  }
}

async function fetchSummary() {
  loading.value = true;
  try {
    const durationSec = timeToSec(summaryFilters.learnDurationTime);
    const res = await listLearningSummary({
      page: summaryPage.value,
      pageSize: summaryPageSize.value,
      keywordType: summaryFilters.keywordType,
      keyword: summaryFilters.keyword.trim() || undefined,
      tagMatch: summaryFilters.tagMatch,
      tagIds: summaryFilters.tagIds.length ? [...summaryFilters.tagIds] : undefined,
      learnDurationOp: durationSec != null ? summaryFilters.learnDurationOp : undefined,
      learnDurationSec: durationSec,
      sort: summarySort.value,
      order: summaryOrder.value,
    });
    summaryRows.value = (res.list ?? []).map((row) => ({
      ...row,
      tagIds: row.tagIds ?? [],
      tagLabels: row.tagLabels ?? [],
    }));
    summaryTotal.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function fetchCourses() {
  loading.value = true;
  try {
    const res = await listLearningCourses({
      page: coursePage.value,
      pageSize: coursePageSize.value,
      keywordType: courseFilters.keywordType,
      keyword: courseFilters.keyword.trim() || undefined,
      tagMatch: courseFilters.tagMatch,
      tagIds: courseFilters.tagIds.length ? [...courseFilters.tagIds] : undefined,
    });
    courseRows.value = (res.list ?? []).map((row) => ({
      ...row,
      tagIds: row.tagIds ?? [],
      tagLabels: row.tagLabels ?? [],
    }));
    courseTotal.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function fetchCurrent() {
  if (activeTab.value === "summary") {
    void fetchSummary();
  } else {
    void fetchCourses();
  }
}

function onTabChange(tab: TabKey) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  fetchCurrent();
}

function onSearch() {
  if (activeTab.value === "summary") {
    summaryPage.value = 1;
    void fetchSummary();
  } else {
    coursePage.value = 1;
    void fetchCourses();
  }
}

function onReset() {
  if (activeTab.value === "summary") {
    summaryFilters.keywordType = "nickname";
    summaryFilters.keyword = "";
    summaryFilters.tagMatch = "any";
    summaryFilters.tagIds = [];
    summaryFilters.learnDurationOp = "gt";
    summaryFilters.learnDurationTime = undefined;
    summarySort.value = undefined;
    summaryOrder.value = undefined;
    summaryPage.value = 1;
    void fetchSummary();
  } else {
    courseFilters.keywordType = "nickname";
    courseFilters.keyword = "";
    courseFilters.tagMatch = "any";
    courseFilters.tagIds = [];
    coursePage.value = 1;
    void fetchCourses();
  }
}

function onExport() {
  if (activeTab.value === "summary") {
    if (!summarySelected.value.length) {
      ElMessage.warning("请先勾选要导出的行");
      return;
    }
    exportLearningSummaryRows(summarySelected.value);
    return;
  }
  if (!courseSelected.value.length) {
    ElMessage.warning("请先勾选要导出的行");
    return;
  }
  exportLearningCourseRows(courseSelected.value);
}

function onSummarySortChange(payload: { prop: string; order: string | null }) {
  if (!payload.order) {
    summarySort.value = undefined;
    summaryOrder.value = undefined;
  } else {
    summarySort.value = payload.prop;
    summaryOrder.value = payload.order === "ascending" ? "asc" : "desc";
  }
  void fetchSummary();
}

watch([summaryPage, summaryPageSize], () => {
  if (activeTab.value === "summary") void fetchSummary();
});
watch([coursePage, coursePageSize], () => {
  if (activeTab.value === "courses") void fetchCourses();
});

onMounted(async () => {
  await loadFilterTags();
  void fetchSummary();
});
</script>

<template>
  <div class="learning-stats">
    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'summary' }"
        @click="onTabChange('summary')"
      >
        汇总数据
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'courses' }"
        @click="onTabChange('courses')"
      >
        课程数据
      </button>
    </div>

    <!-- 汇总筛选 -->
    <div
      v-if="activeTab === 'summary'"
      class="filter-bar"
    >
      <div class="filter-item">
        <span class="filter-label">用户关键字</span>
        <ElSelect
          v-model="summaryFilters.keywordType"
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
          v-model="summaryFilters.keyword"
          clearable
          :placeholder="keywordPlaceholder[summaryFilters.keywordType]"
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">标签</span>
        <ElSelect
          v-model="summaryFilters.tagMatch"
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
          v-model="summaryFilters.tagIds"
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
        <span class="filter-label">累计学习时长</span>
        <ElSelect
          v-model="summaryFilters.learnDurationOp"
          style="width: 110px"
        >
          <ElOption
            label="大于"
            value="gt"
          />
          <ElOption
            label="小于等于"
            value="lte"
          />
        </ElSelect>
        <ElTimePicker
          v-model="summaryFilters.learnDurationTime"
          clearable
          placeholder="请选择"
          style="width: 140px"
        />
      </div>
      <ElButton @click="onReset">重置</ElButton>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <!-- 课程筛选 -->
    <div
      v-else
      class="filter-bar"
    >
      <div class="filter-item">
        <span class="filter-label">用户关键字</span>
        <ElSelect
          v-model="courseFilters.keywordType"
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
          v-model="courseFilters.keyword"
          clearable
          :placeholder="keywordPlaceholder[courseFilters.keywordType]"
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">标签</span>
        <ElSelect
          v-model="courseFilters.tagMatch"
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
          v-model="courseFilters.tagIds"
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
      <ElButton @click="onReset">重置</ElButton>
      <ElButton
        type="primary"
        @click="onSearch"
      >
        查询
      </ElButton>
    </div>

    <div class="toolbar">
      <ElButton @click="onExport">导出</ElButton>
    </div>

    <div class="table-wrap">
      <ElTable
        v-if="activeTab === 'summary'"
        v-loading="loading"
        :data="summaryRows"
        row-key="id"
        height="100%"
        empty-text="暂无数据"
        @selection-change="(rows: LearningSummaryItem[]) => (summarySelected = rows)"
        @sort-change="onSummarySortChange"
      >
        <ElTableColumn
          type="selection"
          width="48"
          fixed
        />
        <ElTableColumn
          label="用户"
          min-width="180"
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
              <span class="user-name">{{ row.nickname }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="用户ID"
          prop="id"
          width="100"
        />
        <ElTableColumn
          label="标签"
          min-width="160"
        >
          <template #default="{ row }">
            <div
              v-if="row.tagLabels?.length"
              class="tag-line"
            >
              <span
                v-for="(name, i) in row.tagLabels"
                :key="`${row.id}-${i}`"
                class="tag-pill"
              >{{ name }}</span>
            </div>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="累计学习时长"
          prop="totalLearnDuration"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatLearnDurationSec(row.totalLearnDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="累计学习天数"
          prop="totalLearnDays"
          min-width="130"
          sortable="custom"
        />
        <ElTableColumn
          label="观看课程数"
          prop="viewedCourseCount"
          min-width="120"
          sortable="custom"
        />
        <ElTableColumn
          label="完成课程数"
          prop="completedCourseCount"
          min-width="120"
          sortable="custom"
        />
      </ElTable>

      <ElTable
        v-else
        v-loading="loading"
        :data="courseRows"
        row-key="id"
        height="100%"
        empty-text="暂无数据"
        @selection-change="(rows: LearningCourseItem[]) => (courseSelected = rows)"
      >
        <ElTableColumn
          type="selection"
          width="48"
          fixed
        />
        <ElTableColumn
          label="用户"
          min-width="180"
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
              <span class="user-name">{{ row.nickname }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="用户ID"
          prop="viewerId"
          width="100"
        />
        <ElTableColumn
          label="课程名称"
          prop="courseName"
          min-width="200"
          show-overflow-tooltip
        />
        <ElTableColumn
          label="标签"
          min-width="140"
        >
          <template #default="{ row }">
            <div
              v-if="row.tagLabels?.length"
              class="tag-line"
            >
              <span
                v-for="(name, i) in row.tagLabels"
                :key="`${row.id}-t-${i}`"
                class="tag-pill"
              >{{ name }}</span>
            </div>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="累计学习时长"
          min-width="130"
        >
          <template #default="{ row }">
            {{ formatLearnDurationSec(row.totalLearnDurationSec) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="学习进度"
          width="100"
        >
          <template #default="{ row }">
            {{ row.progressPercent ?? 0 }}%
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="首次学习时间"
          prop="firstLearnTime"
          min-width="170"
        />
        <ElTableColumn
          label="完成时间"
          prop="completedTime"
          min-width="170"
        />
        <ElTableColumn
          label="课程类型"
          prop="courseType"
          width="100"
        />
        <ElTableColumn
          label="课程资源时长"
          min-width="130"
        >
          <template #default="{ row }">
            {{ formatLearnDurationSec(row.courseDurationSec) }}
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div
      v-if="activeTab === 'summary'"
      class="pager"
    >
      <span class="pager-total">共{{ summaryTotal }}条记录</span>
      <ElPagination
        v-model:current-page="summaryPage"
        v-model:page-size="summaryPageSize"
        background
        layout="prev, pager, next, sizes, jumper"
        :total="summaryTotal"
        :page-sizes="[10, 20, 50]"
      />
    </div>
    <div
      v-else
      class="pager"
    >
      <span class="pager-total">共{{ courseTotal }}条记录</span>
      <ElPagination
        v-model:current-page="coursePage"
        v-model:page-size="coursePageSize"
        background
        layout="prev, pager, next, sizes, jumper"
        :total="courseTotal"
        :page-sizes="[10, 20, 50]"
      />
    </div>
  </div>
</template>

<style scoped>
.learning-stats {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.tabs {
  display: flex;
  flex: none;
  gap: 24px;
  border-bottom: 1px solid #ebebeb;
}
.tab {
  position: relative;
  padding: 0 0 10px;
  border: 0;
  background: transparent;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}
.tab.active {
  color: var(--color-primary, #1677ff);
  font-weight: 600;
}
.tab.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--color-primary, #1677ff);
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
  display: inline-block;
  background: #e8e8e8;
}
.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
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
