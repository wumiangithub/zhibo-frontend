<script setup lang="ts">
import { computed, ref } from "vue";
import { ElImageViewer, ElMessage } from "element-plus";
import type { MaterialListItem } from "@/api/materials";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import MaterialPickerDialog from "../components/MaterialPickerDialog.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const markDirty = useMarkDirty();

const pickerVisible = ref(false);
const previewVisible = ref(false);
/** 已选素材 id，弹窗勾选回显；提交仍用 coverUrl */
const selectedMaterialId = ref("");

const coverUrl = computed(() => props.form.detailCover);

function openPicker() {
  pickerVisible.value = true;
}

function onPickerConfirm(items: MaterialListItem[]) {
  const item = items[0];
  if (!item) {
    props.form.detailCover = "";
    selectedMaterialId.value = "";
    markDirty();
    return;
  }
  if (item.type !== "image") {
    ElMessage.warning("详情封面请选择图片素材");
    return;
  }
  if (!item.url) {
    ElMessage.warning("该素材暂无可用地址");
    return;
  }
  props.form.detailCover = item.url;
  selectedMaterialId.value = item.id;
  markDirty();
}

function remove() {
  props.form.detailCover = "";
  selectedMaterialId.value = "";
  markDirty();
}

function openPreview() {
  if (!coverUrl.value) return;
  previewVisible.value = true;
}
</script>

<template>
  <FormRow
    label="详情封面:"
    required
  >
    <div class="cover-pick">
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
          >预览</button>
          <button
            type="button"
            class="cover-pick__act"
            title="替换"
            @click.stop="openPicker"
          >替换</button>
          <button
            type="button"
            class="cover-pick__act"
            title="删除"
            @click.stop="remove"
          >删除</button>
        </div>
        <button
          v-else
          type="button"
          class="cover-pick__pick"
          @click="openPicker"
        />
      </div>
      <div class="cover-pick__hint">
        建议尺寸750*422px或16:9,小于5M的JPG、PNG格式图片
      </div>
    </div>

    <MaterialPickerDialog
      v-model="pickerVisible"
      title="选择详情封面"
      hint="从素材中心选择一张图片作为详情封面"
      :selected-ids="selectedMaterialId ? [selectedMaterialId] : []"
      :max="1"
      :allowed-types="['image']"
      default-type="image"
      @confirm="onPickerConfirm"
    />

    <ElImageViewer
      v-if="previewVisible && coverUrl"
      :url-list="[coverUrl]"
      teleported
      @close="previewVisible = false"
    />
  </FormRow>
</template>

<style scoped>
.cover-pick {
  display: inline-block;
}
.cover-pick__box {
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
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.cover-pick__box:hover .cover-pick__mask {
  opacity: 1;
  pointer-events: auto;
}
.cover-pick__act {
  cursor: pointer;
  border: 0;
  background: transparent;
  color: #fff;
  padding: 0;
  font-size: 12px;
}
.cover-pick__act:hover {
  color: var(--color-primary-light);
}
.cover-pick__hint {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
