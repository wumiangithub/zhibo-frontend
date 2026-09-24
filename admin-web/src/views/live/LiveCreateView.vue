<script setup lang="ts">
import { useRouter } from "vue-router";
import { ElCheckbox, ElButton, ElMessage, ElIcon } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import { useLiveForm } from "./composables/useLiveForm";
import { createActivity } from "@/api/activity";
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

/** 前端 mode → 后端 type：视频=2 / 语音=1 / 录播=4(点播，后端待支持) */
const MODE_TO_TYPE: Record<string, number> = {
  video: 2,
  voice: 1,
  recorded: 4,
};

function onCancel() {
  void router.push("/live");
}

async function onSave() {
  const err = validate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    // 当前后端只接收 title / startTime / type；其余字段等后端扩字段后再补
    const data = await createActivity({
      title: form.name.trim(),
      startTime: `${form.startDate} ${form.startTime}:00`,
      type: MODE_TO_TYPE[form.mode] ?? 2,
    });
    ElMessage.success("创建成功");
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
        >保存</ElButton>
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
