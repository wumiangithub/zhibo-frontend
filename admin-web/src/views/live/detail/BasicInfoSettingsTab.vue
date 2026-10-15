<script setup lang="ts">
import { watch } from "vue";
import { ElMessage } from "element-plus";
import {
  updateActivity,
  type ActivityDetail,
  type ActivityId,
  type LiveProvider,
  type UpdateActivityPayload,
} from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { useLiveForm, type LiveMode } from "../composables/useLiveForm";
import BasicInfoSection from "../sections/BasicInfoSection.vue";
import ProviderModeSection from "../sections/ProviderModeSection.vue";
import RelatedBusinessSection from "../sections/RelatedBusinessSection.vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const { form, submitting } = useLiveForm();
const leave = useLeaveConfirm({ routeLeave: false });

const TYPE_TO_MODE: Record<number, LiveMode> = {
  1: "voice",
  2: "video",
  3: "video",
  4: "recorded",
};

function applyDetail(d: ActivityDetail) {
  form.provider = (d.provider as LiveProvider) || "vhall";
  form.name = d.title;
  form.intro = d.introduction ?? "";
  form.mode = TYPE_TO_MODE[d.type] ?? "video";
  form.viewerStyle = d.viewerStyle === "immersive" ? "immersive" : "traditional";
  form.ultraLowLatency = d.ultraLowLatency ?? true;
  const [datePart, timePart] = (d.startTime || "").split(" ");
  form.startDate = datePart ?? "";
  form.startTime = timePart ? timePart.slice(0, 5) : "";
  if (d.endTime && !d.endTime.startsWith("0000")) {
    const [ed, et] = d.endTime.split(" ");
    form.endDate = ed ?? "";
    form.endTime = et ? et.slice(0, 5) : "";
  } else {
    form.endDate = "";
    form.endTime = "";
  }
  form.detailCover = d.coverUrl ?? "";
  form.detailHtml = d.detailHtml ?? "";
  // UI 单选：后端若返回多人，只取第一人回显
  form.hostIds = (d.hosts ?? []).map((h) => h.id).slice(0, 1);
  form.ownerIds = (d.owners ?? []).map((o) => o.id);
  form.products = (d.products ?? []).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName,
  }));
  form.coursewares = (d.coursewares ?? []).map((c) => ({ ...c }));
  form.coursewareMaterialIds = form.coursewares.map((c) => c.id);
  form.autoList = d.autoList ?? false;
  form.agreed = true;
}

watch(
  () => props.detail,
  (d) => {
    applyDetail(d);
    leave.markClean();
  },
  { immediate: true },
);

function validateBasic(): string | null {
  if (!form.name.trim()) return "请填写直播名称";
  if (form.name.trim().length > 64) return "直播名称不能超过 64 字";
  if (form.intro.trim().length > 256) return "直播简介不能超过 256 字";
  if (!form.startDate || !form.startTime) return "请选择开始时间";
  if ((form.endDate && !form.endTime) || (!form.endDate && form.endTime)) {
    return "结束时间须完整填写日期与时间";
  }
  if (form.endDate && form.endTime) {
    const startAt = new Date(`${form.startDate} ${form.startTime}:00`).getTime();
    const endAt = new Date(`${form.endDate} ${form.endTime}:00`).getTime();
    if (endAt <= startAt) return "结束时间必须大于开始时间";
  }
  if (!form.hostIds.length) return "请选择主播";
  if (form.ownerIds.length > 20) return "归属人最多 20 人";
  if (form.products.length > 20) return "关联商品最多 20 个";
  if (form.coursewareMaterialIds.length > 100) return "课件资料最多 100 个";
  return null;
}

async function onSave() {
  const err = validateBasic();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const payload: UpdateActivityPayload = {
      title: form.name.trim(),
      startTime: `${form.startDate} ${form.startTime}:00`,
      introduction: form.intro.trim() || undefined,
      coverUrl: form.detailCover || undefined,
      detailHtml: form.detailHtml?.trim() || undefined,
      autoList: form.autoList,
      hostIds: form.hostIds.slice(0, 1),
      ownerIds: [...form.ownerIds],
      products: form.products.map((p) => ({
        spuId: String(p.spuId),
        productName: p.productName.trim(),
      })),
      coursewareMaterialIds: [...form.coursewareMaterialIds],
    };
    if (form.endDate && form.endTime) {
      payload.endTime = `${form.endDate} ${form.endTime}:00`;
    }
    await updateActivity(props.activityId, payload);
    ElMessage.success("保存成功");
    leave.markClean();
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}

defineExpose({
  isDirty: () => leave.dirty.value,
  confirmLeave: leave.confirmLeave,
});
</script>

<template>
  <div class="tab-panel">
    <BasicInfoSection :form="form" />
    <ProviderModeSection
      :form="form"
      hide-provider
      provider-readonly
      mode-readonly
      viewer-style-readonly
    />
    <RelatedBusinessSection
      :form="form"
      :known-hosts="detail.hosts"
      :known-owners="detail.owners"
    />

    <div class="save-bar">
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
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 24px;
}
.save-bar {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
}
</style>
