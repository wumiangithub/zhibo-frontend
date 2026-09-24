<script setup lang="ts">
import { ElRadioGroup, ElRadioButton } from "element-plus";
import FormRow from "../components/FormRow.vue";
import ImageUploader from "../components/ImageUploader.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
</script>

<template>
  <FormRow label="详情封面:">
    <ImageUploader
      v-model="form.detailCover"
      hint="750*422px 或 16:9"
    />
  </FormRow>

  <FormRow label="直播暖场:">
    <div>
      <ElRadioGroup v-model="form.warmupType">
        <ElRadioButton value="image">暖场图</ElRadioButton>
        <ElRadioButton value="video">暖场视频</ElRadioButton>
      </ElRadioGroup>
      <div class="mt-3">
        <ImageUploader
          v-if="form.warmupType === 'image'"
          v-model="form.warmupImage"
          hint="750*1334px 或 9:16"
          view-example
        />
        <div
          v-else
          class="text-[12px] text-[#999]"
        >暖场视频上传功能待接入</div>
      </div>
    </div>
  </FormRow>

  <FormRow label="直播宣传封面:">
    <ImageUploader
      v-model="form.promoCover"
      hint="750*240px 或 25:8"
      view-example
    />
  </FormRow>
</template>

<style scoped>
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
