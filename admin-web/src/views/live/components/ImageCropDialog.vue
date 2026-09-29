<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { ElDialog, ElButton } from "element-plus";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

export type CropAspect = "16:9" | "9:16" | "25:8";

const ASPECT_MAP: Record<CropAspect, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "25:8": 25 / 8,
};

const props = defineProps<{
  visible: boolean;
  /** 本地预览 ObjectURL */
  src: string;
  aspect: CropAspect;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "confirm", file: File): void;
}>();

const imgRef = ref<HTMLImageElement | null>(null);
const cropSize = ref({ w: 0, h: 0 });
let cropper: Cropper | null = null;

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit("update:visible", v),
});

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

async function onOpened() {
  destroyCropper();
  await nextTick();
  const el = imgRef.value;
  if (!el || !props.src) return;

  const start = () => {
    if (!imgRef.value || cropper) return;
    cropper = new Cropper(imgRef.value, {
      aspectRatio: ASPECT_MAP[props.aspect],
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
    <p class="crop-ratio">
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
  color: #333;
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
