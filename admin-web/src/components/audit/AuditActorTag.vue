<script setup lang="ts">
import { computed } from "vue";
import {
  resolveAuditActorTag,
  type AuditActorChannel,
} from "./resolveAuditActorTag";

const props = defineProps<{
  /** 已算好的文案；与 channel/部门二选一，优先 text */
  text?: string;
  channel?: AuditActorChannel | null;
  departmentName?: string | null;
}>();

const label = computed(() => {
  if (props.text?.trim()) return props.text.trim();
  return resolveAuditActorTag({
    channel: props.channel,
    departmentName: props.departmentName,
  });
});
</script>

<template>
  <span class="audit-actor-tag">{{ label }}</span>
</template>

<style scoped>
.audit-actor-tag {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  font-size: 12px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  background: #fff;
}
</style>
