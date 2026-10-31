<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElButton, ElDialog, ElIcon, ElMessage, ElSwitch } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import Sortable from "sortablejs";
import {
  CATALOG_CONTENT_KIND_LABEL,
  CourseCatalogNodeType,
  reorderCourseCatalog,
  type CatalogNode,
  type CourseCatalogContentKindValue,
} from "@/api/course";
import dragGripIcon from "@/assets/icons/drag-grip.svg?raw";

const props = defineProps<{
  courseId: string;
  parentId: number;
  /** 整课目录扁平节点（已按接口序） */
  nodes: CatalogNode[];
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

type SortTab = "chapters" | "lessons";

type ChapterModeRow = CatalogNode;

type LessonRootRow =
  | { kind: "lesson"; node: CatalogNode }
  | { kind: "chapter"; node: CatalogNode; lessons: CatalogNode[] };

const tab = ref<SortTab>("chapters");
const expandChapters = ref(true);
const submitting = ref(false);

const chapterRows = ref<ChapterModeRow[]>([]);
const lessonRoots = ref<LessonRootRow[]>([]);

const chapterListRef = ref<HTMLElement | null>(null);
const lessonRootRef = ref<HTMLElement | null>(null);
let chapterSortable: Sortable | null = null;
const nestedSortables: Sortable[] = [];
let lessonRootSortable: Sortable | null = null;

const contextChapters = computed(() =>
  props.nodes.filter(
    (n) => n.nodeType === CourseCatalogNodeType.CHAPTER && n.parentId === props.parentId,
  ),
);

function lessonsOfChapter(chapterId: number, source: CatalogNode[] = props.nodes) {
  return source.filter(
    (n) => n.nodeType === CourseCatalogNodeType.LESSON && n.parentId === chapterId,
  );
}

function contentLabel(kind?: CourseCatalogContentKindValue) {
  if (kind == null) return "--";
  return CATALOG_CONTENT_KIND_LABEL[kind] ?? String(kind);
}

function padIdx(n: number) {
  return String(n).padStart(2, "0");
}

/** 小节排序：可见与折叠隐藏的小节均占号（与 mock3 跳号一致） */
const lessonIndexMap = computed(() => {
  const map = new Map<number, number>();
  let seq = 0;
  for (const row of lessonRoots.value) {
    if (row.kind === "lesson") {
      map.set(row.node.id, ++seq);
    } else {
      for (const lesson of row.lessons) {
        map.set(lesson.id, ++seq);
      }
    }
  }
  return map;
});

/** 拖拽时用 fallback 克隆挂到 body，避免列表/弹窗被撑高出现滚动条闪烁 */
const sortableDragOpts = {
  forceFallback: true,
  fallbackOnBody: true,
  fallbackTolerance: 5,
  animation: 150,
  ghostClass: "cat-sort__ghost",
  chosenClass: "cat-sort__chosen",
  dragClass: "cat-sort__fallback",
} as const;

function setDialogDragging(on: boolean) {
  const body = document.querySelector(
    ".catalog-sort-dialog .el-dialog__body",
  ) as HTMLElement | null;
  body?.classList.toggle("is-dragging", on);
}

function destroySortables() {
  setDialogDragging(false);
  chapterSortable?.destroy();
  chapterSortable = null;
  lessonRootSortable?.destroy();
  lessonRootSortable = null;
  while (nestedSortables.length) {
    nestedSortables.pop()?.destroy();
  }
}

function initChapterSortable() {
  destroySortables();
  if (!chapterListRef.value || chapterRows.value.length < 2) return;
  chapterSortable = Sortable.create(chapterListRef.value, {
    ...sortableDragOpts,
    handle: ".cat-sort__drag",
    onStart() {
      setDialogDragging(true);
    },
    onEnd(evt) {
      setDialogDragging(false);
      const { oldIndex, newIndex } = evt;
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      const rows = chapterRows.value;
      const [moved] = rows.splice(oldIndex, 1);
      if (moved == null) return;
      rows.splice(newIndex, 0, moved);
    },
  });
}

function syncLessonRootsFromDom() {
  const root = lessonRootRef.value;
  if (!root) return;
  const byId = new Map(props.nodes.map((n) => [n.id, n]));
  const next: LessonRootRow[] = [];
  for (const el of Array.from(root.children) as HTMLElement[]) {
    const id = Number(el.dataset.id);
    const kind = el.dataset.kind;
    const node = byId.get(id);
    if (!node) continue;
    if (kind === "lesson") {
      next.push({ kind: "lesson", node: { ...node, parentId: props.parentId } });
      continue;
    }
    if (kind === "chapter") {
      const nested = el.querySelector(".cat-sort__nested") as HTMLElement | null;
      const lessons: CatalogNode[] = [];
      if (nested) {
        for (const child of Array.from(nested.children) as HTMLElement[]) {
          const lid = Number(child.dataset.id);
          const ln = byId.get(lid);
          if (ln) lessons.push({ ...ln, parentId: id });
        }
      }
      next.push({ kind: "chapter", node, lessons });
    }
  }
  lessonRoots.value = next;
}

async function onLessonSortEnd() {
  syncLessonRootsFromDom();
  await nextTick();
  // 拖入/拖出后 DOM 结构随 Vue 重建，需重绑 Sortable
  initLessonSortables();
}

function initLessonSortables() {
  destroySortables();
  if (!lessonRootRef.value) return;

  // 根级：章节块与直挂小节均可拖，交错重排
  lessonRootSortable = Sortable.create(lessonRootRef.value, {
    ...sortableDragOpts,
    group: {
      name: "catalog-lessons",
      pull: true,
      put: true,
    },
    handle: ".cat-sort__drag",
    draggable: ".cat-sort__block",
    emptyInsertThreshold: 12,
    onStart() {
      setDialogDragging(true);
    },
    onEnd() {
      setDialogDragging(false);
      void onLessonSortEnd();
    },
  });

  const nests = lessonRootRef.value.querySelectorAll<HTMLElement>(".cat-sort__nested");
  nests.forEach((nest) => {
    const s = Sortable.create(nest, {
      ...sortableDragOpts,
      group: {
        name: "catalog-lessons",
        pull: true,
        // 章块不可拖入章内；仅小节
        put: (_to, _from, el) =>
          el instanceof HTMLElement && el.dataset.kind === "lesson",
      },
      handle: ".cat-sort__drag",
      draggable: ".cat-sort__nested-item",
      emptyInsertThreshold: 12,
      onStart() {
        setDialogDragging(true);
      },
      onEnd() {
        setDialogDragging(false);
        void onLessonSortEnd();
      },
    });
    nestedSortables.push(s);
  });
}

function buildFromProps() {
  // 章排序：仅当前上下文下的章节（不含任何小节）
  chapterRows.value = props.nodes
    .filter(
      (n) =>
        n.parentId === props.parentId
        && n.nodeType === CourseCatalogNodeType.CHAPTER,
    )
    .map((n) => ({ ...n }));

  // 小节排序：直挂章节+小节交错；章内小节挂在章下
  lessonRoots.value = props.nodes
    .filter(
      (n) =>
        n.parentId === props.parentId
        && (n.nodeType === CourseCatalogNodeType.CHAPTER
          || n.nodeType === CourseCatalogNodeType.LESSON),
    )
    .map((n) => {
      if (n.nodeType === CourseCatalogNodeType.CHAPTER) {
        return {
          kind: "chapter" as const,
          node: { ...n },
          lessons: lessonsOfChapter(n.id).map((l) => ({ ...l })),
        };
      }
      return { kind: "lesson" as const, node: { ...n } };
    });
}

async function remountSortable() {
  destroySortables();
  await nextTick();
  if (!visible.value) return;
  if (tab.value === "chapters") {
    initChapterSortable();
  } else {
    initLessonSortables();
  }
}

watch(visible, async (open) => {
  if (!open) {
    destroySortables();
    return;
  }
  tab.value = contextChapters.value.length > 0 ? "chapters" : "lessons";
  expandChapters.value = true;
  buildFromProps();
  await remountSortable();
});

watch(tab, async () => {
  if (!visible.value) return;
  buildFromProps();
  await remountSortable();
});

watch(expandChapters, async () => {
  if (!visible.value || tab.value !== "lessons") return;
  await remountSortable();
});

onBeforeUnmount(() => {
  destroySortables();
});

function buildChapterPayload() {
  return chapterRows.value.map((n) => ({
    id: n.id,
    parentId: props.parentId,
  }));
}

function buildLessonPayload() {
  const items: { id: number; parentId: number }[] = [];
  for (const row of lessonRoots.value) {
    if (row.kind === "lesson") {
      items.push({ id: row.node.id, parentId: props.parentId });
    } else {
      items.push({ id: row.node.id, parentId: props.parentId });
      for (const lesson of row.lessons) {
        items.push({ id: lesson.id, parentId: row.node.id });
      }
    }
  }
  return items;
}

async function onConfirm() {
  const mode = tab.value;
  const items = mode === "chapters" ? buildChapterPayload() : buildLessonPayload();
  if (items.length === 0) {
    visible.value = false;
    return;
  }
  submitting.value = true;
  try {
    await reorderCourseCatalog(props.courseId, {
      parentId: props.parentId,
      mode,
      items,
    });
    ElMessage.success("排序已保存");
    visible.value = false;
    emit("confirmed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}

const canConfirm = computed(() => {
  if (tab.value === "chapters") return chapterRows.value.length > 0;
  return lessonRoots.value.length > 0;
});
</script>

<template>
  <ElDialog
    v-model="visible"
    title="排序"
    width="560px"
    append-to-body
    destroy-on-close
    class="catalog-sort-dialog"
    @closed="destroySortables"
  >
    <div class="cat-sort__toolbar">
      <div
        class="cat-sort__tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          class="cat-sort__tab"
          :class="{ 'is-active': tab === 'chapters' }"
          :aria-selected="tab === 'chapters'"
          @click="tab = 'chapters'"
        >
          章排序
        </button>
        <button
          type="button"
          role="tab"
          class="cat-sort__tab"
          :class="{ 'is-active': tab === 'lessons' }"
          :aria-selected="tab === 'lessons'"
          @click="tab = 'lessons'"
        >
          小节排序
        </button>
      </div>
      <div
        v-if="tab === 'lessons'"
        class="cat-sort__expand"
      >
        <span class="cat-sort__expand-label">展开章节内容</span>
        <ElSwitch v-model="expandChapters" />
      </div>
    </div>

    <!-- 章排序 -->
    <ul
      v-if="tab === 'chapters' && chapterRows.length"
      ref="chapterListRef"
      class="cat-sort cat-sort--chapters hide-scrollbar"
    >
      <li
        v-for="(item, idx) in chapterRows"
        :key="item.id"
        class="cat-sort__item"
        :data-id="item.id"
      >
        <span class="cat-sort__index">{{ idx + 1 }}</span>
        <div class="cat-sort__card">
          <div class="cat-sort__card-main">
            <span class="cat-sort__title">{{ item.title }}</span>
          </div>
          <button
            type="button"
            class="cat-sort__drag"
            title="拖拽排序"
          >
            <span
              class="cat-sort__drag-icon"
              v-html="dragGripIcon"
            />
          </button>
        </div>
      </li>
    </ul>

    <!-- 小节排序 -->
    <ul
      v-else-if="tab === 'lessons' && lessonRoots.length"
      ref="lessonRootRef"
      class="cat-sort cat-sort--lessons hide-scrollbar"
    >
      <li
        v-for="row in lessonRoots"
        :key="row.kind + '-' + row.node.id"
        class="cat-sort__block"
        :class="row.kind === 'lesson' ? 'cat-sort__row--lesson' : 'cat-sort__row--chapter'"
        :data-id="row.node.id"
        :data-kind="row.kind"
      >
        <template v-if="row.kind === 'lesson'">
          <div class="cat-sort__lesson-line">
            <span class="cat-sort__lesson-idx">{{ padIdx(lessonIndexMap.get(row.node.id) ?? 0) }}.</span>
            <span class="cat-sort__tag">{{ contentLabel(row.node.contentKind) }}</span>
            <span class="cat-sort__title">{{ row.node.title }}</span>
            <button
              type="button"
              class="cat-sort__drag"
              title="拖拽排序"
            >
              <span
                class="cat-sort__drag-icon"
                v-html="dragGripIcon"
              />
            </button>
          </div>
        </template>
        <template v-else>
          <div class="cat-sort__chapter-bar">
            <button
              type="button"
              class="cat-sort__chevron-btn"
              :aria-expanded="expandChapters"
              @click="expandChapters = !expandChapters"
            >
              <ElIcon
                class="cat-sort__chevron"
                :class="{ 'is-collapsed': !expandChapters }"
              >
                <ArrowDown />
              </ElIcon>
            </button>
            <span class="cat-sort__chapter-title">
              {{ row.node.title }}
              <span class="cat-sort__chapter-count">({{ row.lessons.length }}小节)</span>
            </span>
            <button
              type="button"
              class="cat-sort__drag"
              title="拖拽排序"
            >
              <span
                class="cat-sort__drag-icon"
                v-html="dragGripIcon"
              />
            </button>
          </div>
          <ul
            class="cat-sort__nested"
            :class="{ 'is-collapsed': !expandChapters }"
            :data-chapter-id="row.node.id"
          >
            <li
              v-for="lesson in row.lessons"
              :key="lesson.id"
              class="cat-sort__row--lesson cat-sort__nested-item"
              :data-id="lesson.id"
              :data-kind="'lesson'"
            >
              <div class="cat-sort__lesson-line">
                <span class="cat-sort__lesson-idx">{{ padIdx(lessonIndexMap.get(lesson.id) ?? 0) }}.</span>
                <span class="cat-sort__tag">{{ contentLabel(lesson.contentKind) }}</span>
                <span class="cat-sort__title">{{ lesson.title }}</span>
                <button
                  type="button"
                  class="cat-sort__drag"
                  title="拖拽排序"
                >
                  <span
                    class="cat-sort__drag-icon"
                    v-html="dragGripIcon"
                  />
                </button>
              </div>
            </li>
          </ul>
        </template>
      </li>
    </ul>

    <p
      v-else
      class="empty"
    >
      暂无可排序内容
    </p>

    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="submitting"
        :disabled="!canConfirm"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.cat-sort__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.cat-sort__tabs {
  display: inline-flex;
  padding: 2px;
  border-radius: 6px;
  background: #f0f2f5;
}
.cat-sort__tab {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  color: #606266;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.4;
}
.cat-sort__tab.is-active {
  background: #fff;
  color: #303133;
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}
.cat-sort__expand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cat-sort__expand-label {
  font-size: 13px;
  color: #606266;
}
.cat-sort {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 420px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.cat-sort__item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cat-sort__item:last-child {
  margin-bottom: 0;
}
.cat-sort__index {
  flex: none;
  width: 16px;
  text-align: right;
  font-size: 13px;
  color: #909399;
}
.cat-sort__card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border-radius: 8px;
  background: #f5f6f8;
}
.cat-sort__card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}
.cat-sort__inline-idx {
  flex: none;
  color: #909399;
  font-size: 13px;
}
.cat-sort__tag {
  flex: none;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  color: #606266;
  background: #e9ebef;
  border-radius: 3px;
}
.cat-sort__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #303133;
}
.cat-sort__drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-left: auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #c0c4cc;
  cursor: grab;
}
.cat-sort__drag:active {
  cursor: grabbing;
}
.cat-sort__drag:hover {
  color: #909399;
  background: #ebeef5;
}
.cat-sort__drag-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  line-height: 0;
}
.cat-sort__drag-icon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}
.cat-sort__ghost {
  opacity: 0.4;
}
.cat-sort__chosen {
  cursor: grabbing;
}
.cat-sort__block {
  margin-bottom: 12px;
  list-style: none;
}
.cat-sort__block:last-child {
  margin-bottom: 0;
}
.cat-sort__lesson-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
}
.cat-sort__lesson-idx {
  flex: none;
  font-size: 13px;
  color: #909399;
}
.cat-sort__chapter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 10px 12px;
  border-radius: 4px;
  background: #f5f6f8;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.cat-sort__chapter-bar .cat-sort__drag {
  margin-left: auto;
}
.cat-sort__chevron-btn {
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
.cat-sort__chevron {
  transition: transform 0.15s ease;
}
.cat-sort__chevron.is-collapsed {
  transform: rotate(-90deg);
}
.cat-sort__chapter-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-sort__chapter-count {
  margin-left: 4px;
  font-weight: 400;
  color: #909399;
}
.cat-sort__nested {
  margin: 0;
  padding: 0 0 0 28px;
  list-style: none;
  min-height: 8px;
}
.cat-sort__nested.is-collapsed {
  /* 折叠隐藏小节行，保留极薄投放区以便拖入章节 */
  min-height: 4px;
  padding: 0 0 0 28px;
}
.cat-sort__nested.is-collapsed .cat-sort__nested-item {
  display: none;
}
.cat-sort__nested-item {
  list-style: none;
}
.empty {
  margin: 24px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>

<!-- teleported 弹窗 / fallback 克隆不在 scoped 树内 -->
<style>
.catalog-sort-dialog .el-dialog__body {
  overflow-x: hidden;
}
.catalog-sort-dialog .el-dialog__body.is-dragging {
  overflow: hidden;
}
.cat-sort__fallback {
  opacity: 0.95;
  pointer-events: none;
  z-index: 4000 !important;
}
</style>
