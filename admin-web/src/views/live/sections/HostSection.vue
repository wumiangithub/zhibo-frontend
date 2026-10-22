<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElInput, ElMessage, ElOption, ElSelect } from "element-plus";
import { listEmployees, type EmployeeItem } from "@/api/activity";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = withDefaults(
  defineProps<{
    form: LiveFormState;
    /** 详情回显时带姓名 / 头像 */
    known?: EmployeeItem[];
    /** 禁止手选/清除；主播仅由绑定直播报备导入 */
    locked?: boolean;
  }>(),
  { locked: false },
);
const form = props.form;
const markDirty = useMarkDirty();

const loading = ref(false);
const options = ref<EmployeeItem[]>([]);
const selected = ref<EmployeeItem | null>(null);
const brokenAvatar = ref<Record<string, boolean>>({});

function idKey(id: string | number | null | undefined) {
  if (id == null || id === "") return "";
  return String(id);
}

/** UI 单选；契约仍为 hostIds 数组，长度 0 或 1 */
const hostId = computed(() => idKey(form.hostIds[0]));

const lockedDisplayName = computed(() => {
  const name = selected.value?.userName?.trim();
  if (name && name !== hostId.value) return name;
  return "";
});

function toEmployeeId(raw: string | number): number {
  return typeof raw === "number" ? raw : Number(raw);
}

function mergeEmployee(a?: EmployeeItem, b?: EmployeeItem): EmployeeItem | undefined {
  if (!a && !b) return undefined;
  const raw = a?.id ?? b?.id;
  if (raw == null || raw === ("" as unknown)) return undefined;
  const fallback = idKey(raw);
  return {
    id: toEmployeeId(raw),
    userName: (a?.userName || b?.userName || fallback).trim() || fallback,
    avatar: a?.avatar?.trim() || b?.avatar?.trim() || undefined,
    departmentName:
      a?.departmentName?.trim() || b?.departmentName?.trim() || undefined,
  };
}

function deptOf(emp: EmployeeItem) {
  return emp.departmentName?.trim() || "";
}

function syncSelected(id: string) {
  if (!id) {
    selected.value = null;
    return;
  }
  const fromOpt = options.value.find((o) => idKey(o.id) === id);
  const fromKnown = (props.known ?? []).find((k) => idKey(k.id) === id);
  const prev = selected.value && idKey(selected.value.id) === id ? selected.value : undefined;
  selected.value =
    mergeEmployee(fromOpt, fromKnown) ??
    mergeEmployee(prev, fromKnown) ??
    mergeEmployee(fromKnown, undefined) ?? {
      id: toEmployeeId(id),
      userName: fromKnown?.userName?.trim() || id,
    };
  // 保证下拉能解析出 label（避免只显示裸 id）
  const emp = selected.value;
  if (emp && !options.value.some((o) => idKey(o.id) === id)) {
    options.value = [emp, ...options.value];
  }
}

async function loadEmployees(keyword?: string) {
  loading.value = true;
  try {
    const data = await listEmployees(keyword);
    const list = data.list ?? [];
    const map = new Map<string, EmployeeItem>();
    for (const o of list) map.set(idKey(o.id), o);
    for (const o of props.known ?? []) {
      map.set(idKey(o.id), mergeEmployee(map.get(idKey(o.id)), o)!);
    }
    if (selected.value) {
      const sid = idKey(selected.value.id);
      map.set(sid, mergeEmployee(map.get(sid), selected.value)!);
    }
    if (hostId.value && !map.has(hostId.value)) {
      const known = (props.known ?? []).find((k) => idKey(k.id) === hostId.value);
      map.set(
        hostId.value,
        known ?? {
          id: toEmployeeId(hostId.value),
          userName: hostId.value,
        },
      );
    }
    options.value = [...map.values()];
    syncSelected(hostId.value);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
    options.value = [];
  } finally {
    loading.value = false;
  }
}

/** 后端若返回多人，UI 只保留第一人 */
function normalizeToSingle() {
  if (form.hostIds.length > 1) {
    form.hostIds = form.hostIds.slice(0, 1);
  }
}

function onChange(id: string | number | null | undefined) {
  if (props.locked) return;
  const next = id != null && id !== "" ? [idKey(id)] : [];
  if (next.length === form.hostIds.length && idKey(next[0]) === idKey(form.hostIds[0])) {
    syncSelected(next[0] ?? "");
    return;
  }
  form.hostIds = next;
  syncSelected(next[0] ?? "");
  markDirty();
}

function clearHost() {
  if (props.locked) return;
  form.hostIds = [];
  selected.value = null;
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
  () => [
    form.hostIds.map((id) => idKey(id)).join(","),
    (props.known ?? [])
      .map((k) => `${idKey(k.id)}:${k.userName}:${k.departmentName ?? ""}:${k.avatar ?? ""}`)
      .join(","),
  ],
  () => {
    normalizeToSingle();
    syncSelected(hostId.value);
  },
  { immediate: true },
);

onMounted(() => {
  if (!props.locked) void loadEmployees();
});
</script>

<template>
  <FormRow
    label="主播:"
    required
    :info="locked ? '不可手选，请先绑定直播报备后自动带入' : undefined"
  >
    <div class="host-wrap">
      <!-- 锁定：只读展示姓名，避免 ElSelect 无 option 时回退显示裸 id -->
      <ElInput
        v-if="locked"
        :model-value="lockedDisplayName"
        disabled
        placeholder="请先绑定直播报备"
        style="width: 320px"
      />
      <ElSelect
        v-else
        :model-value="hostId || undefined"
        filterable
        remote
        clearable
        :remote-method="loadEmployees"
        :loading="loading"
        placeholder="请选择主播"
        style="width: 320px"
        @update:model-value="onChange"
        @visible-change="(open: boolean) => open && loadEmployees()"
      >
        <ElOption
          v-for="emp in options"
          :key="idKey(emp.id)"
          :label="emp.userName"
          :value="idKey(emp.id)"
        >
          <span class="host-option">
            <span class="host-option__avatar">
              <img
                v-if="avatarOf(emp)"
                :src="avatarOf(emp)"
                alt=""
                @error="onAvatarError(idKey(emp.id))"
              >
              <svg
                v-else
                class="host-option__icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
              </svg>
            </span>
            <span>{{ emp.userName }}</span>
            <span
              v-if="deptOf(emp)"
              class="host-option__dept"
            >{{ deptOf(emp) }}</span>
          </span>
        </ElOption>
      </ElSelect>
      <div
        v-if="selected"
        class="host-tags"
      >
        <span class="host-tag">
          <span class="host-tag__avatar">
            <img
              v-if="avatarOf(selected)"
              :src="avatarOf(selected)"
              alt=""
              @error="onAvatarError(selected.id)"
            >
            <svg
              v-else
              class="host-tag__icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
            </svg>
          </span>
          <span class="host-tag__name">{{ selected.userName }}</span>
          <span
            v-if="deptOf(selected)"
            class="host-tag__dept"
          >{{ deptOf(selected) }}</span>
          <i
            v-if="!locked"
            class="host-tag__x"
            @click="clearHost"
          >×</i>
        </span>
      </div>
    </div>
  </FormRow>
</template>

<style scoped>
.host-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.host-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.host-option__dept,
.host-tag__dept {
  color: #999;
  font-size: 12px;
}
.host-option__avatar,
.host-tag__avatar {
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
.host-option__avatar img,
.host-tag__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.host-option__icon,
.host-tag__icon {
  width: 12px;
  height: 12px;
}
.host-tags {
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
.host-tag {
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
.host-tag__name {
  line-height: 1;
}
.host-tag__x {
  cursor: pointer;
  font-style: normal;
  color: #999;
  line-height: 1;
  font-size: 14px;
}
.host-tag__x:hover {
  color: #f5222d;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
