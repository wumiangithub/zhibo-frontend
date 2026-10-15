<script setup lang="ts">
import { computed } from "vue";
import {
  ElInput,
  ElDatePicker,
  ElTimePicker,
} from "element-plus";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import PhonePreview from "../components/PhonePreview.vue";
import CoverSection from "./CoverSection.vue";
import DetailSection from "./DetailSection.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{
  form: LiveFormState;
}>();

const markDirty = useMarkDirty();

const previewTime = computed(() =>
  props.form.startDate && props.form.startTime
    ? `${props.form.startDate} ${props.form.startTime}`
    : "",
);

const dateShortcuts = [
  {
    text: "今天",
    value: () => new Date(),
  },
];
</script>

<template>
  <div class="section">
    <div class="section__title">基本信息</div>

    <div class="section__body">
      <div class="section__fields">
        <FormRow
          label="直播名称:"
          required
        >
          <div class="flex items-center gap-2">
            <ElInput
              v-model="form.name"
              placeholder="请输入直播名称（建议14字以内，不超过64字）"
              maxlength="64"
              show-word-limit
              style="width: 360px"
              @input="markDirty"
            />
          </div>
        </FormRow>

        <FormRow
          label="直播简介:"
          :required="form.provider === 'vhall' && form.mode === 'recorded'"
          :info="
            form.provider === 'vhall' && form.mode === 'recorded'
              ? '微吼录播创建时简介为必填'
              : undefined
          "
        >
          <ElInput
            v-model="form.intro"
            type="textarea"
            :rows="4"
            placeholder="请输入直播简介"
            maxlength="256"
            show-word-limit
            style="width: 480px"
            @input="markDirty"
          />
        </FormRow>

        <FormRow
          label="开始时间:"
          required
          info="微吼必填字段，实际开播时间不用和所填时间保持一致"
        >
          <div class="flex items-center gap-2">
            <ElDatePicker
              v-model="form.startDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              style="width: 160px"
              @change="markDirty"
            />
            <ElTimePicker
              v-model="form.startTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              style="width: 120px"
              @change="markDirty"
            />
          </div>
        </FormRow>

        <FormRow label="结束时间:">
          <div class="flex items-center gap-2">
            <ElDatePicker
              v-model="form.endDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              style="width: 160px"
              @change="markDirty"
            />
            <ElTimePicker
              v-model="form.endTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              style="width: 120px"
              @change="markDirty"
            />
          </div>
        </FormRow>

        <CoverSection :form="form" />
        <DetailSection :form="form" />
      </div>

      <aside class="section__preview">
        <PhonePreview
          :name="form.name"
          :intro="form.intro"
          :start-time="previewTime"
          :cover-url="form.detailCover"
          :mode="form.mode"
          :viewer-style="form.viewerStyle"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.section__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 18px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}
.section__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.section__fields {
  flex: 1;
  min-width: 0;
}
.section__preview {
  flex: none;
  width: 280px;
  position: sticky;
  top: 12px;
}
</style>
