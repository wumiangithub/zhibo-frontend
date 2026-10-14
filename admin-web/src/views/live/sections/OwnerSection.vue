<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElOption, ElSelect } from "element-plus";
import { listEmployees, type EmployeeItem } from "@/api/activity";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const form = props.form;

const loading = ref(false);
const options = ref<EmployeeItem[]>([]);
const selected = ref<EmployeeItem[]>([]);

async function loadEmployees(keyword?: string) {
  loading.value = true;
  try {
    const data = await listEmployees(keyword);
    options.value = data.list ?? [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
    options.value = [];
  } finally {
    loading.value = false;
  }
}

function onChange(ids: string[]) {
  form.ownerIds = ids;
  const map = new Map(options.value.map((o) => [o.id, o]));
  for (const o of selected.value) map.set(o.id, o);
  selected.value = ids.map((id) => map.get(id) ?? { id, userName: id });
}

function removeOwner(id: string) {
  form.ownerIds = form.ownerIds.filter((x) => x !== id);
  selected.value = selected.value.filter((x) => x.id !== id);
}

onMounted(() => {
  void loadEmployees();
});
</script>

<template>
  <FormRow
    label="归属人:"
    info="指定负责数据的员工，可用于角色管理的数据权限设置，控制不同角色在列表可查看的数据"
  >
    <div class="owner-wrap">
      <ElSelect
        :model-value="form.ownerIds"
        multiple
        filterable
        remote
        clearable
        collapse-tags
        collapse-tags-tooltip
        :remote-method="loadEmployees"
        :loading="loading"
        placeholder="搜索并选择员工"
        style="width: 320px"
        @update:model-value="onChange"
        @visible-change="(open: boolean) => open && loadEmployees()"
      >
        <ElOption
          v-for="emp in options"
          :key="emp.id"
          :label="emp.userName"
          :value="emp.id"
        />
      </ElSelect>
      <div
        v-if="selected.length"
        class="owner-tags"
      >
        <span
          v-for="emp in selected"
          :key="emp.id"
          class="owner-tag"
        >
          {{ emp.userName }}
          <i
            class="owner-tag__x"
            @click="removeOwner(emp.id)"
          >×</i>
        </span>
      </div>
    </div>
  </FormRow>
</template>

<style scoped>
.owner-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.owner-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
