<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AuditTimelineDrawer, {
  type AuditTimelineNode,
} from "@/components/audit/AuditTimelineDrawer.vue";
import { resolveAuditActorTag } from "@/components/audit/resolveAuditActorTag";
import { listLiveReportAudits, type ReportAudit } from "@/api/liveReport";

const props = defineProps<{
  modelValue: boolean;
  reportId: string;
  title?: string;
  coverUrl?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const nodes = ref<AuditTimelineNode[]>([]);
const loading = ref(false);

function mapRow(a: ReportAudit): AuditTimelineNode {
  if (a.action === "submit") {
    return {
      id: a.id,
      variant: "apply",
      tag: "发起申请",
      operatorName: a.operatorName,
      createdTime: a.createdTime,
      departmentName: a.departmentName,
    };
  }
  if (a.action === "resubmit") {
    return {
      id: a.id,
      variant: "apply",
      tag: "重新提交",
      operatorName: a.operatorName,
      createdTime: a.createdTime,
      departmentName: a.departmentName,
    };
  }
  if (a.action === "append") {
    return {
      id: a.id,
      variant: "apply",
      tag: "追加计划时间",
      operatorName: a.operatorName,
      createdTime: a.createdTime,
      departmentName: a.departmentName,
      reason: a.reason,
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
  () => [props.modelValue, props.reportId] as const,
  async ([open, reportId]) => {
    if (!open || !reportId) return;
    loading.value = true;
    try {
      nodes.value = ((await listLiveReportAudits(reportId)).list ?? []).map(mapRow);
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
