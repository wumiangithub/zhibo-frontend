<script setup lang="ts">
import { ElProgress, ElIcon } from "element-plus";
import { CircleCheckFilled, Crop, Delete } from "@element-plus/icons-vue";
import type { UploadItem } from "./materialUploadTypes";

defineProps<{
  items: UploadItem[];
}>();

const emit = defineEmits<{
  crop: [item: UploadItem];
  remove: [item: UploadItem];
}>();

function overlayLabel(item: UploadItem) {
  if (item.status === "waiting") return "等待上传";
  if (item.status === "error") return "上传失败";
  if (item.status === "cancelled") return "已取消";
  return `${item.percent.toFixed(1)}%`;
}

/** 上传中禁用裁剪/删除；失败/等待/成功可裁；取消仅删 */
function canCrop(item: UploadItem) {
  return item.status === "waiting" || item.status === "success" || item.status === "error";
}

function canRemove(item: UploadItem) {
  return item.status !== "uploading";
}

function showHoverActions(item: UploadItem) {
  return canCrop(item) || canRemove(item);
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
      <div
        v-if="showHoverActions(item)"
        class="thumb-hover"
      >
        <button
          v-if="canCrop(item)"
          type="button"
          class="hover-btn"
          title="裁剪"
          @click.stop="emit('crop', item)"
        >
          <ElIcon :size="16"><Crop /></ElIcon>
          <span>裁剪</span>
        </button>
        <button
          v-if="canRemove(item)"
          type="button"
          class="hover-btn"
          title="删除"
          @click.stop="emit('remove', item)"
        >
          <ElIcon :size="16"><Delete /></ElIcon>
          <span>删除</span>
        </button>
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
  z-index: 1;
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
  z-index: 1;
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

.thumb-hover {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.thumb-item:hover .thumb-hover {
  opacity: 1;
}

.hover-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 40px;
  padding: 6px 4px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.hover-btn:hover {
  color: var(--color-primary-light, #a0cfff);
}
</style>
