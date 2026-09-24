<script setup lang="ts">
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
</script>

<template>
  <div class="section">
    <div class="section__title">所属课程</div>
    <FormRow label="作为目录内容:">
      <button
        type="button"
        class="ghost-btn"
        @click="form.courseId = 'demo-course'"
      >
        + 选择课程/专栏/训练营/会员
      </button>
    </FormRow>
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
.ghost-btn {
  border: 1px solid var(--color-primary);
  background: #fff;
  color: var(--color-primary);
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.ghost-btn:hover {
  background: var(--color-primary-bg);
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
