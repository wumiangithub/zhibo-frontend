<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDialog, ElIcon, ElInput, ElMessage } from "element-plus";
import { WarningFilled } from "@element-plus/icons-vue";
import { deleteCourse } from "@/api/course";

const props = defineProps<{
  courseId: string;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const CONFIRM_WORD = "确认删除";

const confirmText = ref("");
const submitting = ref(false);

const canSubmit = computed(() => confirmText.value.trim() === CONFIRM_WORD);

watch(visible, (open) => {
  if (!open) return;
  confirmText.value = "";
});

async function onConfirm() {
  if (!props.courseId || !canSubmit.value) return;
  submitting.value = true;
  try {
    await deleteCourse(props.courseId);
    visible.value = false;
    emit("confirmed");
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
    width="420px"
    append-to-body
    destroy-on-close
    class="delete-course-dialog"
  >
    <template #header>
      <div class="dlg-head">
        <ElIcon
          class="dlg-warn"
          :size="22"
        >
          <WarningFilled />
        </ElIcon>
        <span class="dlg-title">确认删除该课程吗？</span>
      </div>
    </template>

    <p class="dlg-desc">
      删除后，用户将无法查看。（30天内可在操作日志恢复）
    </p>
    <ElInput
      v-model="confirmText"
      class="confirm-input"
      placeholder="请在输入框中输入“确认删除”"
      clearable
    />

    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="onConfirm"
      >
        确认
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
.dlg-desc {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
  color: #606266;
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
