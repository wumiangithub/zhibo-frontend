<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElDialog,
  ElSelect,
  ElOption,
  ElUpload,
  ElButton,
  ElMessage,
  ElIcon,
  type UploadFile,
  type UploadUserFile,
} from "element-plus";
import { UploadFilled, InfoFilled } from "@element-plus/icons-vue";
import {
  UPLOAD_ACCEPT,
  UPLOAD_DRAG_TEXT,
  UPLOAD_HINTS,
  UPLOAD_TITLE,
  type MaterialGroup,
  type MaterialType,
} from "./mock";
import MaterialUploadFileTable from "./MaterialUploadFileTable.vue";
import MaterialUploadThumbList from "./MaterialUploadThumbList.vue";
import type { FileTableItem } from "./materialUploadTypes";
import { useToast } from "@/composables/useToast";
import { useMaterialUpload } from "@/composables/useMaterialUpload";
import type { TosUploadResult } from "@/utils/upload";

const props = defineProps<{
  modelValue: boolean;
  materialType: MaterialType;
  groups: MaterialGroup[];
  defaultGroupId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
  confirm: [
    payload: {
      groupId: string;
      files: File[];
      results: Array<TosUploadResult | null>;
    },
  ];
}>();

const { toast } = useToast();
const {
  items,
  uploading,
  pendingCount,
  successCount,
  uploadingCount,
  showStats,
  canConfirm,
  syncItemsFromFileList,
  removeItem,
  cancelUpload,
  resetSession,
  ensureStsOnOpen,
  startUpload,
} = useMaterialUpload();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

/** 视频 / 文档共用表格；图片用缩略图 */
const useFileTable = computed(
  () => props.materialType === "video" || props.materialType === "document",
);

const groupOptions = computed(() => props.groups.filter((g) => g.id !== "all"));

const groupId = ref("default");
const fileList = ref<UploadUserFile[]>([]);

const accept = computed(() => UPLOAD_ACCEPT[props.materialType]);
const hints = computed(() => UPLOAD_HINTS[props.materialType]);
const title = computed(() => UPLOAD_TITLE[props.materialType]);
const dragText = computed(() => UPLOAD_DRAG_TEXT[props.materialType]);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const prefer = props.defaultGroupId && props.defaultGroupId !== "all" ? props.defaultGroupId : "";
    const first = groupOptions.value[0]?.id ?? "default";
    groupId.value =
      prefer && groupOptions.value.some((g) => g.id === prefer) ? prefer : first;
    fileList.value = [];
    resetSession();
    void ensureStsOnOpen();
  },
);

function onExceed() {
  ElMessage.warning("一次最多上传 100 个文件");
}

function onChange(_file: UploadFile, files: UploadUserFile[]) {
  if (uploading.value) return;
  fileList.value = files;
  syncItemsFromFileList(files);
}

function onRemove(_file: UploadFile, files: UploadUserFile[]) {
  if (uploading.value) return;
  fileList.value = files;
  syncItemsFromFileList(files);
}

function onRemoveItem(item: FileTableItem) {
  fileList.value = removeItem(item, fileList.value);
}

function onCancelItem(item: FileTableItem) {
  fileList.value = cancelUpload(item, fileList.value);
}

function close() {
  if (uploading.value) {
    ElMessage.warning("上传进行中，请勿关闭");
    return;
  }
  visible.value = false;
}

function onBeforeClose(done: () => void) {
  if (uploading.value) {
    ElMessage.warning("上传进行中，请勿关闭");
    return;
  }
  done();
}

async function onConfirm() {
  const result = await startUpload(props.materialType);
  if (!result) return;
  emit("confirm", {
    groupId: groupId.value,
    files: result.files,
    results: result.results,
  });
}

function onViewTranscode() {
  toast("「查看转码规则」暂未开放");
}

function onDocTip() {
  toast("排查文档暂未开放");
}

function onOpenNewWindow() {
  window.open(window.location.href, "_blank");
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="900px"
    align-center
    destroy-on-close
    :close-on-click-modal="!uploading"
    :close-on-press-escape="!uploading"
    :before-close="onBeforeClose"
    class="material-upload-dialog"
  >
    <div class="upload-body">
      <div class="upload-to">
        <span class="upload-to-label">上传到：</span>
        <ElSelect
          v-model="groupId"
          placeholder="请选择分组"
          :disabled="uploading"
          style="width: 280px"
        >
          <ElOption
            v-for="g in groupOptions"
            :key="g.id"
            :label="g.name"
            :value="g.id"
          />
        </ElSelect>
      </div>

      <ElUpload
        v-model:file-list="fileList"
        drag
        multiple
        :auto-upload="false"
        :show-file-list="false"
        :disabled="uploading"
        :limit="100"
        :accept="accept"
        :on-exceed="onExceed"
        :on-change="onChange"
        :on-remove="onRemove"
        class="material-uploader"
      >
        <el-icon class="upload-icon">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          {{ dragText.prefix }}
          <em>{{ dragText.link }}</em>
        </div>
        <div class="upload-tips">
          <p
            v-for="(line, idx) in hints"
            :key="idx"
          >
            <template v-if="materialType === 'video' && idx === hints.length - 1">
              {{ line }}
              <button
                type="button"
                class="link-btn"
                @click.stop="onViewTranscode"
              >
                查看转码规则
              </button>
            </template>
            <template v-else>{{ line }}</template>
          </p>
        </div>
      </ElUpload>

      <div
        v-if="showStats"
        class="upload-stats"
      >
        共 {{ items.length }} 个
        <template v-if="successCount > 0">
          上传成功 <span class="stat-ok">{{ successCount }}</span>
        </template>
        <template v-if="uploadingCount > 0">
          上传中 <span class="stat-ing">{{ uploadingCount }}</span>
        </template>
      </div>

      <MaterialUploadFileTable
        v-if="useFileTable && items.length"
        :items="items"
        :material-type="materialType as 'video' | 'document'"
        @remove="onRemoveItem"
        @cancel="onCancelItem"
      />

      <MaterialUploadThumbList
        v-else-if="!useFileTable && items.length"
        :items="items"
      />

      <div
        v-if="showStats"
        class="upload-notice"
      >
        <ElIcon class="notice-icon"><InfoFilled /></ElIcon>
        <p>
          上传失败或缓慢问题可点击
          <button
            type="button"
            class="link-btn"
            @click="onDocTip"
          >
            该文档
          </button>
          排查。上传期间请勿关闭本页面，否则将会上传失败。如需进行其他操作请
          <button
            type="button"
            class="link-btn"
            @click="onOpenNewWindow"
          >
            前往新窗口
          </button>
        </p>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton
          :disabled="uploading"
          @click="close"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :disabled="!canConfirm"
          :loading="uploading"
          @click="onConfirm"
        >
          确认上传({{ pendingCount }})
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.upload-body {
  padding: 4px 8px 0;
}

.upload-to {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.upload-to-label {
  flex: none;
  margin-right: 8px;
  font-size: 14px;
  color: var(--color-text);
}

.material-uploader {
  width: 100%;
}

.material-uploader :deep(.el-upload) {
  width: 100%;
}

.material-uploader :deep(.el-upload-dragger) {
  width: 100%;
  padding: 40px 24px 28px;
  background: #fff;
  border-color: var(--color-primary-border);
}

.material-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--color-primary);
}

.upload-icon {
  font-size: 48px;
  color: var(--color-text-placeholder);
  margin-bottom: 8px;
}

.material-uploader :deep(.el-upload__text) {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.material-uploader :deep(.el-upload__text em) {
  color: var(--color-primary);
  font-style: normal;
}

.upload-tips {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-placeholder);
  text-align: center;
}

.upload-tips p {
  margin: 0;
}

.link-btn {
  margin-left: 2px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: inherit;
  cursor: pointer;
}

.link-btn:hover {
  color: var(--color-primary-hover);
}

.upload-stats {
  margin-top: 12px;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-ok {
  color: var(--color-success);
  margin: 0 2px;
}

.stat-ing {
  margin-left: 2px;
}

.upload-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.notice-icon {
  flex: none;
  margin-top: 2px;
  color: var(--color-primary);
  font-size: 14px;
}

.upload-notice p {
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
