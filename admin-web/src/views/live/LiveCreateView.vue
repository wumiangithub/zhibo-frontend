<script setup lang="ts">
import { useRouter } from "vue-router";
import { ElCheckbox, ElMessage } from "element-plus";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
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

const crumbs: AppBreadcrumbItem[] = [
  { label: "直播管理", to: "/live" },
  { label: "新建直播" },
];

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
    listed: form.listed,
    hostIds: form.hostIds.slice(0, 1).map((id) => Number(id)),
    reportId: form.reportId.trim(),
  };
  const intro = form.intro.trim();
  if (intro) payload.introduction = intro;
  if (form.endDate && form.endTime) {
    payload.endTime = `${form.endDate} ${form.endTime}:00`;
  }
  if (form.mode === "recorded") {
    payload.isTiming = form.isTiming;
    if (form.recordSource === "video" && form.materialId.trim()) {
      payload.recordMaterialId = form.materialId.trim();
    } else if (form.recordSource === "live" && form.recordId != null && form.recordId > 0) {
      payload.recordId = form.recordId;
    }
  }
  if (form.detailCover) payload.coverUrl = form.detailCover;
  if (form.detailHtml?.trim()) payload.detailHtml = form.detailHtml;
  if (form.ownerIds.length) payload.ownerIds = form.ownerIds.map((id) => Number(id));
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
    <AppBreadcrumb :items="crumbs" />
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

    <div class="admin-page-footer live-create__footer">
      <ElCheckbox
        v-model="form.agreed"
        @change="leave.markDirty"
      >
        我已阅读并同意遵守
        <a class="link">《钱坤直播运营规范》</a>
      </ElCheckbox>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="admin-btn admin-btn--ghost"
          :disabled="submitting"
          @click="onCancel"
        >
          取消
        </button>
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          :disabled="submitting"
          @click="onSave"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-create {
  position: relative;
  padding-bottom: 80px;
}
.live-create__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: var(--shadow);
}
.live-create__footer {
  justify-content: space-between;
}
.link {
  color: var(--color-primary);
  cursor: pointer;
}
</style>
