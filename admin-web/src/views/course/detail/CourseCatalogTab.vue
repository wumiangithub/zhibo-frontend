<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMessage,
  ElMessageBox,
  ElTooltip,
} from "element-plus";
import {
  ArrowDown,
  CircleCheckFilled,
  Delete,
  EditPen,
  FolderAdd,
  MoreFilled,
  Plus,
  Setting,
} from "@element-plus/icons-vue";
import {
  CATALOG_CONTENT_KIND_LABEL,
  CourseCatalogNodeType,
  listCourseCatalog,
  type CatalogNode,
  type CourseCatalogContentKindValue,
} from "@/api/course";
import emptyIllustration from "@/assets/images/course-catalog-empty.svg";
import AddLessonDrawer from "./AddLessonDrawer.vue";
import AddChapterDialog from "./AddChapterDialog.vue";
import AddSubcourseDialog from "./AddSubcourseDialog.vue";
import CatalogSortDialog from "./CatalogSortDialog.vue";
import DeleteChapterDialog from "./DeleteChapterDialog.vue";
import DeleteSubcourseDialog from "./DeleteSubcourseDialog.vue";
import SubcourseSettingsDialog from "./SubcourseSettingsDialog.vue";

const props = defineProps<{
  courseId: string;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const loading = ref(false);
const nodes = ref<CatalogNode[]>([]);
const selectedSubId = ref<number | null>(null);
/** 收起的章节 id；缺省为展开 */
const collapsedChapterIds = ref<Record<number, boolean>>({});

const addLessonOpen = ref(false);
const addLessonParentId = ref(0);
const addChapterOpen = ref(false);
const editingChapter = ref<CatalogNode | null>(null);
const addSubOpen = ref(false);
const moveRootContents = ref(false);
const editingSub = ref<CatalogNode | null>(null);
const deleteSubOpen = ref(false);
const deletingSub = ref<CatalogNode | null>(null);
const deleteChapterOpen = ref(false);
const deletingChapter = ref<CatalogNode | null>(null);
const subSettingsOpen = ref(false);
const catalogSortOpen = ref(false);

const subcourses = computed(() =>
  nodes.value.filter((n) => n.nodeType === CourseCatalogNodeType.SUBCOURSE),
);
const hasSubcourses = computed(() => subcourses.value.length > 0);
const isEmpty = computed(() => nodes.value.length === 0);

/** 当前上下文父 id：有子课用选中子课，否则根 0 */
const attachParentId = computed(() => {
  if (hasSubcourses.value) {
    return selectedSubId.value ?? subcourses.value[0]?.id ?? 0;
  }
  return 0;
});

const rootChapters = computed(() =>
  nodes.value.filter(
    (n) => n.nodeType === CourseCatalogNodeType.CHAPTER && n.parentId === 0,
  ),
);
const rootLessons = computed(() =>
  nodes.value.filter(
    (n) => n.nodeType === CourseCatalogNodeType.LESSON && n.parentId === 0,
  ),
);

/** 当前上下文下直挂章节+小节（保持 list 接口序，支持交错） */
const activeRootItems = computed(() => {
  const pid = attachParentId.value;
  if (hasSubcourses.value && selectedSubId.value == null) return [];
  return nodes.value.filter(
    (n) =>
      n.parentId === pid
      && (n.nodeType === CourseCatalogNodeType.CHAPTER
        || n.nodeType === CourseCatalogNodeType.LESSON),
  );
});

function lessonsOfChapter(chapterId: number) {
  return nodes.value.filter(
    (n) => n.nodeType === CourseCatalogNodeType.LESSON && n.parentId === chapterId,
  );
}

/** 当前上下文下小节跨层级连续序号（按根级交错序展开章内），展示时现算不落库 */
const lessonDisplayIndex = computed(() => {
  const map = new Map<number, number>();
  let seq = 0;
  for (const item of activeRootItems.value) {
    if (item.nodeType === CourseCatalogNodeType.LESSON) {
      map.set(item.id, ++seq);
    } else if (item.nodeType === CourseCatalogNodeType.CHAPTER) {
      for (const lesson of lessonsOfChapter(item.id)) {
        map.set(lesson.id, ++seq);
      }
    }
  }
  return map;
});

function formatLessonIdx(lessonId: number) {
  const n = lessonDisplayIndex.value.get(lessonId) ?? 0;
  return String(n).padStart(2, "0");
}

function contentLabel(kind?: CourseCatalogContentKindValue) {
  if (kind == null) return "--";
  return CATALOG_CONTENT_KIND_LABEL[kind] ?? String(kind);
}

function ensureSelectedSub() {
  if (!subcourses.value.length) {
    selectedSubId.value = null;
    return;
  }
  if (
    selectedSubId.value == null
    || !subcourses.value.some((s) => s.id === selectedSubId.value)
  ) {
    selectedSubId.value = subcourses.value[0].id;
  }
}

async function refresh() {
  loading.value = true;
  try {
    const data = await listCourseCatalog(props.courseId);
    nodes.value = data.list ?? [];
    ensureSelectedSub();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载目录失败");
    nodes.value = [];
  } finally {
    loading.value = false;
  }
}

function onSelectSub(id: number) {
  selectedSubId.value = id;
}

function isChapterExpanded(chapterId: number) {
  return !collapsedChapterIds.value[chapterId];
}

function toggleChapter(chapterId: number) {
  collapsedChapterIds.value = {
    ...collapsedChapterIds.value,
    [chapterId]: !collapsedChapterIds.value[chapterId],
  };
}

function onAddLesson() {
  addLessonParentId.value = attachParentId.value;
  addLessonOpen.value = true;
}

function onAddLessonToChapter(chapterId: number) {
  addLessonParentId.value = chapterId;
  addLessonOpen.value = true;
}

function onAddChapter() {
  editingChapter.value = null;
  addChapterOpen.value = true;
}

function onEditChapter(ch: CatalogNode) {
  editingChapter.value = ch;
  addChapterOpen.value = true;
}

function onDeleteChapter(ch: CatalogNode) {
  deletingChapter.value = ch;
  deleteChapterOpen.value = true;
}

function onChapterDeleted() {
  deletingChapter.value = null;
  onCatalogChanged();
}

/** 与删除章节同 parent 的兄弟章节（移动目标） */
const deletingChapterSiblings = computed(() => {
  const ch = deletingChapter.value;
  if (!ch) return [];
  return nodes.value.filter(
    (n) =>
      n.nodeType === CourseCatalogNodeType.CHAPTER
      && n.parentId === ch.parentId,
  );
});

const deletingChapterLessonCount = computed(() => {
  const ch = deletingChapter.value;
  if (!ch) return 0;
  return lessonsOfChapter(ch.id).length;
});

function onChapterMenu(command: string, ch: CatalogNode) {
  if (command === "edit") {
    onEditChapter(ch);
    return;
  }
  if (command === "delete") {
    onDeleteChapter(ch);
  }
}

async function onAddSubCourse() {
  editingSub.value = null;
  const isFirst = subcourses.value.length === 0;
  const rootHasContent = rootChapters.value.length + rootLessons.value.length > 0;
  if (isFirst && rootHasContent) {
    try {
      await ElMessageBox.confirm(
        "当前目录已有内容，添加后已有内容将默认放进该子课程中，确认继续添加吗？",
        "添加子课程",
        {
          type: "info",
          confirmButtonText: "确认",
          cancelButtonText: "取消",
        },
      );
    } catch {
      return;
    }
    moveRootContents.value = true;
  } else {
    moveRootContents.value = false;
  }
  addSubOpen.value = true;
}

function onSubSettings() {
  subSettingsOpen.value = true;
}

function onCatalogSort() {
  catalogSortOpen.value = true;
}

function onEditSub(sub: CatalogNode, e: MouseEvent) {
  e.stopPropagation();
  editingSub.value = sub;
  moveRootContents.value = false;
  addSubOpen.value = true;
}

function onDeleteSub(sub: CatalogNode, e: MouseEvent) {
  e.stopPropagation();
  deletingSub.value = sub;
  deleteSubOpen.value = true;
}

function onCatalogChanged() {
  void refresh().then(() => emit("refreshed"));
}

function onSubConfirmed(id: number) {
  selectedSubId.value = id;
  onCatalogChanged();
}

function onSubDeleted(id: number) {
  if (selectedSubId.value === id) {
    selectedSubId.value = null;
  }
  deletingSub.value = null;
  onCatalogChanged();
}

onMounted(() => {
  void refresh();
});
watch(
  () => props.courseId,
  () => {
    void refresh();
  },
);
</script>

<template>
  <div
    class="catalog-tab"
    :class="{ 'is-empty': isEmpty }"
  >
    <template v-if="isEmpty && !loading">
      <div class="catalog-empty">
        <img
          class="catalog-empty__img"
          :src="emptyIllustration"
          alt=""
        >
        <div class="catalog-empty__actions">
          <ElButton
            type="primary"
            @click="onAddLesson"
          >
            + 添加小节
          </ElButton>
          <ElButton @click="onAddChapter">
            添加章节
          </ElButton>
          <ElButton @click="onAddSubCourse">
            添加子课程
          </ElButton>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-loading="loading"
        class="catalog-body hover-scrollbar"
      >
        <div
          v-if="hasSubcourses"
          class="sub-row"
        >
          <div
            v-for="sub in subcourses"
            :key="sub.id"
            class="sub-card"
            :class="{ 'is-active': selectedSubId === sub.id }"
            role="button"
            tabindex="0"
            @click="onSelectSub(sub.id)"
            @keydown.enter.prevent="onSelectSub(sub.id)"
            @keydown.space.prevent="onSelectSub(sub.id)"
          >
            <div class="sub-cover">
              <img
                v-if="sub.coverUrl"
                :src="sub.coverUrl"
                alt=""
              >
              <span v-else>封面</span>
            </div>
            <div class="sub-meta">
              <div class="sub-title">
                {{ sub.title }}
              </div>
              <div class="sub-stats">
                章节数: {{ sub.chapterCount ?? 0 }}　小节数: {{ sub.lessonCount ?? 0 }}
              </div>
            </div>
            <div
              class="sub-card__ops"
              @click.stop
            >
              <button
                type="button"
                class="sub-card__op"
                title="编辑"
                @click="onEditSub(sub, $event)"
              >
                <ElIcon :size="14">
                  <EditPen />
                </ElIcon>
              </button>
              <button
                type="button"
                class="sub-card__op is-danger"
                title="删除"
                @click="onDeleteSub(sub, $event)"
              >
                <ElIcon :size="14">
                  <Delete />
                </ElIcon>
              </button>
            </div>
            <ElIcon
              v-if="selectedSubId === sub.id"
              class="sub-check"
              :size="18"
              aria-hidden="true"
            >
              <CircleCheckFilled />
            </ElIcon>
          </div>
          <div class="sub-row__actions">
            <ElTooltip
              content="添加子课程"
              placement="top"
            >
              <button
                type="button"
                class="sub-row__icon-btn"
                aria-label="添加子课程"
                @click="onAddSubCourse"
              >
                <ElIcon :size="18">
                  <FolderAdd />
                </ElIcon>
              </button>
            </ElTooltip>
            <ElTooltip
              content="设置"
              placement="top"
            >
              <button
                type="button"
                class="sub-row__icon-btn"
                aria-label="设置"
                @click="onSubSettings"
              >
                <ElIcon :size="18">
                  <Setting />
                </ElIcon>
              </button>
            </ElTooltip>
          </div>
        </div>

        <div class="catalog-toolbar">
          <div class="catalog-toolbar__left">
            <ElButton
              type="primary"
              @click="onAddLesson"
            >
              + 添加小节
            </ElButton>
            <ElButton @click="onAddChapter">
              添加章节
            </ElButton>
            <ElButton
              v-if="!hasSubcourses"
              @click="onAddSubCourse"
            >
              添加子课程
            </ElButton>
          </div>
          <ElButton
            class="catalog-toolbar__sort"
            @click="onCatalogSort"
          >
            排序设置
          </ElButton>
        </div>

        <div class="tree">
          <template
            v-for="item in activeRootItems"
            :key="item.id"
          >
            <div
              v-if="item.nodeType === CourseCatalogNodeType.CHAPTER"
              class="chapter"
            >
              <div class="chapter__head">
                <button
                  type="button"
                  class="chapter__toggle"
                  :aria-expanded="isChapterExpanded(item.id)"
                  :aria-label="isChapterExpanded(item.id) ? '收起章节' : '展开章节'"
                  @click="toggleChapter(item.id)"
                >
                  <ElIcon
                    class="chapter__chevron"
                    :class="{ 'is-collapsed': !isChapterExpanded(item.id) }"
                  >
                    <ArrowDown />
                  </ElIcon>
                </button>
                <div class="chapter__title-wrap">
                  <span class="chapter__title">{{ item.title }}</span>
                  <span class="chapter__count">({{ lessonsOfChapter(item.id).length }}小节)</span>
                </div>
                <div class="chapter__ops">
                  <ElTooltip
                    content="添加小节"
                    placement="top"
                  >
                    <button
                      type="button"
                      class="chapter__icon-btn"
                      aria-label="添加小节"
                      @click="onAddLessonToChapter(item.id)"
                    >
                      <ElIcon :size="16">
                        <Plus />
                      </ElIcon>
                    </button>
                  </ElTooltip>
                  <ElDropdown
                    trigger="click"
                    @command="(cmd: string) => onChapterMenu(cmd, item)"
                  >
                    <button
                      type="button"
                      class="chapter__icon-btn"
                      aria-label="更多"
                      @click.stop
                    >
                      <ElIcon :size="16">
                        <MoreFilled />
                      </ElIcon>
                    </button>
                    <template #dropdown>
                      <ElDropdownMenu>
                        <ElDropdownItem command="edit">
                          编辑
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
              </div>
              <ul
                v-show="isChapterExpanded(item.id)"
                class="lesson-list"
              >
                <li
                  v-for="lesson in lessonsOfChapter(item.id)"
                  :key="lesson.id"
                  class="lesson-item"
                >
                  <span class="lesson-idx">{{ formatLessonIdx(lesson.id) }}.</span>
                  <div class="lesson-main">
                    <div class="lesson-title">
                      {{ lesson.title }}
                    </div>
                    <span class="lesson-tag">{{ contentLabel(lesson.contentKind) }}</span>
                  </div>
                </li>
              </ul>
            </div>
            <ul
              v-else
              class="lesson-list lesson-list--root"
            >
              <li class="lesson-item">
                <span class="lesson-idx">{{ formatLessonIdx(item.id) }}.</span>
                <div class="lesson-main">
                  <div class="lesson-title">
                    {{ item.title }}
                  </div>
                  <span class="lesson-tag">{{ contentLabel(item.contentKind) }}</span>
                </div>
              </li>
            </ul>
          </template>

          <p
            v-if="!activeRootItems.length"
            class="tree-empty"
          >
            暂无章节与小节，点击上方按钮添加
          </p>
        </div>
      </div>
    </template>

    <AddLessonDrawer
      v-model="addLessonOpen"
      :course-id="props.courseId"
      :parent-id="addLessonParentId"
      @confirmed="onCatalogChanged"
    />
    <AddChapterDialog
      v-model="addChapterOpen"
      :course-id="props.courseId"
      :parent-id="attachParentId"
      :editing="editingChapter"
      @confirmed="onCatalogChanged"
    />
    <AddSubcourseDialog
      v-model="addSubOpen"
      :course-id="props.courseId"
      :move-root-contents="moveRootContents"
      :editing="editingSub"
      @confirmed="onSubConfirmed"
    />
    <DeleteChapterDialog
      v-model="deleteChapterOpen"
      :course-id="props.courseId"
      :chapter="deletingChapter"
      :sibling-chapters="deletingChapterSiblings"
      :lesson-count="deletingChapterLessonCount"
      @confirmed="onChapterDeleted"
    />
    <DeleteSubcourseDialog
      v-model="deleteSubOpen"
      :course-id="props.courseId"
      :sub="deletingSub"
      :subcourses="subcourses"
      @confirmed="onSubDeleted"
    />
    <SubcourseSettingsDialog
      v-model="subSettingsOpen"
      :course-id="props.courseId"
      :subcourses="subcourses"
      @confirmed="onCatalogChanged"
    />
    <CatalogSortDialog
      v-model="catalogSortOpen"
      :course-id="props.courseId"
      :parent-id="attachParentId"
      :nodes="nodes"
      @confirmed="onCatalogChanged"
    />
  </div>
</template>

<style scoped>
.catalog-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.catalog-tab.is-empty {
  align-items: center;
  justify-content: center;
}
.catalog-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}
.catalog-empty__img {
  width: 168px;
  height: 168px;
  display: block;
  user-select: none;
  pointer-events: none;
}
.catalog-empty__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.catalog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  margin: 0 0 16px;
}
.catalog-toolbar__left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.catalog-toolbar__sort {
  flex: none;
  margin-left: auto;
}
.catalog-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.sub-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.sub-row__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  align-self: center;
}
.sub-row__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #606266;
  cursor: pointer;
}
.sub-row__icon-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.sub-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 280px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  outline: none;
}
.sub-card.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.sub-card:hover .sub-card__ops {
  opacity: 1;
  pointer-events: auto;
}
.sub-cover {
  width: 72px;
  height: 40px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 12px;
}
.sub-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sub-meta {
  min-width: 0;
  flex: 1;
  padding-right: 52px;
}
.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-stats {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}
.sub-card__ops {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}
.sub-card__op {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
  cursor: pointer;
}
.sub-card__op:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.sub-card__op.is-danger:hover {
  color: #f56c6c;
  background: #fef0f0;
}
.sub-check {
  position: absolute;
  top: 6px;
  right: 8px;
  color: var(--color-primary);
  transition: opacity 0.12s ease;
}
.tree {
  padding-bottom: 24px;
}
.chapter {
  margin-bottom: 12px;
}
.chapter__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  padding: 10px 12px;
  background: #f5f6f8;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.chapter__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: #909399;
  cursor: pointer;
}
.chapter__toggle:hover {
  color: #606266;
}
.chapter__chevron {
  transition: transform 0.15s ease;
}
.chapter__chevron.is-collapsed {
  transform: rotate(-90deg);
}
.chapter__title-wrap {
  display: flex;
  align-items: baseline;
  min-width: 0;
  flex: 1;
}
.chapter__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chapter__count {
  margin-left: 6px;
  flex: none;
  font-weight: 400;
  color: #999;
}
.chapter__ops {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  margin-left: auto;
}
.chapter__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #606266;
  cursor: pointer;
}
.chapter__icon-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.chapter .lesson-list {
  padding: 0 12px 0 34px;
}
.lesson-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.lesson-list--root {
  margin: 0;
}
.lesson-item {
  display: flex;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.lesson-idx {
  flex: none;
  color: #999;
  font-size: 13px;
}
.lesson-main {
  min-width: 0;
}
.lesson-title {
  font-size: 13px;
  color: #303133;
}
.lesson-tag {
  display: inline-block;
  margin-top: 4px;
  padding: 0 6px;
  font-size: 12px;
  color: #666;
  background: #f5f6f8;
  border-radius: 3px;
}
.tree-empty {
  margin: 24px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
