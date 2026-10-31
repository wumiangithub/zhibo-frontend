<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";
import {
  createCatalogChapter,
  updateCatalogChapter,
  type CatalogNode,
} from "@/api/course";

const props = defineProps<{
  courseId: string;
  parentId: number;
  /** 传入则编辑该章节 */
  editing?: CatalogNode | null;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const title = ref("");
const submitting = ref(false);

const isEdit = computed(() => props.editing != null && props.editing.id != null);
const dialogTitle = computed(() => (isEdit.value ? "编辑章节" : "添加章节"));

watch(visible, (open) => {
  if (!open) return;
  if (isEdit.value && props.editing) {
    title.value = props.editing.title ?? "";
    return;
  }
  title.value = "";
});

async function onConfirm() {
  const name = title.value.trim();
  if (!name) {
    ElMessage.warning("请输入章节标题");
    return;
  }
  if (name.length > 30) {
    ElMessage.warning("章节标题不能超过30个字");
    return;
  }
  submitting.value = true;
  try {
    if (isEdit.value && props.editing) {
      await updateCatalogChapter(props.courseId, {
        id: props.editing.id,
        title: name,
      });
      ElMessage.success("章节已保存");
      visible.value = false;
      emit("confirmed");
      return;
    }
    await createCatalogChapter(props.courseId, {
      parentId: props.parentId,
      title: name,
    });
    ElMessage.success("章节已添加");
    visible.value = false;
    emit("confirmed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : (isEdit.value ? "保存失败" : "添加失败"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="dialogTitle"
    width="480px"
    append-to-body
    destroy-on-close
  >
    <div class="row">
      <span class="label"><i>*</i>章节标题:</span>
      <ElInput
        v-model="title"
        maxlength="30"
        show-word-limit
        placeholder="请输入"
      />
    </div>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="submitting"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label {
  flex: none;
  width: 88px;
  font-size: 14px;
  color: #333;
}
.label i {
  margin-right: 2px;
  color: var(--color-danger);
  font-style: normal;
}
</style>
