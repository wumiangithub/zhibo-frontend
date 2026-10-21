<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ElMessage } from "element-plus";
import { uploadFileToTos, type TosObjectKeyPrefixValue } from "@/utils/tosUpload";
import ImageCropDialog, { type CropAspect } from "./ImageCropDialog.vue";
import ImagePreview from "@/components/ImagePreview.vue";
import type { ImagePreviewItem } from "@/components/ImagePreview.vue";

const props = defineProps<{
  modelValue: string;
  /**
   * TOS 对象 key 前缀（D60 权威表）。调用方必传，如 activity/cover/、activity/warmup/、activity/promo/。
   * 禁止传 upload/（仅调试）或未登记前缀。
   */
  objectKeyPrefix: TosObjectKeyPrefixValue | string;
  /** 固定裁剪比例；不传则不裁剪，直接上传 */
  aspect?: CropAspect;
  /** 推荐尺寸文案，如 "750*422px 或 16:9" */
  hint?: string;
  /** 上传按钮文案 */
  text?: string;
  /** 是否显示查看示例链接 */
  viewExample?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const url = computed({
  get: () => props.modelValue,
  set: (v: string) => emit("update:modelValue", v),
});

const previewVisible = ref(false);
const previewItems = computed<ImagePreviewItem[]>(() =>
  url.value ? [{ url: url.value, name: "图片" }] : [],
);
const uploading = ref(false);
const cropVisible = ref(false);
const cropSrc = ref("");
/** 选图后的本地 ObjectURL，关闭裁剪时释放 */
let pendingObjectUrl = "";

function revokePending() {
  if (pendingObjectUrl) {
    URL.revokeObjectURL(pendingObjectUrl);
    pendingObjectUrl = "";
  }
  cropSrc.value = "";
}

onBeforeUnmount(revokePending);

function openCropWithFile(file: File) {
  revokePending();
  pendingObjectUrl = URL.createObjectURL(file);
  cropSrc.value = pendingObjectUrl;
  cropVisible.value = true;
}

async function onFile(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    ElMessage.warning("请选择图片文件");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning("图片需小于 5M");
    return;
  }
  if (props.aspect) {
    openCropWithFile(file);
    return;
  }
  await doUpload(file);
}

async function doUpload(file: File) {
  uploading.value = true;
  try {
    url.value = await uploadFileToTos(file, props.objectKeyPrefix);
    ElMessage.success("上传成功");
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "上传失败");
  } finally {
    uploading.value = false;
  }
}

async function onCropConfirm(file: File) {
  revokePending();
  await doUpload(file);
}

function onCropVisible(v: boolean) {
  cropVisible.value = v;
  if (!v) revokePending();
}

function remove() {
  url.value = "";
}

function openPreview() {
  if (!url.value) return;
  previewVisible.value = true;
}

/** 已上传图再裁：重新选图（素材中心落地前的过渡；远端 URL 常有 CORS 无法直接入 canvas） */
function onCrop() {
  if (!props.aspect) {
    ElMessage.info("当前图片无需裁剪");
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (ev) => {
    void onFile(ev);
  };
  input.click();
}
</script>

<template>
  <div class="img-up">
    <div
      class="img-up__box"
      :class="{ 'is-empty': !url }"
    >
      <img
        v-if="url"
        :src="url"
        class="img-up__img"
        alt="封面预览"
      >
      <div
        v-else
        class="img-up__placeholder"
      >
        <svg
          class="h-7 w-7 text-[#c0c4cc]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M4 16l4.5-4.5a2 2 0 012.8 0L20 18M4 6h16v12H4z"
          />
        </svg>
        <span class="mt-1 text-[12px] text-[#999]">
          {{ uploading ? "上传中…" : text ?? "上传图片" }}
        </span>
      </div>
      <div
        v-if="url"
        class="img-up__mask"
      >
        <button
          type="button"
          class="img-up__act"
          title="预览"
          @click.stop="openPreview"
        >预览</button>
        <button
          v-if="aspect"
          type="button"
          class="img-up__act"
          title="裁剪"
          @click.stop="onCrop"
        >裁剪</button>
        <label
          class="img-up__act"
          title="替换"
        >
          替换
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFile"
          >
        </label>
        <button
          type="button"
          class="img-up__act"
          title="删除"
          @click="remove"
        >删除</button>
      </div>
      <label
        v-else
        class="img-up__pick"
        :class="{ 'is-busy': uploading }"
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          :disabled="uploading"
          @change="onFile"
        >
      </label>
    </div>
    <div
      v-if="hint"
      class="img-up__hint"
    >
      建议尺寸{{ hint }}，小于5M的JPG、PNG格式图片
      <span
        v-if="viewExample"
        class="img-up__link"
      >查看示例</span>
    </div>

    <ImagePreview v-model="previewVisible" :items="previewItems" />

    <ImageCropDialog
      v-if="aspect"
      :visible="cropVisible"
      :src="cropSrc"
      :aspect="aspect"
      @update:visible="onCropVisible"
      @confirm="onCropConfirm"
    />
  </div>
</template>

<style scoped>
.img-up {
  display: inline-block;
}
.img-up__box {
  position: relative;
  width: 200px;
  height: 112px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  background: #fafafa;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.img-up__box.is-empty {
  cursor: pointer;
}
.img-up__box.is-empty:hover {
  border-color: var(--color-primary);
}
.img-up__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.img-up__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #999;
}
.img-up__pick {
  position: absolute;
  inset: 0;
  cursor: pointer;
}
.img-up__pick.is-busy {
  cursor: wait;
  pointer-events: none;
}
.img-up__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #fff;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.img-up__box:hover .img-up__mask {
  opacity: 1;
  pointer-events: auto;
}
.img-up__act {
  cursor: pointer;
  border: 0;
  background: transparent;
  color: #fff;
  padding: 0;
  font-size: 12px;
}
.img-up__act:hover {
  color: var(--color-primary-light);
}
.img-up__hint {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  white-space: nowrap;
}
.img-up__link {
  margin-left: 6px;
  color: var(--color-primary);
  cursor: pointer;
}
.img-up__link:hover {
  opacity: 0.8;
}
</style>
