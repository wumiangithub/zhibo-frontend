<script setup lang="ts">
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
</script>

<template>
  <FormRow
    label="归属人:"
    info="指定负责数据的员工，可用于角色管理的数据权限设置，控制不同角色在列表可查看的数据"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="ghost-btn"
        @click="form.owner = '吴先生'"
      >
        + 选择员工
      </button>
      <span
        v-if="form.owner"
        class="owner-tag"
      >
        {{ form.owner }}
        <i
          class="owner-tag__x"
          @click="form.owner = ''"
        >×</i>
      </span>
    </div>
  </FormRow>
</template>

<style scoped>
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
.owner-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
}
.owner-tag__x {
  cursor: pointer;
  font-style: normal;
  color: #999;
}
.owner-tag__x:hover {
  color: #f5222d;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
