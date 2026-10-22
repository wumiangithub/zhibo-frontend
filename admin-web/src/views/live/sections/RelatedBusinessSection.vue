<script setup lang="ts">
import type { EmployeeItem } from "@/api/activity";
import type { LiveFormState } from "../composables/useLiveForm";
import HostSection from "./HostSection.vue";
import OwnerSection from "./OwnerSection.vue";
import RelatedProductsSection from "./RelatedProductsSection.vue";
import CoursewareSection from "./CoursewareSection.vue";
import AutoListSection from "./AutoListSection.vue";

withDefaults(
  defineProps<{
    form: LiveFormState;
    /** 详情回显：主播姓名 */
    knownHosts?: EmployeeItem[];
    /** 详情回显：归属人姓名 */
    knownOwners?: EmployeeItem[];
    /** 主播禁止手选（新建：仅从报备导入；设置：已绑报备时锁定） */
    hostLocked?: boolean;
  }>(),
  { hostLocked: false },
);
</script>

<template>
  <div class="related-business">
    <div class="related-business__title">关联业务配置</div>
    <div class="related-business__body">
      <HostSection
        :form="form"
        :known="knownHosts"
        :locked="hostLocked"
      />
      <OwnerSection
        :form="form"
        :known="knownOwners"
      />
      <RelatedProductsSection :form="form" />
      <CoursewareSection :form="form" />
      <AutoListSection :form="form" />
    </div>
  </div>
</template>

<style scoped>
.related-business {
  margin: 20px 0;
  padding: 18px 20px 4px;
  background: #fafbfc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}
.related-business__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}
.related-business__body :deep(.form-row:last-child) {
  margin-bottom: 14px;
}
</style>
