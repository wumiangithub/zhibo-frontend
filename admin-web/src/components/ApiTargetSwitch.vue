<script setup lang="ts">
import { ElMessageBox } from "element-plus";
import {
  apiTargetLabel,
  getApiTarget,
  isApiSwitchEnabled,
  persistApiTarget,
  type ApiTarget,
} from "@/utils/apiTarget";

const visible = isApiSwitchEnabled();
const current = getApiTarget();
const label = apiTargetLabel(current);
const next: ApiTarget = current === "ours" ? "official" : "ours";
const nextLabel = apiTargetLabel(next);

async function onSwitch() {
  try {
    await ElMessageBox.confirm(
      `将切换到「${nextLabel}」并刷新页面。登录态会保留，若接口校验失败再重新登录。`,
      "切换接口服务",
      {
        confirmButtonText: "切换",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
  } catch {
    return;
  }
  persistApiTarget(next);
  window.location.reload();
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="api-target-switch"
    :title="`当前：${label}。点击切换到${nextLabel}`"
    @click="onSwitch"
  >
    接口：{{ label }}
  </button>
</template>

<style scoped>
.api-target-switch {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 4000;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 999px;
  background: #fff;
  color: var(--text-2, #475569);
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}
.api-target-switch:hover {
  color: var(--primary, #2563eb);
  border-color: var(--primary, #2563eb);
}
</style>
