<script setup lang="ts">
import { computed, ref } from "vue";
import { ElImageViewer, ElMessage } from "element-plus";

const props = defineProps<{
  modelValue: string;
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

function onFile(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  // Mock：用本地预览
  url.value = URL.createObjectURL(file);
}

function remove() {
  url.value = "";
}

function openPreview() {
  if (!url.value) return;
  previewVisible.value = true;
}

function onCrop() {
  ElMessage.info("裁剪功能暂未开放");
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
        <span class="mt-1 text-[12px] text-[#999]">{{ text ?? "上传图片" }}</span>
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
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
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

    <ElImageViewer
      v-if="previewVisible && url"
      :url-list="[url]"
      teleported
      @close="previewVisible = false"
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
