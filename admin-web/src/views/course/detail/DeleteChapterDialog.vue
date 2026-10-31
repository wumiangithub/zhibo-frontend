<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessage,
  ElRadio,
  ElRadioGroup,
} from "element-plus";
import { CircleCheckFilled, WarningFilled } from "@element-plus/icons-vue";
import { deleteCatalogChapter, type CatalogNode } from "@/api/course";

const props = defineProps<{
  courseId: string;
  chapter: CatalogNode | null;
  /** 同父下全部章节，供「移动至其他章节」选择（排除正在删除的） */
  siblingChapters?: CatalogNode[];
  /** 该章节下小节数 */
  lessonCount?: number;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [id: number] }>();

const CONFIRM_WORD = "确认删除";

/** keep | move | purge */
const mode = ref<"keep" | "move" | "purge">("keep");
const confirmText = ref("");
const targetChapterId = ref<number | null>(null);
const submitting = ref(false);

const lessonCount = computed(() => props.lessonCount ?? 0);
/** 无小节：简化确认，无需选项与二次输入 */
const isEmpty = computed(() => lessonCount.value === 0);
const otherChapters = computed(() =>
  (props.siblingChapters ?? []).filter((c) => c.id !== props.chapter?.id),
);
const titleText = computed(() => {
  const name = props.chapter?.title?.trim() || "章节";
  return isEmpty.value ? `确认删除 “${name}” 吗?` : `确认删除“${name}”吗`;
});
const canSubmit = computed(() => {
  if (isEmpty.value) return true;
  if (confirmText.value.trim() !== CONFIRM_WORD) return false;
  if (mode.value === "move") return targetChapterId.value != null;
  return true;
});

watch(visible, (open) => {
  if (!open) return;
  mode.value = "keep";
  confirmText.value = "";
  targetChapterId.value = null;
});

watch(mode, () => {
  targetChapterId.value = null;
});

async function onConfirm() {
  if (!props.chapter || !canSubmit.value) return;
  submitting.value = true;
  try {
    const keepContents = isEmpty.value ? true : mode.value !== "purge";
    const payload: {
      id: number;
      keepContents: boolean;
      targetChapterId?: number;
    } = {
      id: props.chapter.id,
      keepContents,
    };
    if (!isEmpty.value && mode.value === "move" && targetChapterId.value != null) {
      payload.targetChapterId = targetChapterId.value;
    }
    await deleteCatalogChapter(props.courseId, payload);
    ElMessage.success("章节已删除");
    const id = props.chapter.id;
    visible.value = false;
    emit("confirmed", id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :width="isEmpty ? '420px' : '480px'"
    append-to-body
    destroy-on-close
    class="delete-chapter-dialog"
    :class="{ 'is-empty': isEmpty }"
  >
    <template #header>
      <div class="dlg-head">
        <ElIcon
          class="dlg-warn"
          :size="22"
        >
          <WarningFilled />
        </ElIcon>
        <span class="dlg-title">{{ titleText }}</span>
      </div>
    </template>

    <template v-if="!isEmpty">
      <ElRadioGroup
        v-model="mode"
        class="mode-group"
      >
        <ElRadio value="keep">
          保留该章节下所有内容
        </ElRadio>
        <div class="mode-block">
          <ElRadio value="move">
            保留该章节下所有内容，并移动至其他章节
          </ElRadio>
          <div
            v-if="mode === 'move'"
            class="move-panel"
          >
            <div class="move-panel__head">
              章节名称
            </div>
            <ul
              v-if="otherChapters.length"
              class="move-list hide-scrollbar"
            >
              <li
                v-for="item in otherChapters"
                :key="item.id"
                class="move-list__item"
                :class="{ 'is-active': targetChapterId === item.id }"
                @click="targetChapterId = item.id"
              >
                <div class="move-list__title">
                  {{ item.title }}
                </div>
                <ElIcon
                  v-if="targetChapterId === item.id"
                  class="move-list__check"
                  :size="18"
                  aria-hidden="true"
                >
                  <CircleCheckFilled />
                </ElIcon>
              </li>
            </ul>
            <ElEmpty
              v-else
              class="move-empty"
              description="暂无内容"
              :image-size="80"
            />
          </div>
        </div>
        <ElRadio value="purge">
          同时删除章节内{{ lessonCount }}个小节，用户将无法学习被移除的小节
        </ElRadio>
      </ElRadioGroup>

      <ElInput
        v-model="confirmText"
        class="confirm-input"
        :placeholder="`请输入 “${CONFIRM_WORD}”`"
        clearable
      />
    </template>

    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="danger"
        :plain="!isEmpty"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="onConfirm"
      >
        {{ isEmpty ? "确认" : "删除" }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.dlg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 24px;
}
.dlg-warn {
  flex: none;
  color: var(--el-color-danger);
}
.dlg-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}
.mode-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  width: 100%;
}
.mode-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mode-group :deep(.el-radio) {
  display: flex;
  align-items: flex-start;
  height: auto;
  margin-right: 0;
  white-space: normal;
}
.mode-group :deep(.el-radio__input) {
  margin-top: 3px;
}
.mode-group :deep(.el-radio__inner) {
  width: 14px;
  height: 14px;
}
.mode-group :deep(.el-radio__label) {
  padding-left: 8px;
  line-height: 20px;
  color: #606266;
}
.mode-group :deep(.el-radio.is-checked .el-radio__label) {
  color: var(--el-color-primary);
}
.move-panel {
  margin-left: 22px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}
.move-panel__head {
  padding: 8px 12px;
  font-size: 13px;
  color: #909399;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}
.move-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow: auto;
}
.move-list__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f2f3f5;
}
.move-list__item:last-child {
  border-bottom: none;
}
.move-list__item:hover {
  background: #f5f7fa;
}
.move-list__item.is-active {
  background: var(--el-color-primary-light-9);
}
.move-list__title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.move-list__check {
  flex: none;
  color: var(--el-color-primary);
}
.move-empty {
  padding: 16px 0 20px;
}
.move-empty :deep(.el-empty__description) {
  margin-top: 8px;
}
.confirm-input {
  margin-top: 16px;
}
.confirm-input :deep(.el-input__wrapper) {
  box-shadow: none;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}
.confirm-input :deep(.el-input__wrapper:hover) {
  border-color: #c0c4cc;
}
.confirm-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--el-color-primary);
  box-shadow: none;
}
</style>

<style>
/* append-to-body：空章节时收紧 body 留白 */
.delete-chapter-dialog.is-empty .el-dialog__body {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 0;
}
</style>
