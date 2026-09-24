<script setup lang="ts">
import { watch } from "vue";
import { ElMessage } from "element-plus";
import {
  updateActivity,
  TYPE_LABEL,
  VERIFY_LABEL,
  type ActivityDetail,
} from "@/api/activity";
import { useLiveForm } from "../composables/useLiveForm";
import BasicInfoSection from "../sections/BasicInfoSection.vue";
import CoverSection from "../sections/CoverSection.vue";
import DetailSection from "../sections/DetailSection.vue";
import RoleSection from "../sections/RoleSection.vue";
import PlaybackSection from "../sections/PlaybackSection.vue";
import OwnerSection from "../sections/OwnerSection.vue";
import CourseSection from "../sections/CourseSection.vue";
import ProductSection from "../sections/ProductSection.vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  activityId: number;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const { form, submitting } = useLiveForm();

const TYPE_TO_MODE = { 1: "voice", 2: "video", 3: "video", 4: "recorded" } as const;

function hydrate(d: ActivityDetail) {
  form.name = d.title;
  form.intro = d.introduction ?? "";
  form.mode = TYPE_TO_MODE[d.type as keyof typeof TYPE_TO_MODE] ?? "video";
  const [datePart, timePart] = (d.startTime || "").split(" ");
  form.startDate = datePart ?? "";
  form.startTime = timePart ? timePart.slice(0, 5) : "10:00";
  if (d.endTime && !d.endTime.startsWith("0000")) {
    const [ed, et] = d.endTime.split(" ");
    form.endDate = ed ?? "";
    form.endTime = et ? et.slice(0, 5) : "12:00";
  }
  form.agreed = true;
}

watch(
  () => props.detail,
  (d) => hydrate(d),
  { immediate: true },
);

async function onSave() {
  if (!form.name.trim()) {
    ElMessage.warning("请填写直播名称");
    return;
  }
  if (!form.startDate || !form.startTime) {
    ElMessage.warning("请选择开始时间");
    return;
  }
  submitting.value = true;
  try {
    const payload: { title?: string; startTime?: string } = {};
    const title = form.name.trim();
    const startTime = `${form.startDate} ${form.startTime}:00`;
    if (title !== props.detail.title) payload.title = title;
    if (startTime !== props.detail.startTime) payload.startTime = startTime;
    if (Object.keys(payload).length === 0) {
      ElMessage.info("没有可保存的变更（本迭代仅支持名称与开始时间）");
      return;
    }
    await updateActivity(props.activityId, payload);
    ElMessage.success("已保存");
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="basic-tab">
    <div class="meta card">
      <h3 class="meta-title">活动信息</h3>
      <dl class="meta-grid">
        <div>
          <dt>ID</dt>
          <dd>{{ detail.id }}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{{ TYPE_LABEL[detail.type] ?? detail.type }}（不可改）</dd>
        </div>
        <div v-if="detail.endTime && !detail.endTime.startsWith('0000')">
          <dt>结束时间</dt>
          <dd>{{ detail.endTime }}</dd>
        </div>
        <div v-if="detail.verify !== undefined">
          <dt>观看限制</dt>
          <dd>{{ VERIFY_LABEL[detail.verify] ?? detail.verify }}</dd>
        </div>
        <div v-if="detail.pv !== undefined">
          <dt>热度</dt>
          <dd>{{ detail.pv }}</dd>
        </div>
        <div v-if="detail.createdAt">
          <dt>创建时间</dt>
          <dd>{{ detail.createdAt }}</dd>
        </div>
      </dl>
    </div>

    <div class="card">
      <BasicInfoSection :form="form" />
      <CoverSection :form="form" />
      <DetailSection :form="form" />
      <RoleSection :form="form" />
      <PlaybackSection :form="form" />
      <OwnerSection :form="form" />
    </div>

    <div class="card">
      <CourseSection :form="form" />
    </div>

    <div class="card">
      <ProductSection :form="form" />
    </div>

    <div class="save-bar">
      <p class="save-hint">本迭代仅保存直播名称与开始时间，其余字段暂不落库</p>
      <UiButton
        variant="primary"
        :disabled="submitting"
        @click="onSave"
      >
        {{ submitting ? "保存中…" : "保存" }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.basic-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  border: 1px solid var(--color-border-light);
}
.meta-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
}
.meta-grid dt {
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.meta-grid dd {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--color-text);
}
.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0 4px;
}
.save-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
