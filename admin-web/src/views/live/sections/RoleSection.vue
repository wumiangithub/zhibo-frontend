<script setup lang="ts">
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
</script>

<template>
  <FormRow label="角色设置:">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="ghost-btn"
        @click="form.roles.push(`角色${form.roles.length + 1}`)"
      >
        + 添加角色
      </button>
      <span class="text-[12px] text-[#999]">添加用户成为主播、助理或嘉宾</span>
    </div>
    <div
      v-if="form.roles.length"
      class="mt-2 flex flex-wrap gap-2"
    >
      <span
        v-for="(r, i) in form.roles"
        :key="i"
        class="role-tag"
      >
        {{ r }}
        <i
          class="role-tag__x"
          @click="form.roles.splice(i, 1)"
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
.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
}
.role-tag__x {
  cursor: pointer;
  font-style: normal;
  color: #999;
}
.role-tag__x:hover {
  color: #f5222d;
}
</style>
