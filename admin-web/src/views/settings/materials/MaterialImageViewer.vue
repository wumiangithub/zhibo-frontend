<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElImageViewer, ElIcon, ElMessage } from "element-plus";
import {
  ZoomOut,
  ZoomIn,
  RefreshLeft,
  RefreshRight,
  FullScreen,
  Download,
} from "@element-plus/icons-vue";
import { downloadFiles } from "@/utils/downloadFile";

export interface MaterialImagePreviewItem {
  url: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    items: MaterialImagePreviewItem[];
    initialIndex?: number;
  }>(),
  { initialIndex: 0 },
);

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
}>();

const activeIndex = ref(0);
const downloading = ref(false);

const urlList = computed(() => props.items.map((i) => i.url));
const total = computed(() => props.items.length);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    activeIndex.value = Math.min(
      Math.max(props.initialIndex, 0),
      Math.max(total.value - 1, 0),
    );
  },
);

function onClose() {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  }
  emit("update:modelValue", false);
}

function toggleFullscreen() {
  const el = document.querySelector(".el-image-viewer__wrapper") as HTMLElement | null;
  if (!el) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  } else {
    void el.requestFullscreen?.().catch(() => undefined);
  }
}

function onSwitch(index: number) {
  activeIndex.value = index;
}

async function onDownload(index: number) {
  const item = props.items[index];
  if (!item?.url) {
    ElMessage.warning("暂无下载地址");
    return;
  }
  if (downloading.value) return;
  downloading.value = true;
  try {
    const res = await downloadFiles(
      [{ fileUrl: item.url, fileName: item.name || "image" }],
      { useLink: true },
    );
    if (!res.success) {
      ElMessage.error("下载失败");
    }
  } catch {
    ElMessage.error("下载失败");
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <ElImageViewer
    v-if="modelValue && urlList.length"
    :url-list="urlList"
    :initial-index="activeIndex"
    :scale="0.75"
    :min-scale="0.15"
    show-progress
    teleported
    hide-on-click-modal
    @switch="onSwitch"
    @close="onClose"
  >
    <template #progress="{ activeIndex: idx, total: tot }">
      <span class="viewer-progress">{{ idx + 1 }} / {{ tot }}</span>
    </template>
    <template #toolbar="{ actions, activeIndex: idx }">
      <ElIcon @click.stop="actions('zoomOut')"><ZoomOut /></ElIcon>
      <ElIcon @click.stop="actions('zoomIn')"><ZoomIn /></ElIcon>
      <ElIcon @click.stop="actions('anticlockwise')"><RefreshLeft /></ElIcon>
      <ElIcon @click.stop="actions('clockwise')"><RefreshRight /></ElIcon>
      <ElIcon
        title="全屏"
        @click.stop="toggleFullscreen"
      >
        <FullScreen />
      </ElIcon>
      <ElIcon
        :class="{ 'is-disabled': downloading }"
        title="下载"
        @click.stop="onDownload(idx)"
      >
        <Download />
      </ElIcon>
    </template>
  </ElImageViewer>
</template>

<style scoped>
.viewer-progress {
  color: #fff;
  font-size: 14px;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}
</style>
