<script setup lang="ts">
import { ref } from "vue";
import { ElButton } from "element-plus";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import RichTextEditor from "@/components/rich-text/RichTextEditor.vue";
import { TosObjectKeyPrefix } from "@/utils/tosUpload";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const markDirty = useMarkDirty();

const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null);
const showExample = true;
const showPreview = true;

function onDetailHtmlChange(html: string) {
  props.form.detailHtml = html;
  markDirty();
}
</script>

<template>
  <FormRow label="直播详情:">
    <div class="detail-editor">
      <div class="detail-editor__wrap">
        <RichTextEditor
          ref="editorRef"
          :model-value="form.detailHtml"
          :height="'340px'"
          :max-length="10000"
          placeholder="请输入内容"
          :upload-object-key-prefix="TosObjectKeyPrefix.ACTIVITY_DETAIL"
          example-dialog-title="直播详情示例"
          @update:model-value="onDetailHtmlChange"
        />
      </div>
      <div
        v-if="showExample || showPreview"
        class="detail-editor__actions"
      >
        <ElButton
          v-if="showPreview"
          @click="editorRef?.openPreview()"
        >
          预览
        </ElButton>
        <a
          v-if="showExample"
          class="detail-editor__example"
          href="javascript:;"
          @click.prevent="editorRef?.openExample()"
        >查看示例</a>
      </div>
    </div>
  </FormRow>
</template>

<style scoped>
.detail-editor {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 8px;
}
/* 宽帽只在父级；不 flex-grow，按钮紧挨编辑器右侧 */
.detail-editor__wrap {
  box-sizing: border-box;
  flex: 0 1 640px;
  width: 640px;
  max-width: 640px;
  min-width: 0;
}
.detail-editor__actions {
  display: flex;
  align-items: center;
  flex: none;
  flex-shrink: 0;
  gap: 8px;
  white-space: nowrap;
}
.detail-editor__example {
  color: var(--color-primary);
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.detail-editor__example:hover {
  opacity: 0.8;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
