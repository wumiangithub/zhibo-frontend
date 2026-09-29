<script setup lang="ts">
import { nextTick, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  updateActivity,
  TYPE_LABEL,
  VERIFY_LABEL,
  PROVIDER_LABEL,
  type ActivityDetail,
  type ActivityId,
  type LiveProvider,
  type UpdateActivityPayload,
} from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { useLiveForm, type LiveMode } from "../composables/useLiveForm";
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
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const { form, submitting } = useLiveForm();
/** 子组件不能拦路由，只做脏检测 + beforeunload；路由离开由 LiveDetailView 处理 */
const leave = useLeaveConfirm({ routeLeave: false });
const { takeSnapshot } = leave.trackForm(form);

const TYPE_TO_MODE: Record<number, LiveMode> = {
  1: "voice",
  2: "video",
  3: "video",
  4: "recorded",
};

function hydrate(d: ActivityDetail) {
  form.provider = (d.provider as LiveProvider) || "vhall";
  form.name = d.title;
  form.intro = d.introduction ?? "";
  form.mode = TYPE_TO_MODE[d.type] ?? "video";
  form.viewerStyle = d.viewerStyle === "immersive" ? "immersive" : "traditional";
  form.ultraLowLatency = d.ultraLowLatency ?? true;
  form.virtualAvatar = d.virtualAvatar ?? false;
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
  form.warmupType = d.warmupType === "video" ? "video" : "image";
  form.warmupImage = d.warmupUrl ?? "";
  form.promoCover = d.promoCoverUrl ?? "";
  form.detailHtml = d.detailHtml ?? "";
  form.agreed = true;
  void nextTick(() => takeSnapshot());
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
  if (form.name.trim().length > 64) {
    ElMessage.warning("直播名称不能超过 64 字");
    return;
  }
  if (form.provider === "vhall" && form.mode === "recorded" && !form.intro.trim()) {
    ElMessage.warning("微吼录播请填写直播简介");
    return;
  }
  if (form.intro.trim().length > 256) {
    ElMessage.warning("直播简介不能超过 256 字");
    return;
  }
  if (!form.startDate || !form.startTime) {
    ElMessage.warning("请选择开始时间");
    return;
  }
  if (form.endDate && form.endTime) {
    const startAt = new Date(`${form.startDate} ${form.startTime}:00`).getTime();
    const endAt = new Date(`${form.endDate} ${form.endTime}:00`).getTime();
    if (endAt <= startAt) {
      ElMessage.warning("结束时间必须大于开始时间");
      return;
    }
  }

  submitting.value = true;
  try {
    const payload: UpdateActivityPayload = {
      title: form.name.trim(),
      startTime: `${form.startDate} ${form.startTime}:00`,
      introduction: form.intro.trim() || undefined,
      // 模式 / 观看端样式 / 超低延迟：创建后不可改，编辑不回传
      virtualAvatar: form.virtualAvatar,
      coverUrl: form.detailCover || undefined,
      warmupType: form.warmupType === "image" && form.warmupImage ? "image" : undefined,
      warmupUrl: form.warmupType === "image" && form.warmupImage ? form.warmupImage : undefined,
      promoCoverUrl: form.promoCover || undefined,
      detailHtml: form.detailHtml?.trim() || undefined,
    };
    if (form.endDate && form.endTime) {
      payload.endTime = `${form.endDate} ${form.endTime}:00`;
    }
    await updateActivity(props.activityId, payload);
    ElMessage.success("已保存");
    takeSnapshot();
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
  <div class="basic-tab">
    <div class="meta card">
      <h3 class="meta-title">活动信息</h3>
      <dl class="meta-grid">
        <div>
          <dt>ID</dt>
          <dd>{{ detail.id }}</dd>
        </div>
        <div>
          <dt>服务商</dt>
          <dd>{{ PROVIDER_LABEL[detail.provider] ?? detail.provider }}（不可改）</dd>
        </div>
        <div v-if="detail.providerRoomId">
          <dt>外部房间号</dt>
          <dd>{{ detail.providerRoomId }}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{{ TYPE_LABEL[detail.type] ?? detail.type }}（不可改）</dd>
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
      <BasicInfoSection
        :form="form"
        provider-readonly
        mode-readonly
        viewer-style-readonly
        ultra-low-latency-readonly
      />
      <CoverSection :form="form" />
      <DetailSection :form="form" />
      <div class="placeholder-tip">角色 / 回放 / 归属人本迭代暂不保存</div>
      <RoleSection :form="form" />
      <PlaybackSection :form="form" />
      <OwnerSection :form="form" />
    </div>

    <div class="card">
      <p class="placeholder-tip">所属课程本迭代暂不保存</p>
      <CourseSection :form="form" />
    </div>

    <div class="card">
      <p class="placeholder-tip">商品信息本迭代暂不保存</p>
      <ProductSection :form="form" />
    </div>

    <div class="save-bar">
      <p class="save-hint">可保存名称/简介/时间/封面等本站字段；服务商、模式、观看端样式、超低延迟创建后不可改</p>
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
  word-break: break-all;
}
.placeholder-tip {
  margin: 8px 0 12px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  font-size: 12px;
  color: #ad6800;
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
