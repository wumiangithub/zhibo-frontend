<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElDialog, ElButton, ElMessage } from "element-plus";
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
    /**
     * 待裁剪图：本地 `blob:` / 选图 ObjectURL，或 TOS CDN 远程 URL。
     * 远程图会先拉成 blob 再裁（开发态走 `/cdn-media` 代理），避免 `crossorigin` + 桶未配 CORS 时裂图。
     */
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
/** 实际喂给 cropper 的 src（远程已转成本地 blob） */
const displaySrc = ref("");
const loadingSrc = ref(false);
const cropperReady = ref(false);
let cropper: Cropper | null = null;
let blobUrlToRevoke = "";

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit("update:visible", v),
});

const displayAspect = computed(() =>
  props.aspectSelectable ? selectedAspect.value : props.aspect,
);

/**
 * 开发态把 TOS CDN / 原生域名换成同源 `/cdn-media`（与 downloadFile / fileInfo 一致）。
 * 用 includes + replace，避免 startsWith 因尾斜杠不一致没命中。
 */
function toFetchableMediaUrl(url: string): string {
  if (import.meta.env.VITE_APP_ENV !== "dev") return url;
  for (const key of ["VITE_APP_TOS_CDN_URL", "VITE_APP_TOS_NATIVE_URL"] as const) {
    const base = String(import.meta.env[key] || "").replace(/\/$/, "");
    if (base && url.includes(base)) return url.replace(base, "/cdn-media");
  }
  return url;
}

function revokePreparedBlob() {
  if (blobUrlToRevoke) {
    URL.revokeObjectURL(blobUrlToRevoke);
    blobUrlToRevoke = "";
  }
}

/**
 * 远程图不能直接 `crossorigin=anonymous` 挂 img（桶 CORS 未配会裂图且 canvas 脏）。
 * 先 fetch→blob URL，裁剪与导出都走同源 blob。
 */
async function prepareDisplaySrc(raw: string): Promise<string> {
  revokePreparedBlob();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return raw;

  loadingSrc.value = true;
  try {
    const res = await fetch(toFetchableMediaUrl(raw));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    blobUrlToRevoke = URL.createObjectURL(blob);
    return blobUrlToRevoke;
  } finally {
    loadingSrc.value = false;
  }
}

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
  cropperReady.value = false;
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

function startCropper() {
  if (!imgRef.value || cropper || !displaySrc.value) return;
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
      cropperReady.value = true;
      syncSize();
    },
    crop() {
      syncSize();
    },
  });
}

async function onOpened() {
  destroyCropper();
  selectedAspect.value = props.aspect;
  try {
    displaySrc.value = await prepareDisplaySrc(props.src);
  } catch (e) {
    displaySrc.value = "";
    ElMessage.error(e instanceof Error ? e.message : "图片加载失败，无法裁剪");
    open.value = false;
    return;
  }
  await nextTick();
  const el = imgRef.value;
  if (!el || !displaySrc.value) return;

  if (el.complete && el.naturalWidth > 0) {
    startCropper();
  } else {
    el.addEventListener("load", () => startCropper(), { once: true });
    el.addEventListener(
      "error",
      () => {
        ElMessage.error("图片加载失败，无法裁剪");
        open.value = false;
      },
      { once: true },
    );
  }
}

function onClosed() {
  destroyCropper();
  cropSize.value = { w: 0, h: 0 };
  displaySrc.value = "";
  revokePreparedBlob();
}

watch(
  () => props.aspect,
  (v) => {
    if (!props.aspectSelectable) return;
    selectedAspect.value = v;
  },
);

onBeforeUnmount(() => {
  destroyCropper();
  revokePreparedBlob();
});

function onCancel() {
  open.value = false;
}

function onConfirm() {
  if (!cropper) return;
  let canvas: HTMLCanvasElement | null;
  try {
    canvas = cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  } catch {
    return;
  }
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
    <div
      v-loading="loadingSrc"
      class="crop-stage"
    >
      <img
        v-if="displaySrc"
        ref="imgRef"
        :src="displaySrc"
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
        :disabled="loadingSrc || !cropperReady"
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
