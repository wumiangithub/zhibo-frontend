<script setup lang="ts">
import { EditPen, VideoPlay } from "@element-plus/icons-vue";
import type { MaterialListItem, MaterialType } from "@/api/materials";
import { getMaterialFileIcon } from "./materialFileIcons";
import { formatUploadSize } from "./materialUploadFormat";
import { getTosPreviewUrl } from "@/utils/fileInfo";

const props = defineProps<{
  row: MaterialListItem;
  materialType: MaterialType;
}>();

const emit = defineEmits<{
  "edit-name": [row: MaterialListItem];
  "thumb-click": [row: MaterialListItem];
}>();

function thumbSrc(row: MaterialListItem) {
  if (props.materialType === "document") {
    return getMaterialFileIcon(row.name);
  }
  const base = row.thumbUrl || row.url;
  if (!base) return "";
  return getTosPreviewUrl(base, 160, 90);
}

function metaText(row: MaterialListItem) {
  if (row.meta) return row.meta;
  if (typeof row.fileSize === "number" && row.fileSize > 0) {
    return formatUploadSize(row.fileSize);
  }
  return "";
}

function onThumbClick(e: MouseEvent, row: MaterialListItem) {
  emit("thumb-click", row);
  // 关闭预览后避免 button 残留 :focus 黑边
  (e.currentTarget as HTMLButtonElement | null)?.blur();
}
</script>

<template>
  <div class="asset-cell">
    <button
      v-if="materialType === 'image' || materialType === 'video'"
      type="button"
      class="thumb is-clickable"
      :title="materialType === 'image' ? '点击预览' : '点击播放'"
      @click="onThumbClick($event, row)"
    >
      <img
        v-if="thumbSrc(row)"
        :src="thumbSrc(row)"
        :alt="row.name"
      >
      <span v-else>—</span>
      <span
        v-if="materialType === 'video' && thumbSrc(row)"
        class="thumb-play"
      >
        <el-icon :size="18"><VideoPlay /></el-icon>
      </span>
    </button>
    <div
      v-else
      class="thumb is-file-icon"
    >
      <img
        v-if="thumbSrc(row)"
        class="thumb-file-icon"
        :src="thumbSrc(row)"
        :alt="row.name"
      >
      <span v-else>—</span>
    </div>
    <div class="asset-meta">
      <div class="asset-name">
        <span
          class="name-text"
          :title="row.name"
        >{{ row.name }}</span>
        <button
          type="button"
          class="icon-btn"
          title="编辑名称"
          @click="emit('edit-name', row)"
        >
          <el-icon><EditPen /></el-icon>
        </button>
      </div>
      <div class="asset-sub">{{ metaText(row) }}</div>
    </div>
  </div>
</template>

<style scoped>
.asset-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.thumb {
  position: relative;
  flex: none;
  width: 72px;
  height: 40px;
  overflow: hidden;
  border-radius: 4px;
  border: 0;
  padding: 0;
  background: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);
  font-size: 11px;
}

.thumb.is-clickable {
  cursor: pointer;
}

.thumb.is-clickable:focus {
  outline: none;
}

.thumb.is-clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.thumb.is-file-icon {
  width: 40px;
  height: 40px;
  background: transparent;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumb .thumb-file-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.thumb-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  opacity: 0.9;
  pointer-events: none;
}

.asset-meta {
  min-width: 0;
  flex: 1;
}

.asset-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text);
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  flex: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-placeholder);
  cursor: pointer;
  display: inline-flex;
}

.icon-btn:hover {
  color: var(--color-primary);
}

.asset-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>
