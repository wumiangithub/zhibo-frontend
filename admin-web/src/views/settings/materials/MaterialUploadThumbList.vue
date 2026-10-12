<script setup lang="ts">
import { ElProgress, ElIcon } from "element-plus";
import { CircleCheckFilled } from "@element-plus/icons-vue";
import type { UploadItem } from "./materialUploadTypes";

defineProps<{
  items: UploadItem[];
}>();

function overlayLabel(item: UploadItem) {
  if (item.status === "waiting") return "等待上传";
  if (item.status === "error") return "上传失败";
  if (item.status === "cancelled") return "已取消";
  return `${item.percent.toFixed(1)}%`;
}
</script>

<template>
  <ul class="thumb-list">
    <li
      v-for="item in items"
      :key="item.uid"
      class="thumb-item"
      :class="{ 'is-success': item.status === 'success' }"
    >
      <img
        :src="item.previewUrl"
        :alt="item.name"
        class="thumb-img"
      >
      <div
        v-if="item.status === 'success'"
        class="thumb-success"
        title="上传成功"
      >
        <ElIcon :size="20"><CircleCheckFilled /></ElIcon>
      </div>
      <div
        v-else-if="item.status !== 'cancelled'"
        class="thumb-overlay"
      >
        <div class="overlay-label">{{ overlayLabel(item) }}</div>
        <ElProgress
          :percentage="item.status === 'waiting' ? 0 : item.percent"
          :stroke-width="3"
          :show-text="false"
          :color="item.status === 'error' ? 'var(--el-color-danger)' : '#fff'"
          class="overlay-progress"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow: auto;
}

.thumb-item {
  position: relative;
  width: 120px;
  height: 120px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 4px;
  overflow: hidden;
  background: #f7f8fa;
  flex: none;
}

.thumb-item.is-success {
  border-color: var(--color-success);
}

.thumb-success {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  color: var(--color-success);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 10px;
  background: rgba(0, 0, 0, 0.45);
}

.overlay-label {
  color: #fff;
  font-size: 13px;
  line-height: 1;
}

.overlay-progress {
  width: 80%;
}

.overlay-progress :deep(.el-progress-bar__outer) {
  background-color: rgba(255, 255, 255, 0.35);
}
</style>
