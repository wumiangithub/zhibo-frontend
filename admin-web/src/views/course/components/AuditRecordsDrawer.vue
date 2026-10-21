<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AuditTimelineDrawer, {
  type AuditTimelineNode,
} from "@/components/audit/AuditTimelineDrawer.vue";
import { resolveAuditActorTag } from "@/components/audit/resolveAuditActorTag";
import { ensureCourseSubmitAudit, listCourseAudits, type CourseAuditRecord } from "@/api/course";

const props = defineProps<{
  modelValue: boolean;
  courseId: string;
  title?: string;
  coverUrl?: string;
  createdTime?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
const nodes = ref<AuditTimelineNode[]>([]);
const loading = ref(false);

function mapRow(a: CourseAuditRecord): AuditTimelineNode {
  const isApply = a.action === "submit" || !a.result;
  if (isApply) {
    return {
      id: a.id,
      variant: "apply",
      tag: "发起申请",
      operatorName: a.operatorName,
      createdTime: a.createdTime,
      departmentName: a.departmentName,
    };
  }
  return {
    id: a.id,
    variant: "audit",
    tag: resolveAuditActorTag({
      departmentName: a.departmentName,
    }),
    operatorName: a.operatorName,
    createdTime: a.createdTime,
    departmentName: a.departmentName,
    result: a.result,
    reason: a.reason,
  };
}

watch(
  () => [props.modelValue, props.courseId] as const,
  async ([open]) => {
    if (!open || !props.courseId) return;
    loading.value = true;
    try {
      const list = ensureCourseSubmitAudit(
        (await listCourseAudits(props.courseId)).list ?? [],
        props.createdTime,
      );
      nodes.value = list.map(mapRow);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <AuditTimelineDrawer
    v-model="visible"
    :title="title"
    :cover-url="coverUrl"
    :loading="loading"
    :nodes="nodes"
  />
</template>
