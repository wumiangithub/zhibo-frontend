<script setup lang="ts">
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import RichTextEditor from "@/components/rich-text/RichTextEditor.vue";
import { TosObjectKeyPrefix } from "@/utils/tosUpload";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const markDirty = useMarkDirty();

function onDetailHtmlChange(html: string) {
  props.form.detailHtml = html;
  markDirty();
}
</script>

<template>
  <FormRow label="直播详情:">
    <div class="detail-editor">
      <RichTextEditor
        :model-value="form.detailHtml"
        :height="'340px'"
        :max-length="10000"
        placeholder="请输入内容"
        :upload-object-key-prefix="TosObjectKeyPrefix.ACTIVITY_DETAIL"
        example-dialog-title="直播详情示例"
        show-preview
        show-example
        @update:model-value="onDetailHtmlChange"
      />
    </div>
  </FormRow>
</template>

<style scoped>
.detail-editor {
  width: 100%;
  min-width: 0;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
