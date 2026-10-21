<script setup lang="ts">
import { useRouter } from "vue-router";
import { ElCheckbox, ElButton, ElMessage, ElIcon } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import { createActivity, type CreateActivityPayload } from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { useAuthStore } from "@/stores/auth";
import {
  MODE_TO_TYPE,
  resolveDefaultOwner,
  useLiveForm,
} from "./composables/useLiveForm";
import BasicInfoSection from "./sections/BasicInfoSection.vue";
import ProviderModeSection from "./sections/ProviderModeSection.vue";
import RelatedBusinessSection from "./sections/RelatedBusinessSection.vue";

const router = useRouter();
const auth = useAuthStore();
const { form, submitting, validateCreate } = useLiveForm();
const leave = useLeaveConfirm();

/** 仅新建：归属人默认当前登录用户，可改选；编辑页走详情回显 */
const { ownerIds: defaultOwnerIds, knownOwners } = resolveDefaultOwner(auth.user);
if (defaultOwnerIds.length) {
  form.ownerIds = [...defaultOwnerIds];
}

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
    autoList: form.autoList,
    hostIds: form.hostIds.slice(0, 1),
  };
  if (form.reportId) payload.reportId = form.reportId;
  const intro = form.intro.trim();
  if (intro) payload.introduction = intro;
  if (form.endDate && form.endTime) {
    payload.endTime = `${form.endDate} ${form.endTime}:00`;
  }
  if (form.mode === "recorded") {
    if (form.recordSource === "video" && form.materialId.trim()) {
      payload.materialId = form.materialId.trim();
    } else if (form.recordSource === "live" && form.recordId.trim()) {
      payload.recordId = form.recordId.trim();
    }
  }
  if (form.detailCover) payload.coverUrl = form.detailCover;
  if (form.detailHtml?.trim()) payload.detailHtml = form.detailHtml;
  if (form.ownerIds.length) payload.ownerIds = [...form.ownerIds];
  if (form.products.length) {
    payload.products = form.products.map((p) => ({
      spuId: String(p.spuId),
      productName: p.productName.trim(),
    }));
  }
  if (form.coursewareMaterialIds.length) {
    payload.coursewareMaterialIds = [...form.coursewareMaterialIds];
  }
  return payload;
}

async function onSave() {
  const err = validateCreate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    await createActivity(buildPayload());
    ElMessage.success("创建成功");
    leave.allowNextNavigation();
    void router.push("/live");
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
        <BasicInfoSection
          :form="form"
          show-report-bind
        />
        <ProviderModeSection :form="form" />
        <RelatedBusinessSection
          :form="form"
          :known-hosts="form.reportHost ? [form.reportHost] : []"
          :known-owners="knownOwners"
          host-locked
        />
      </div>
    </div>

    <div class="live-create__footer">
      <ElCheckbox
        v-model="form.agreed"
        @change="leave.markDirty"
      >
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
          确定
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
