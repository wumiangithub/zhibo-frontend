<script setup lang="ts">
import { ElCheckbox } from "element-plus";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";

withDefaults(
  defineProps<{
    form: { listed: boolean };
    /** 悬停说明；直播 / 课程可不同 */
    info?: string;
  }>(),
  {
    info: "勾选后，保存成功即上架；不勾选则为待上架，之后可在列表手动上架",
  },
);
const markDirty = useMarkDirty();
</script>

<template>
  <FormRow
    label="是否上架:"
    :info="info"
  >
    <ElCheckbox
      v-model="form.listed"
      @change="markDirty"
    >
      上架
    </ElCheckbox>
  </FormRow>
</template>

<style scoped>
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
