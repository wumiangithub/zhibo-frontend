<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTooltip,
} from "element-plus";
import {
  createCourseUser,
  downloadCourseUserImportFailures,
  downloadCourseUserImportTemplate,
  estimateCourseUsersByTags,
  importCourseUsers,
  importCourseUsersByTags,
  listCourseUserImports,
  type CourseUserImportHistoryItem,
} from "@/api/course";
import type { ViewerTagItem } from "@/api/viewerTag";
import ViewerTagPickerDialog from "@/views/live/components/ViewerTagPickerDialog.vue";

const props = defineProps<{
  courseId: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [boolean];
  refreshed: [];
}>();

const addTab = ref<"single" | "bulk" | "tag">("single");
const addMethod = ref<"phone" | "viewerId">("phone");
const addPhone = ref("");
const addPhoneCode = ref("+86");
const addViewerId = ref("");
const addSaving = ref(false);
/** 选填自定义到期（yyyy-MM-dd）；空则后端按课程售卖算 */
const customExpireDate = ref("");
const csvInput = ref<HTMLInputElement | null>(null);
const importHistory = ref<CourseUserImportHistoryItem[]>([]);
const importHistoryLoading = ref(false);
const bulkImporting = ref(false);

const TAG_IMPORT_MAX = 5;
const tagImportMode = ref<"byTag">("byTag");
const tagImportSelected = ref<ViewerTagItem[]>([]);
const tagPickerVisible = ref(false);
const tagImportSaving = ref(false);
const tagImportMemberSum = computed(() =>
  tagImportSelected.value.reduce((sum, t) => sum + (t.userCount ?? 0), 0),
);
const tagImportEstimateCount = ref(0);
let tagImportEstimateSeq = 0;

const PHONE_CODE_OPTIONS = [{ label: "+86 中国", value: "+86" }] as const;
const UPLOAD_NOTICE =
  "文本当前仅支持CSV格式文件，请使用Office2010或以上版本，否则可能会出现乱码。必须严格按照模板内容填写数据，否则可能会出现导入异常。";

const visible = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v;
    if (v) resetForm();
  },
);

watch(visible, (v) => {
  emit("update:modelValue", v);
});

watch([visible, addTab], ([isVisible, tab]) => {
  if (isVisible && tab === "bulk") {
    void fetchImportHistory();
  }
});

async function refreshTagImportEstimate() {
  const seq = ++tagImportEstimateSeq;
  const ids = tagImportSelected.value.map((t) => t.id);
  if (!ids.length) {
    tagImportEstimateCount.value = 0;
    return;
  }
  try {
    const res = await estimateCourseUsersByTags(props.courseId, ids);
    if (seq !== tagImportEstimateSeq) return;
    tagImportEstimateCount.value = res.total ?? 0;
  } catch {
    if (seq !== tagImportEstimateSeq) return;
    tagImportEstimateCount.value = 0;
  }
}

watch(
  tagImportSelected,
  () => {
    void refreshTagImportEstimate();
  },
  { deep: true },
);

function resetForm() {
  addTab.value = "single";
  addMethod.value = "phone";
  addPhone.value = "";
  addPhoneCode.value = "+86";
  addViewerId.value = "";
  customExpireDate.value = "";
  tagImportMode.value = "byTag";
  tagImportSelected.value = [];
  tagPickerVisible.value = false;
  tagImportEstimateCount.value = 0;
}

function onAddMethodChange() {
  addPhone.value = "";
  addViewerId.value = "";
}

function openTagPicker() {
  tagPickerVisible.value = true;
}

function onTagPickerConfirm(items: ViewerTagItem[]) {
  tagImportSelected.value = items.slice(0, TAG_IMPORT_MAX);
}

function removeTagImportItem(id: number) {
  tagImportSelected.value = tagImportSelected.value.filter((t) => t.id !== id);
}

async function submitTagImport() {
  if (!tagImportSelected.value.length) {
    ElMessage.warning("请选择标签");
    return;
  }
  if (tagImportSelected.value.length > TAG_IMPORT_MAX) {
    ElMessage.warning(`最多选择 ${TAG_IMPORT_MAX} 个标签`);
    return;
  }
  tagImportSaving.value = true;
  try {
    const result = await importCourseUsersByTags(
      props.courseId,
      tagImportSelected.value.map((t) => t.id),
      customExpireDate.value || undefined,
    );
    if (result.total === 0) {
      ElMessage.warning("未找到符合条件的用户");
    } else {
      ElMessage.success(
        `导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
      );
    }
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导入失败");
  } finally {
    tagImportSaving.value = false;
  }
}

async function submitAdd() {
  if (addTab.value !== "single") return;

  let body: ({ phone: string } | { viewerId: number }) & { expireTime?: string };
  if (addMethod.value === "phone") {
    const phone = addPhone.value.trim().replace(/\D/g, "");
    if (!phone) {
      ElMessage.warning("请输入学员手机号");
      return;
    }
    body = { phone };
  } else {
    const raw = addViewerId.value.trim();
    if (!raw) {
      ElMessage.warning("请输入学员用户ID");
      return;
    }
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      ElMessage.warning("用户ID须为正整数");
      return;
    }
    body = { viewerId: Number(raw) };
  }
  const expire = customExpireDate.value?.trim();
  if (expire) body.expireTime = expire;

  addSaving.value = true;
  try {
    const result = await createCourseUser(props.courseId, body);
    if (result.created) {
      ElMessage.success("添加成功");
      addPhone.value = "";
      addViewerId.value = "";
    } else {
      ElMessage.warning("该用户已存在");
    }
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "添加失败");
  } finally {
    addSaving.value = false;
  }
}

async function fetchImportHistory() {
  importHistoryLoading.value = true;
  try {
    const res = await listCourseUserImports(props.courseId);
    importHistory.value = res.list ?? [];
  } catch (e) {
    importHistory.value = [];
    ElMessage.error(e instanceof Error ? e.message : "加载导入记录失败");
  } finally {
    importHistoryLoading.value = false;
  }
}

function pickCsv() {
  csvInput.value?.click();
}

async function onCsvPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!/\.(csv|txt)$/i.test(file.name)) {
    ElMessage.warning("请选择 CSV 文件");
    return;
  }
  bulkImporting.value = true;
  try {
    const result = await importCourseUsers(
      props.courseId,
      file,
      customExpireDate.value || undefined,
    );
    ElMessage.success(
      `导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`,
    );
    emit("refreshed");
    await fetchImportHistory();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "导入失败");
  } finally {
    bulkImporting.value = false;
  }
}

async function onDownloadTemplate() {
  try {
    await downloadCourseUserImportTemplate();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "下载模板失败");
  }
}

async function onDownloadFailures(row: CourseUserImportHistoryItem) {
  try {
    await downloadCourseUserImportFailures(row.id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "下载失败明细失败");
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="添加学员"
    :width="addTab === 'bulk' ? '860px' : '660px'"
    append-to-body
    destroy-on-close
    class="add-course-user-dialog"
  >
    <ElTabs
      v-model="addTab"
      class="add-tabs"
    >
      <ElTabPane
        label="单个添加"
        name="single"
      >
        <ElForm
          label-width="128px"
          @submit.prevent="submitAdd"
        >
          <ElFormItem
            label="添加方式"
            required
          >
            <ElRadioGroup
              v-model="addMethod"
              @change="onAddMethodChange"
            >
              <ElRadio value="phone">手机号</ElRadio>
              <ElRadio value="viewerId">用户ID</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem
            label="学员"
            required
          >
            <ElInput
              v-if="addMethod === 'phone'"
              v-model="addPhone"
              placeholder="请输入学员手机号"
              maxlength="20"
            >
              <template #prepend>
                <ElSelect
                  v-model="addPhoneCode"
                  style="width: 110px"
                >
                  <ElOption
                    v-for="opt in PHONE_CODE_OPTIONS"
                    :key="opt.value"
                    :label="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </ElOption>
                </ElSelect>
              </template>
            </ElInput>
            <ElInput
              v-else
              v-model="addViewerId"
              placeholder="请输入学员用户ID"
              maxlength="20"
            />
          </ElFormItem>
          <ElFormItem label="自定义到期时间">
            <ElDatePicker
              v-model="customExpireDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="请选择日期"
              class="expire-picker"
              clearable
            />
          </ElFormItem>
        </ElForm>
      </ElTabPane>
      <ElTabPane
        label="批量导入"
        name="bulk"
      >
        <div class="expire-field">
          <span class="expire-label">自定义到期时间</span>
          <ElDatePicker
            v-model="customExpireDate"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            placeholder="请选择日期"
            class="expire-picker"
            clearable
          />
        </div>
        <div class="bulk-toolbar">
          <input
            ref="csvInput"
            type="file"
            accept=".csv,.txt"
            class="csv-input"
            @change="onCsvPicked"
          >
          <ElButton
            type="primary"
            :loading="bulkImporting"
            @click="pickCsv"
          >
            + 批量导入
          </ElButton>
          <button
            type="button"
            class="link-btn"
            @click="onDownloadTemplate"
          >
            下载模板
          </button>
          <span class="upload-notice">
            上传须知
            <ElTooltip
              placement="top"
              :show-after="200"
            >
              <template #content>
                <div class="upload-notice-tip">{{ UPLOAD_NOTICE }}</div>
              </template>
              <ElIcon class="info-icon">
                <InfoFilled />
              </ElIcon>
            </ElTooltip>
          </span>
        </div>
        <ElTable
          v-loading="importHistoryLoading"
          :data="importHistory"
          row-key="id"
          max-height="360"
        >
          <ElTableColumn
            prop="importTime"
            label="导入时间"
            min-width="170"
          />
          <ElTableColumn
            label="导入人"
            min-width="120"
          >
            <template #default="{ row }">{{ row.importerName || "—" }}</template>
          </ElTableColumn>
          <ElTableColumn
            label="成功数"
            width="90"
          >
            <template #default="{ row }">
              <span class="success-count">{{ row.successCount }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="失败数"
            width="90"
          >
            <template #default="{ row }">
              <span :class="{ 'fail-count': row.failCount > 0 }">{{ row.failCount }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="操作"
            width="130"
            fixed="right"
          >
            <template #default="{ row }">
              <button
                type="button"
                class="link-btn"
                @click="onDownloadFailures(row)"
              >
                下载失败明细
              </button>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>
      <ElTabPane
        label="标签导入"
        name="tag"
      >
        <ElForm
          label-width="128px"
          class="tag-import-form"
        >
          <ElFormItem label=" ">
            <ElRadioGroup v-model="tagImportMode">
              <ElRadio value="byTag">按标签筛选用户</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem
            label="选择标签"
            required
          >
            <div class="tag-import-pick">
              <button
                type="button"
                class="tag-pick-btn"
                @click="openTagPicker"
              >
                + 选择用户标签
              </button>
              <span class="tag-pick-hint">最多选择 {{ TAG_IMPORT_MAX }} 个</span>
            </div>
            <p class="tag-import-tip">
              选择标签后，符合条件的用户将直接添加至用户列表，状态权益为有效
            </p>
            <div
              v-if="tagImportSelected.length"
              class="tag-import-selected"
            >
              <div class="tag-import-chips">
                <span
                  v-for="t in tagImportSelected"
                  :key="t.id"
                  class="tag-import-chip"
                >
                  {{ t.name }}
                  <button
                    type="button"
                    class="tag-chip-remove"
                    aria-label="移除"
                    @click="removeTagImportItem(t.id)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <span class="tag-import-count">
                {{ tagImportSelected.length }} / {{ TAG_IMPORT_MAX }}
              </span>
            </div>
            <p
              v-if="tagImportSelected.length"
              class="tag-import-estimate"
            >
              各标签包含人数合计 {{ tagImportMemberSum }} 人，去重后预计导入
              {{ tagImportEstimateCount }} 人，用户需稍作等待后方可享受权益。
            </p>
          </ElFormItem>
          <ElFormItem label="自定义到期时间">
            <ElDatePicker
              v-model="customExpireDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="请选择日期"
              class="expire-picker"
              clearable
            />
          </ElFormItem>
        </ElForm>
      </ElTabPane>
    </ElTabs>
    <template #footer>
      <template v-if="addTab === 'single'">
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="addSaving"
          @click="submitAdd"
        >
          确定
        </ElButton>
      </template>
      <template v-else-if="addTab === 'tag'">
        <ElButton
          type="primary"
          :loading="tagImportSaving"
          @click="submitTagImport"
        >
          确认导入
        </ElButton>
      </template>
      <ElButton
        v-else
        @click="visible = false"
      >
        关闭
      </ElButton>
    </template>
  </ElDialog>

  <ViewerTagPickerDialog
    v-model="tagPickerVisible"
    :selected-tags="tagImportSelected"
    :max="TAG_IMPORT_MAX"
    @confirm="onTagPickerConfirm"
  />
</template>

<style scoped>
.add-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}
.add-tabs :deep(.el-form-item__label) {
  white-space: nowrap;
}
.tag-import-form :deep(.el-form-item:first-child .el-form-item__label) {
  opacity: 0;
}
.tag-import-form :deep(.el-form-item__content) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.tag-import-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.tag-pick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  height: 32px;
  padding: 0 12px;
  border: 1px dashed var(--color-primary, #2f54eb);
  border-radius: 4px;
  background: #fff;
  color: var(--color-primary, #2f54eb);
  font-size: 13px;
  cursor: pointer;
}
.tag-pick-btn:hover {
  background: var(--color-primary-bg, #f0f5ff);
}
.tag-pick-hint {
  font-size: 12px;
  color: var(--color-text-placeholder, #999);
}
.tag-import-tip {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-placeholder, #999);
}
.tag-import-selected {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  background: #f5f5f5;
}
.tag-import-chips {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.tag-import-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 24px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--color-border, #e4e7ed);
  color: var(--color-text, #333);
  font-size: 12px;
}
.tag-chip-remove {
  border: 0;
  background: transparent;
  color: var(--color-text-placeholder, #999);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 14px;
}
.tag-chip-remove:hover {
  color: var(--color-text-secondary, #666);
}
.tag-import-count {
  flex: none;
  line-height: 24px;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  white-space: nowrap;
}
.tag-import-estimate {
  display: block;
  width: 100%;
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text, #333);
}
.expire-field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.expire-label {
  flex: none;
  font-size: 14px;
  color: var(--el-text-color-regular, #606266);
  white-space: nowrap;
}
.expire-picker {
  width: 220px;
}
.bulk-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}
.csv-input {
  display: none;
}
.link-btn {
  border: 0;
  background: transparent;
  color: var(--color-primary, #2f54eb);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.link-btn:hover {
  opacity: 0.85;
}
.upload-notice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
}
.info-icon {
  font-size: 14px;
  color: #c0c4cc;
  cursor: help;
}
.success-count {
  color: #22c55e;
}
.fail-count {
  color: #f56c6c;
}
.upload-notice-tip {
  max-width: 320px;
  line-height: 1.6;
  font-size: 12px;
}
</style>
