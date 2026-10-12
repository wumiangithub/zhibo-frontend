<script setup lang="ts">
import { ElTable, ElTableColumn, ElProgress, ElIcon } from "element-plus";
import { VideoPlay } from "@element-plus/icons-vue";
import type { MaterialType } from "./mock";
import type { FileTableItem } from "./materialUploadTypes";
import { formatUploadSize, formatUploadSpeed } from "./materialUploadFormat";
import { getMaterialFileIcon } from "./materialFileIcons";

defineProps<{
  items: FileTableItem[];
  /** video | document */
  materialType: Extract<MaterialType, "video" | "document">;
}>();

const emit = defineEmits<{
  remove: [item: FileTableItem];
  cancel: [item: FileTableItem];
}>();

/** ElTable 槽位 row 为 DefaultRow，与 :data 实际项对齐 */
function itemOf(row: unknown): FileTableItem {
  return row as FileTableItem;
}

function statusText(item: FileTableItem) {
  if (item.status === "waiting") return "等待上传";
  if (item.status === "success") return "上传成功";
  if (item.status === "error") return "上传失败";
  if (item.status === "cancelled") return "已取消";
  return `${item.percent.toFixed(1)}%`;
}

function onRemove(item: FileTableItem) {
  emit("remove", item);
}

function onCancel(item: FileTableItem) {
  emit("cancel", item);
}
</script>

<template>
  <ElTable
    :data="items"
    class="file-table"
    empty-text="暂无文件"
  >
    <ElTableColumn
      label="文档"
      min-width="260"
    >
      <template #default="{ row }">
        <template
          v-for="item in [itemOf(row)]"
          :key="item.uid"
        >
          <div class="file-cell">
            <span
              v-if="materialType === 'video'"
              class="file-icon icon-video"
            >
              <ElIcon :size="16"><VideoPlay /></ElIcon>
            </span>
            <img
              v-else
              class="file-icon-img"
              :src="getMaterialFileIcon(item.name)"
              alt=""
            >
            <span
              class="file-name"
              :title="item.name"
            >{{ item.name }}</span>
          </div>
        </template>
      </template>
    </ElTableColumn>
    <ElTableColumn
      label="大小"
      width="110"
    >
      <template #default="{ row }">
        <template
          v-for="item in [itemOf(row)]"
          :key="item.uid"
        >
          {{ formatUploadSize(item.file.size) }}
        </template>
      </template>
    </ElTableColumn>
    <ElTableColumn
      label="速度"
      width="110"
    >
      <template #default="{ row }">
        <template
          v-for="item in [itemOf(row)]"
          :key="item.uid"
        >
          {{ item.status === "uploading" ? formatUploadSpeed(item.speedBps) : "—" }}
        </template>
      </template>
    </ElTableColumn>
    <ElTableColumn
      label="状态"
      width="150"
    >
      <template #default="{ row }">
        <template
          v-for="item in [itemOf(row)]"
          :key="item.uid"
        >
          <div
            v-if="item.status === 'uploading'"
            class="status-uploading"
          >
            <ElProgress
              type="circle"
              :percentage="item.percent"
              :width="22"
              :stroke-width="3"
              :show-text="false"
              color="var(--color-primary)"
            />
            <span>{{ item.percent.toFixed(1) }}%</span>
          </div>
          <div
            v-else
            class="status-text"
            :class="`is-${item.status}`"
          >
            <i class="status-dot" />
            <span>{{ statusText(item) }}</span>
          </div>
        </template>
      </template>
    </ElTableColumn>
    <ElTableColumn
      label="操作"
      width="100"
      fixed="right"
    >
      <template #default="{ row }">
        <template
          v-for="item in [itemOf(row)]"
          :key="item.uid"
        >
          <button
            v-if="item.status === 'waiting' || item.status === 'error'"
            type="button"
            class="op-link"
            @click="onRemove(item)"
          >
            移除
          </button>
          <button
            v-else-if="item.status === 'uploading'"
            type="button"
            class="op-link"
            @click="onCancel(item)"
          >
            取消上传
          </button>
        </template>
      </template>
    </ElTableColumn>
  </ElTable>
</template>

<style scoped>
.file-table {
  margin-top: 8px;
  width: 100%;
}

.file-table :deep(.el-table__header th) {
  background: var(--color-bg-page);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.file-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: #fff;
}

.icon-video {
  background: var(--color-primary);
}

.file-icon-img {
  flex: none;
  width: 28px;
  height: 28px;
  object-fit: contain;
  display: block;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}

.status-uploading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: 13px;
}

.status-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.status-text.is-waiting .status-dot {
  background: var(--color-primary);
}

.status-text.is-success {
  color: var(--color-text);
}

.status-text.is-success .status-dot {
  background: var(--color-success);
}

.status-text.is-error .status-dot,
.status-text.is-cancelled .status-dot {
  background: var(--color-danger);
}

.op-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.op-link:hover {
  color: var(--color-primary-hover);
}
</style>
