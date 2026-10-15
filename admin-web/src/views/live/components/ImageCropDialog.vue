<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElDialog, ElButton } from "element-plus";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

/** 封面固定比例仍用子集；素材上传可选全部（含原图比例） */
export type CropAspect =
  | "原图比例"
  | "1:1"
  | "4:3"
  | "16:9"
  | "3:4"
  | "25:8"
  | "9:16";

const FIXED_ASPECT_MAP: Record<Exclude<CropAspect, "原图比例">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:4": 3 / 4,
  "25:8": 25 / 8,
  "9:16": 9 / 16,
};

const CROP_ASPECT_OPTIONS: CropAspect[] = [
  "原图比例",
  "1:1",
  "4:3",
  "16:9",
  "3:4",
  "25:8",
  "9:16",
];

const props = withDefaults(
  defineProps<{
    visible: boolean;
    /** 本地预览 ObjectURL */
    src: string;
    /** 固定比例，或可选模式下的初始比例 */
    aspect?: CropAspect;
    /** 为 true 时展示比例切换（素材上传）；封面等场景保持 false */
    aspectSelectable?: boolean;
  }>(),
  {
    aspect: "16:9",
    aspectSelectable: false,
  },
);

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "confirm", file: File): void;
}>();

const imgRef = ref<HTMLImageElement | null>(null);
const cropSize = ref({ w: 0, h: 0 });
const selectedAspect = ref<CropAspect>(props.aspect);
let cropper: Cropper | null = null;

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit("update:visible", v),
});

const displayAspect = computed(() =>
  props.aspectSelectable ? selectedAspect.value : props.aspect,
);

function resolveAspectRatio(aspect: CropAspect, img: HTMLImageElement | null): number {
  if (aspect === "原图比例") {
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return img.naturalWidth / img.naturalHeight;
    }
    return Number.NaN;
  }
  return FIXED_ASPECT_MAP[aspect];
}

function destroyCropper() {
  cropper?.destroy();
  cropper = null;
}

function syncSize() {
  if (!cropper) return;
  const data = cropper.getData(true);
  cropSize.value = {
    w: Math.max(0, Math.round(data.width)),
    h: Math.max(0, Math.round(data.height)),
  };
}

function applyAspectRatio(aspect: CropAspect) {
  if (!cropper) return;
  cropper.setAspectRatio(resolveAspectRatio(aspect, imgRef.value));
  syncSize();
}

function onSelectAspect(aspect: CropAspect) {
  if (selectedAspect.value === aspect) return;
  selectedAspect.value = aspect;
  applyAspectRatio(aspect);
}

async function onOpened() {
  destroyCropper();
  selectedAspect.value = props.aspect;
  await nextTick();
  const el = imgRef.value;
  if (!el || !props.src) return;

  const start = () => {
    if (!imgRef.value || cropper) return;
    cropper = new Cropper(imgRef.value, {
      aspectRatio: resolveAspectRatio(displayAspect.value, imgRef.value),
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      responsive: true,
      background: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      ready() {
        syncSize();
      },
      crop() {
        syncSize();
      },
    });
  };

  if (el.complete && el.naturalWidth > 0) {
    start();
  } else {
    el.addEventListener("load", start, { once: true });
  }
}

function onClosed() {
  destroyCropper();
  cropSize.value = { w: 0, h: 0 };
}

watch(
  () => props.aspect,
  (v) => {
    if (!props.aspectSelectable) return;
    selectedAspect.value = v;
  },
);

onBeforeUnmount(destroyCropper);

function onCancel() {
  open.value = false;
}

function onConfirm() {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });
  if (!canvas) return;
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      emit("confirm", file);
      open.value = false;
    },
    "image/jpeg",
    0.92,
  );
}
</script>

<template>
  <ElDialog
    v-model="open"
    title="裁剪"
    width="720px"
    align-center
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    class="image-crop-dialog"
    @opened="onOpened"
    @closed="onClosed"
  >
    <div
      v-if="aspectSelectable"
      class="crop-aspects"
    >
      <button
        v-for="opt in CROP_ASPECT_OPTIONS"
        :key="opt"
        type="button"
        class="crop-aspect-btn"
        :class="{ 'is-active': selectedAspect === opt }"
        @click="onSelectAspect(opt)"
      >
        {{ opt }}
      </button>
    </div>
    <p
      v-else
      class="crop-ratio"
    >
      当前比例：{{ aspect }}
    </p>
    <div class="crop-stage">
      <img
        ref="imgRef"
        :src="src"
        alt="待裁剪图片"
        class="crop-stage__img"
      >
      <span
        v-if="cropSize.w && cropSize.h"
        class="crop-size"
      >{{ cropSize.w }} × {{ cropSize.h }}</span>
    </div>
    <template #footer>
      <ElButton @click="onCancel">取消</ElButton>
      <ElButton
        type="primary"
        @click="onConfirm"
      >确认</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.crop-ratio {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text, #333);
}

.crop-aspects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
}

.crop-aspect-btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 4px;
  background: #fff;
  color: var(--color-text-secondary, #666);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}

.crop-aspect-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.crop-aspect-btn.is-active {
  border-color: var(--color-primary);
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--color-primary);
}

.crop-stage {
  position: relative;
  height: 420px;
  background: #f5f5f5;
  overflow: hidden;
}

.crop-stage__img {
  display: block;
  max-width: 100%;
}

.crop-size {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  padding: 2px 8px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
</style>

<style>
.image-crop-dialog .crop-stage .cropper-container {
  max-height: 420px;
}
</style>
