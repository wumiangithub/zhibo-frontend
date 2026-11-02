<script setup lang="ts">
import { ref, watch } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";
import {
  ElButton,
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
  importCourseUsers,
  listCourseUserImports,
  type CourseUserImportHistoryItem,
} from "@/api/course";

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
const csvInput = ref<HTMLInputElement | null>(null);
const importHistory = ref<CourseUserImportHistoryItem[]>([]);
const importHistoryLoading = ref(false);
const bulkImporting = ref(false);

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

function resetForm() {
  addTab.value = "single";
  addMethod.value = "phone";
  addPhone.value = "";
  addPhoneCode.value = "+86";
  addViewerId.value = "";
}

function onAddMethodChange() {
  addPhone.value = "";
  addViewerId.value = "";
}

async function submitAdd() {
  if (addTab.value !== "single") return;

  let body: { phone: string } | { viewerId: number };
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
    const result = await importCourseUsers(props.courseId, file);
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
    :width="addTab === 'bulk' ? '760px' : '560px'"
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
          label-width="96px"
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
        </ElForm>
      </ElTabPane>
      <ElTabPane
        label="批量导入"
        name="bulk"
      >
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
        <p class="add-tab-placeholder">标签导入即将支持</p>
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
      <ElButton
        v-else
        @click="visible = false"
      >
        关闭
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.add-tabs {
  min-height: 220px;
}
.bulk-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.csv-input {
  display: none;
}
.link-btn {
  border: 0;
  background: transparent;
  color: #409eff;
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.link-btn:hover {
  color: #66b1ff;
}
.upload-notice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}
.info-icon {
  color: #909399;
  cursor: help;
}
.upload-notice-tip {
  max-width: 280px;
  line-height: 1.5;
}
.success-count {
  color: #67c23a;
}
.fail-count {
  color: #f56c6c;
}
.add-tab-placeholder {
  margin: 40px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
