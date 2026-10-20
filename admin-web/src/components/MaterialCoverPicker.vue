<script setup lang="ts">
import { ref } from "vue";
import { ElImageViewer, ElMessage } from "element-plus";
import type { MaterialListItem } from "@/api/materials";
import MaterialPickerDialog from "@/views/live/components/MaterialPickerDialog.vue";

const props = withDefaults(
  defineProps<{
    coverUrl?: string;
    materialId?: string;
    required?: boolean;
    hint?: string;
  }>(),
  {
    coverUrl: "",
    materialId: "",
    required: false,
    hint: "建议尺寸750*422px，16:9,小于5M的JPG、PNG格式图片",
  },
);

const emit = defineEmits<{
  "update:coverUrl": [string];
  "update:materialId": [string];
}>();

const pickerVisible = ref(false);
const previewVisible = ref(false);

function openPicker() {
  pickerVisible.value = true;
}

function onConfirm(items: MaterialListItem[]) {
  const item = items[0];
  if (!item) {
    emit("update:coverUrl", "");
    emit("update:materialId", "");
    return;
  }
  if (item.type !== "image") {
    ElMessage.warning("封面请选择图片素材");
    return;
  }
  if (!item.url) {
    ElMessage.warning("该素材暂无可用地址");
    return;
  }
  emit("update:coverUrl", item.url);
  emit("update:materialId", item.id);
}

function remove() {
  emit("update:coverUrl", "");
  emit("update:materialId", "");
}

function openPreview() {
  if (!props.coverUrl) return;
  previewVisible.value = true;
}
</script>

<template>
  <div
    class="cover-pick"
    :data-required="required ? 'true' : 'false'"
  >
    <div
      class="cover-pick__box"
      :class="{ 'is-empty': !coverUrl }"
    >
      <img
        v-if="coverUrl"
        :src="coverUrl"
        class="cover-pick__img"
        alt="封面预览"
      >
      <div
        v-else
        class="cover-pick__placeholder"
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
        <span class="mt-1 text-[12px] text-[#999]">从素材中心选择</span>
      </div>
      <div
        v-if="coverUrl"
        class="cover-pick__mask"
      >
        <button
          type="button"
          class="cover-pick__act"
          title="预览"
          @click.stop="openPreview"
        >
          预览
        </button>
        <button
          type="button"
          class="cover-pick__act"
          title="替换"
          @click.stop="openPicker"
        >
          替换
        </button>
        <button
          type="button"
          class="cover-pick__act"
          title="删除"
          @click.stop="remove"
        >
          删除
        </button>
      </div>
      <button
        v-else
        type="button"
        class="cover-pick__pick"
        @click="openPicker"
      />
    </div>
    <div
      v-if="hint"
      class="cover-pick__hint"
    >
      {{ hint }}
    </div>

    <MaterialPickerDialog
      v-model="pickerVisible"
      title="选择封面"
      hint="从素材中心选择一张已审核通过的图片"
      :selected-ids="materialId ? [materialId] : []"
      :max="1"
      :allowed-types="['image']"
      default-type="image"
      @confirm="onConfirm"
    />

    <ElImageViewer
      v-if="previewVisible && coverUrl"
      :url-list="[coverUrl]"
      teleported
      @close="previewVisible = false"
    />
  </div>
</template>

<style scoped>
.cover-pick {
  display: inline-block;
}
.cover-pick__box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 112px;
  overflow: hidden;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
}
.cover-pick__box.is-empty {
  cursor: pointer;
}
.cover-pick__box.is-empty:hover {
  border-color: var(--color-primary);
}
.cover-pick__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-pick__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #999;
  pointer-events: none;
}
.cover-pick__pick {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.cover-pick__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.cover-pick__box:hover .cover-pick__mask {
  opacity: 1;
  pointer-events: auto;
}
.cover-pick__act {
  padding: 0;
  color: #fff;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.cover-pick__act:hover {
  color: var(--color-primary-light);
}
.cover-pick__hint {
  margin-top: 6px;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
</style>
