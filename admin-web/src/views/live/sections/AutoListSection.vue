<script setup lang="ts">
import { ElRadioButton, ElRadioGroup } from "element-plus";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
const markDirty = useMarkDirty();
</script>

<template>
  <FormRow
    label="是否自动上架:"
    required
    info="若选是，合规风控部门审核开播信息通过后，直播会自动上架"
  >
    <ElRadioGroup
      v-model="form.autoList"
      @change="markDirty"
    >
      <ElRadioButton :value="true">是</ElRadioButton>
      <ElRadioButton :value="false">否</ElRadioButton>
    </ElRadioGroup>
  </FormRow>
</template>

<style scoped>
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
