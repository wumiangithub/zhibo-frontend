<script setup lang="ts">
import { ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";
import { updateCatalogLesson, type CatalogNode } from "@/api/course";

const props = defineProps<{
  courseId: string;
  editing?: CatalogNode | null;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const title = ref("");
const submitting = ref(false);

watch(visible, (open) => {
  if (!open) return;
  title.value = props.editing?.title ?? "";
});

async function onConfirm() {
  const name = title.value.trim();
  if (!name) {
    ElMessage.warning("请输入小节标题");
    return;
  }
  if (name.length > 30) {
    ElMessage.warning("小节标题不能超过30个字");
    return;
  }
  if (!props.editing?.id) {
    ElMessage.error("小节无效");
    return;
  }
  submitting.value = true;
  try {
    await updateCatalogLesson(props.courseId, {
      id: props.editing.id,
      title: name,
    });
    ElMessage.success("小节已保存");
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
    title="编辑小节"
    width="480px"
    append-to-body
    destroy-on-close
  >
    <div class="row">
      <span class="label"><i>*</i>小节标题:</span>
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
