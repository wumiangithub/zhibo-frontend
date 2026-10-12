<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElDialog,
  ElSelect,
  ElOption,
  ElUpload,
  ElButton,
  ElMessage,
  type UploadFile,
  type UploadUserFile,
} from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import {
  UPLOAD_ACCEPT,
  UPLOAD_DRAG_TEXT,
  UPLOAD_HINTS,
  UPLOAD_TITLE,
  type MaterialGroup,
  type MaterialType,
} from "./mock";
import { useToast } from "@/composables/useToast";
import { useMaterialsStore } from "@/stores/materials";

const props = defineProps<{
  modelValue: boolean;
  materialType: MaterialType;
  groups: MaterialGroup[];
  /** 打开时默认选中的分组（不含 all） */
  defaultGroupId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
  /** UI 壳：确认时把文件列表抛出，实际上传逻辑后续自接 */
  confirm: [payload: { groupId: string; files: File[] }];
}>();

const { toast } = useToast();
const materialsStore = useMaterialsStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const groupOptions = computed(() => props.groups.filter((g) => g.id !== "all"));

const groupId = ref("default");
const fileList = ref<UploadUserFile[]>([]);

const accept = computed(() => UPLOAD_ACCEPT[props.materialType]);
const hints = computed(() => UPLOAD_HINTS[props.materialType]);
const title = computed(() => UPLOAD_TITLE[props.materialType]);
const dragText = computed(() => UPLOAD_DRAG_TEXT[props.materialType]);
const canConfirm = computed(() => fileList.value.length > 0);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const prefer = props.defaultGroupId && props.defaultGroupId !== "all" ? props.defaultGroupId : "";
    const first = groupOptions.value[0]?.id ?? "default";
    groupId.value =
      prefer && groupOptions.value.some((g) => g.id === prefer) ? prefer : first;
    fileList.value = [];
    void materialsStore.ensureTosConfig().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "获取上传凭证失败";
      ElMessage.error(msg);
    });
  },
);

function onExceed() {
  ElMessage.warning("一次最多上传 100 个文件");
}

function onChange(_file: UploadFile, files: UploadUserFile[]) {
  fileList.value = files;
}

function onRemove(_file: UploadFile, files: UploadUserFile[]) {
  fileList.value = files;
}

function close() {
  visible.value = false;
}

function onConfirm() {
  if (!canConfirm.value) return;
  // Element Plus raw 是 UploadRawFile（File + uid），直接收成 File[]
  const files: File[] = fileList.value.flatMap((f) => (f.raw ? [f.raw] : []));
  if (!files.length) {
    ElMessage.warning("请先选择文件");
    return;
  }
  emit("confirm", { groupId: groupId.value, files });
  toast("已选文件（Mock，实际上传逻辑待接）");
  close();
}

function onViewTranscode() {
  toast("「查看转码规则」暂未开放");
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="900px"
    align-center
    destroy-on-close
    class="material-upload-dialog"
  >
    <div class="upload-body">
      <div class="upload-to">
        <span class="upload-to-label">上传到：</span>
        <ElSelect
          v-model="groupId"
          placeholder="请选择分组"
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
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="close">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!canConfirm"
          @click="onConfirm"
        >
          确认上传
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

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
