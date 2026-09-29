<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElCheckbox, ElButton, ElMessage, ElIcon } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import { createActivity, type CreateActivityPayload } from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { MODE_TO_TYPE, useLiveForm } from "./composables/useLiveForm";
import BasicInfoSection from "./sections/BasicInfoSection.vue";
import CoverSection from "./sections/CoverSection.vue";
import DetailSection from "./sections/DetailSection.vue";
import RoleSection from "./sections/RoleSection.vue";
import PlaybackSection from "./sections/PlaybackSection.vue";
import OwnerSection from "./sections/OwnerSection.vue";
import CourseSection from "./sections/CourseSection.vue";
import ProductSection from "./sections/ProductSection.vue";

const router = useRouter();
const { form, submitting, validate } = useLiveForm();
const leave = useLeaveConfirm();
const { takeSnapshot } = leave.trackForm(form);

onMounted(() => {
  takeSnapshot();
});

async function onCancel() {
  if (!(await leave.confirmLeave())) return;
  leave.allowNextNavigation();
  void router.push("/live");
}

function buildPayload(): CreateActivityPayload {
  const payload: CreateActivityPayload = {
    provider: form.provider,
    title: form.name.trim(),
    startTime: `${form.startDate} ${form.startTime}:00`,
    type: MODE_TO_TYPE[form.mode],
    viewerStyle: form.viewerStyle,
    ultraLowLatency: form.ultraLowLatency,
    virtualAvatar: form.virtualAvatar,
  };
  const intro = form.intro.trim();
  if (intro) payload.introduction = intro;
  if (form.endDate && form.endTime) {
    payload.endTime = `${form.endDate} ${form.endTime}:00`;
  }
  if (form.mode === "recorded" && form.recordId.trim()) {
    payload.recordId = form.recordId.trim();
  }
  if (form.detailCover) payload.coverUrl = form.detailCover;
  if (form.warmupType === "image" && form.warmupImage) {
    payload.warmupType = "image";
    payload.warmupUrl = form.warmupImage;
  }
  if (form.promoCover) payload.promoCoverUrl = form.promoCover;
  if (form.detailHtml?.trim()) payload.detailHtml = form.detailHtml;
  return payload;
}

async function onSave() {
  const err = validate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const data = await createActivity(buildPayload());
    ElMessage.success("创建成功");
    leave.allowNextNavigation();
    void router.push(`/live/${data.id}`);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="live-create">
    <div class="live-create__crumb">
      新建直播
      <ElIcon class="live-create__crumb-arrow"><ArrowRight /></ElIcon>
    </div>

    <div class="live-create__form">
      <div class="card">
        <BasicInfoSection :form="form" />
        <CoverSection :form="form" />
        <DetailSection :form="form" />
        <div class="placeholder-tip">以下区块本迭代暂不保存，请勿依赖其提交</div>
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
    </div>

    <div class="live-create__footer">
      <ElCheckbox v-model="form.agreed">
        我已阅读并同意遵守
        <a class="link">《钱坤直播运营规范》</a>
      </ElCheckbox>
      <div class="flex items-center gap-3">
        <ElButton @click="onCancel">取消</ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          @click="onSave"
        >
          保存
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-create {
  position: relative;
  padding-bottom: 80px;
}
.live-create__crumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}
.live-create__crumb-arrow {
  font-size: 12px;
  color: #999;
}
.live-create__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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
.live-create__footer {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  height: 64px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 10;
}
.link {
  color: var(--color-primary);
  cursor: pointer;
}
</style>
