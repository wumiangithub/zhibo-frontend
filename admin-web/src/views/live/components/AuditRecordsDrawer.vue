<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AuditTimelineDrawer, {
  type AuditTimelineNode,
} from "@/components/audit/AuditTimelineDrawer.vue";
import { resolveAuditActorTag } from "@/components/audit/resolveAuditActorTag";
import { ensureActivitySubmitAudit, listActivityAudits, type AuditRecord } from "@/api/activity";

const props = defineProps<{
  modelValue: boolean;
  activityId: string;
  title?: string;
  coverUrl?: string;
  createdTime?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const nodes = ref<AuditTimelineNode[]>([]);
const loading = ref(false);

function mapRow(a: AuditRecord): AuditTimelineNode {
  const isApply = a.action === "submit" || !a.result;
  if (isApply) {
    return {
      id: a.id,
      variant: "apply",
      tag: "发起申请",
      operatorName: a.operatorName,
      createdTime: a.createdTime,
      departmentName: a.departmentName,
      // 与原直播管理文案一致：提交行也写「审核人」
      operatorLabel: "审核人",
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
    operatorLabel: "审核人",
  };
}

watch(
  () => [props.modelValue, props.activityId] as const,
  async ([open]) => {
    if (!open || !props.activityId) return;
    loading.value = true;
    try {
      const list = ensureActivitySubmitAudit(
        (await listActivityAudits(props.activityId)).list ?? [],
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
