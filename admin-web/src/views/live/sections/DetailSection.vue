<script setup lang="ts">
import { ref } from "vue";
import { ElDialog } from "element-plus";
import FormRow from "../components/FormRow.vue";
import RichTextEditor from "../components/RichTextEditor.vue";
import type { LiveFormState } from "../composables/useLiveForm";
import detailExample from "@/assets/images/live/detail-example.png";

defineProps<{ form: LiveFormState }>();

const exampleVisible = ref(false);

function openExample() {
  exampleVisible.value = true;
}
</script>

<template>
  <FormRow label="直播详情:">
    <div class="detail-row">
      <RichTextEditor
        v-model="form.detailHtml"
        class="detail-row__editor"
        :height="'340px'"
        :max-length="10000"
        placeholder="请输入内容"
      />
      <a
        class="detail-row__link"
        href="javascript:;"
        @click.prevent="openExample"
      >查看示例</a>
    </div>
  </FormRow>

  <ElDialog
    v-model="exampleVisible"
    title="直播详情示例"
    width="720px"
    align-center
    destroy-on-close
  >
    <div class="example-body">
      <img
        :src="detailExample"
        alt="直播详情示例"
        class="example-img"
      >
    </div>
  </ElDialog>
</template>

<style scoped>
.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.detail-row__editor {
  flex: 1;
  min-width: 0;
  max-width: 640px;
}
.detail-row__link {
  flex: none;
  color: var(--color-primary);
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.detail-row__link:hover {
  opacity: 0.8;
}
.example-body {
  max-height: 70vh;
  overflow-x: hidden;
  overflow-y: auto;
}
.example-img {
  display: block;
  width: 369px;
  height: auto;
  max-height: none;
  margin: 0 auto;
}
:deep(.el-dialog__body) {
  padding-top: 12px;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
