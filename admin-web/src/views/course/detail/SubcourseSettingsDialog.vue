<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElButton, ElDialog, ElMessage } from "element-plus";
import Sortable from "sortablejs";
import { reorderCatalogSubcourses, type CatalogNode } from "@/api/course";
import dragGripIcon from "@/assets/icons/drag-grip.svg?raw";

const props = defineProps<{
  courseId: string;
  subcourses: CatalogNode[];
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const list = ref<CatalogNode[]>([]);
const listRef = ref<HTMLElement | null>(null);
const submitting = ref(false);
let sortable: Sortable | null = null;

function destroySortable() {
  sortable?.destroy();
  sortable = null;
}

function initSortable() {
  destroySortable();
  if (!listRef.value || list.value.length < 2) return;
  sortable = Sortable.create(listRef.value, {
    handle: ".sub-sort__drag",
    animation: 150,
    ghostClass: "sub-sort__ghost",
    onEnd(evt) {
      const { oldIndex, newIndex } = evt;
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      const rows = list.value;
      const [moved] = rows.splice(oldIndex, 1);
      if (moved == null) return;
      rows.splice(newIndex, 0, moved);
    },
  });
}

watch(visible, async (open) => {
  if (!open) {
    destroySortable();
    return;
  }
  list.value = props.subcourses.map((s) => ({ ...s }));
  await nextTick();
  initSortable();
});

watch(
  () => list.value.length,
  async () => {
    if (!visible.value) return;
    await nextTick();
    initSortable();
  },
);

onBeforeUnmount(() => {
  destroySortable();
});

async function onConfirm() {
  if (list.value.length === 0) {
    visible.value = false;
    return;
  }
  submitting.value = true;
  try {
    await reorderCatalogSubcourses(
      props.courseId,
      list.value.map((s) => s.id),
    );
    ElMessage.success("排序已保存");
    visible.value = false;
    emit("confirmed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="子课程设置"
    width="480px"
    append-to-body
    destroy-on-close
    @closed="destroySortable"
  >
    <p class="hint">
      拖拽调整子课程展示顺序
    </p>
    <ul
      ref="listRef"
      class="sub-sort thin-scrollbar"
    >
      <li
        v-for="item in list"
        :key="item.id"
        class="sub-sort__item"
        :data-id="item.id"
      >
        <div class="sub-sort__cover">
          <img
            v-if="item.coverUrl"
            :src="item.coverUrl"
            alt=""
          >
          <span v-else>封面</span>
        </div>
        <div class="sub-sort__meta">
          <div class="sub-sort__title">
            {{ item.title }}
          </div>
          <div class="sub-sort__stats">
            章节数: {{ item.chapterCount ?? 0 }}　小节数: {{ item.lessonCount ?? 0 }}
          </div>
        </div>
        <button
          type="button"
          class="sub-sort__drag"
          title="拖拽排序"
        >
          <span
            class="sub-sort__drag-icon"
            v-html="dragGripIcon"
          />
        </button>
      </li>
    </ul>
    <p
      v-if="!list.length"
      class="empty"
    >
      暂无子课程
    </p>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="submitting"
        :disabled="list.length === 0"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
.sub-sort {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 420px;
  overflow: auto;
}
.sub-sort__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  margin-bottom: 8px;
}
.sub-sort__item:last-child {
  margin-bottom: 0;
}
.sub-sort__ghost {
  opacity: 0.55;
  background: var(--color-primary-bg, #ecf5ff);
}
.sub-sort__drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #c0c4cc;
  cursor: grab;
}
.sub-sort__drag:active {
  cursor: grabbing;
}
.sub-sort__drag:hover {
  color: #909399;
  background: #f5f7fa;
}
.sub-sort__drag-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  line-height: 0;
}
.sub-sort__drag-icon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}
.sub-sort__cover {
  width: 72px;
  height: 40px;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 12px;
}
.sub-sort__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sub-sort__meta {
  min-width: 0;
  flex: 1;
}
.sub-sort__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-sort__stats {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}
.empty {
  margin: 24px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
