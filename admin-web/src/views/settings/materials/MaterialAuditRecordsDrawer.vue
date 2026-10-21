<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AuditTimelineDrawer, {
  type AuditTimelineNode,
} from "@/components/audit/AuditTimelineDrawer.vue";
import { resolveAuditActorTag } from "@/components/audit/resolveAuditActorTag";
import {
  ensureMaterialSubmitAudit,
  listMaterialAudits,
  type MaterialAuditRecord,
} from "@/api/materials";

const props = defineProps<{
  modelValue: boolean;
  materialId: string;
  title?: string;
  coverUrl?: string;
  /** 列表行上传时间，供无 submit 时合成「发起申请」 */
  uploadedTime?: string;
  uploaderName?: string;
  departmentName?: string;
  uploaderId?: number;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const nodes = ref<AuditTimelineNode[]>([]);
const loading = ref(false);

function mapRow(a: MaterialAuditRecord): AuditTimelineNode {
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
  const channel = a.action === "ai" ? "ai" : a.action === "risk" ? "risk" : null;
  return {
    id: a.id,
    variant: "audit",
    channel,
    tag: resolveAuditActorTag({
      channel,
      departmentName: a.departmentName,
    }),
    operatorName: a.operatorName,
    createdTime: a.createdTime,
    departmentName: a.departmentName,
    result: a.result,
  };
}

watch(
  () => [props.modelValue, props.materialId] as const,
  async ([open, materialId]) => {
    if (!open || !materialId) return;
    loading.value = true;
    try {
      const list = ensureMaterialSubmitAudit((await listMaterialAudits(materialId)).list ?? [], {
        uploadedTime: props.uploadedTime,
        uploaderName: props.uploaderName,
        departmentName: props.departmentName,
        uploaderId: props.uploaderId,
      });
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
