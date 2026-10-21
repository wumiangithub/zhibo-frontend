<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { MaterialListItem } from "@/api/materials";
import MaterialPickerDialog from "./MaterialPickerDialog.vue";

defineProps<{
  modelValue: boolean;
  selectedId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
  select: [item: MaterialListItem];
}>();

function onConfirm(items: MaterialListItem[]) {
  const item = items[0];
  if (!item) {
    ElMessage.warning("请先选择一个视频");
    return;
  }
  if (item.type !== "video") {
    ElMessage.warning("录播请选择视频素材");
    return;
  }
  emit("select", item);
}
</script>

<template>
  <MaterialPickerDialog
    :model-value="modelValue"
    title="选择视频"
    hint="从素材中心选择一个已审核通过的视频"
    :selected-ids="selectedId ? [selectedId] : []"
    :max="1"
    :allowed-types="['video']"
    default-type="video"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="onConfirm"
  />
</template>
