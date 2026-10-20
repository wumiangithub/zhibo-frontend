<script setup lang="ts">
import { ref } from "vue";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import MaterialCoverPicker from "@/components/MaterialCoverPicker.vue";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const markDirty = useMarkDirty();
/** 弹窗回显用；创建请求仍只提交封面 URL */
const materialId = ref("");

function onCoverUrl(url: string) {
  props.form.detailCover = url;
  markDirty();
}

function onMaterialId(id: string) {
  materialId.value = id;
  markDirty();
}
</script>

<template>
  <FormRow
    label="详情封面:"
    required
  >
    <MaterialCoverPicker
      :cover-url="form.detailCover"
      :material-id="materialId"
      required
      hint="建议尺寸750*422px或16:9,小于5M的JPG、PNG格式图片"
      @update:cover-url="onCoverUrl"
      @update:material-id="onMaterialId"
    />
  </FormRow>
</template>

<style scoped>
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
