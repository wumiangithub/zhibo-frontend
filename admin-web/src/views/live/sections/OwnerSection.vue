<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { ElMessage, ElOption, ElSelect } from "element-plus";
import { listEmployees, type EmployeeItem } from "@/api/activity";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{
  form: LiveFormState;
  known?: EmployeeItem[];
}>();
const form = props.form;
const markDirty = useMarkDirty();

const loading = ref(false);
const options = ref<EmployeeItem[]>([]);
const selected = ref<EmployeeItem[]>([]);
/** 头像加载失败时降级为占位图标 */
const brokenAvatar = ref<Record<string, boolean>>({});

function mergeEmployee(a?: EmployeeItem, b?: EmployeeItem): EmployeeItem | undefined {
  if (!a && !b) return undefined;
  const id = a?.id || b?.id || "";
  return {
    id,
    userName: (a?.userName || b?.userName || id).trim() || id,
    avatar: a?.avatar?.trim() || b?.avatar?.trim() || undefined,
  };
}

async function loadEmployees(keyword?: string) {
  loading.value = true;
  try {
    const data = await listEmployees(keyword);
    const list = data.list ?? [];
    // 已选 / known（含新建默认的当前用户）不在列表时仍注入选项，保证下拉与标签能显示姓名/头像
    const map = new Map<string, EmployeeItem>();
    for (const o of list) map.set(o.id, o);
    for (const o of props.known ?? []) {
      map.set(o.id, mergeEmployee(map.get(o.id), o)!);
    }
    for (const o of selected.value) {
      map.set(o.id, mergeEmployee(map.get(o.id), o)!);
    }
    for (const id of form.ownerIds) {
      if (!map.has(id)) {
        const known = (props.known ?? []).find((k) => k.id === id);
        map.set(id, known ?? { id, userName: id });
      }
    }
    options.value = [...map.values()];
    syncSelected(form.ownerIds);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
    options.value = [];
  } finally {
    loading.value = false;
  }
}

function syncSelected(ids: string[]) {
  const map = new Map<string, EmployeeItem>();
  for (const o of options.value) map.set(o.id, o);
  for (const o of selected.value) {
    map.set(o.id, mergeEmployee(map.get(o.id), o)!);
  }
  for (const o of props.known ?? []) {
    map.set(o.id, mergeEmployee(map.get(o.id), o)!);
  }
  selected.value = ids.map((id) => map.get(id) ?? { id, userName: id });
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function onChange(ids: string[]) {
  const next = [...new Set(ids)].slice(0, 20);
  // ElSelect 选项异步加载后可能无差异回发，忽略
  if (sameIds(next, form.ownerIds)) {
    syncSelected(next);
    return;
  }
  form.ownerIds = next;
  syncSelected(next);
  markDirty();
}

function removeOwner(id: string) {
  form.ownerIds = form.ownerIds.filter((x) => x !== id);
  selected.value = selected.value.filter((x) => x.id !== id);
  markDirty();
}

function onAvatarError(id: string) {
  brokenAvatar.value = { ...brokenAvatar.value, [id]: true };
}

function avatarOf(emp: EmployeeItem) {
  const url = emp.avatar?.trim();
  if (!url || brokenAvatar.value[emp.id]) return "";
  return url;
}

watch(
  () => [form.ownerIds.join(","), (props.known ?? []).map((k) => k.id).join(",")],
  () => syncSelected(form.ownerIds),
  { immediate: true },
);

onMounted(() => {
  void loadEmployees();
});
</script>

<template>
  <FormRow
    label="归属人:"
    info="新建时默认选中当前登录用户，可改选。指定负责数据的员工"
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
        placeholder="+ 选择员工"
        style="width: 320px"
        @update:model-value="onChange"
        @visible-change="(open: boolean) => open && loadEmployees()"
      >
        <ElOption
          v-for="emp in options"
          :key="emp.id"
          :label="emp.userName"
          :value="emp.id"
        >
          <span class="owner-option">
            <span class="owner-option__avatar">
              <img
                v-if="avatarOf(emp)"
                :src="avatarOf(emp)"
                alt=""
                @error="onAvatarError(emp.id)"
              >
              <svg
                v-else
                class="owner-option__icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
              </svg>
            </span>
            <span>{{ emp.userName }}</span>
          </span>
        </ElOption>
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
          <span class="owner-tag__avatar">
            <img
              v-if="avatarOf(emp)"
              :src="avatarOf(emp)"
              alt=""
              @error="onAvatarError(emp.id)"
            >
            <svg
              v-else
              class="owner-tag__icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
            </svg>
          </span>
          <span class="owner-tag__name">{{ emp.userName }}</span>
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
.owner-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.owner-option__avatar,
.owner-tag__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  background: #d9d9d9;
  color: #fff;
  flex-shrink: 0;
}
.owner-option__avatar img,
.owner-tag__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.owner-option__icon,
.owner-tag__icon {
  width: 12px;
  height: 12px;
}
.owner-tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  padding: 10px 12px;
  background: #f5f6f8;
  border-radius: 6px;
}
.owner-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  color: #333;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 4px 10px 4px 4px;
  font-size: 13px;
}
.owner-tag__name {
  line-height: 1;
}
.owner-tag__x {
  cursor: pointer;
  font-style: normal;
  color: #999;
  line-height: 1;
  font-size: 14px;
}
.owner-tag__x:hover {
  color: #f5222d;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
