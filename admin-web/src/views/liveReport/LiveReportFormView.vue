<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ElButton,
  ElDatePicker,
  ElImageViewer,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from "element-plus";
import {
  createLiveReport,
  getLiveReport,
  updateLiveReport,
  type PlanTime,
  type ReportAttachment,
  type SaveReportPayload,
} from "@/api/liveReport";
import { listEmployees, type EmployeeItem } from "@/api/activity";
import type { MaterialListItem } from "@/api/materials";
import { useMaterialsStore } from "@/stores/materials";
import { handleUpload } from "@/utils/upload";
import { downloadFiles } from "@/utils/downloadFile";
import { resolveMaterialAccessUrl } from "@/views/settings/materials/materialUploadFormat";
import { randomUuid } from "@/utils/uuid";
import { getMaterialFileIcon } from "@/views/settings/materials/materialFileIcons";
import { previewDocument } from "@/utils/documentPreview";
import MaterialPickerDialog from "@/views/live/components/MaterialPickerDialog.vue";
import UiButton from "@/components/ui/UiButton.vue";

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const route = useRoute();
const router = useRouter();
const store = useMaterialsStore();
const editing = computed(() => !!route.params.id);
const id = ref(String(route.params.id || randomUuid()));
const status = ref("");
const bound = ref(0);

const form = reactive({
  title: "",
  content: "",
  planTimes: [{ startTime: "", endTime: "" }] as PlanTime[],
  coverUrl: "",
  coverObjectKey: "",
  coverFileSize: 0,
  coverMimeType: "",
  coverMaterialId: "",
  hostId: "",
  attachments: [] as ReportAttachment[],
});
const employees = ref<EmployeeItem[]>([]);
const hostLoading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const loading = ref(false);
const passedAppendOnly = computed(() => status.value === "passed");
const originalCount = ref(0);

const coverPicker = ref(false);
const coverPreview = ref(false);
const selectedCoverId = ref("");

function safeName(n: string) {
  return n.replace(/[^\w.\-一-龥]/g, "_");
}

function attachmentKey(name: string) {
  return `live-report/${id.value}/attachment/${Date.now()}_${safeName(name)}`;
}

async function upload(file: File) {
  const cfg = await store.ensureTosConfig();
  const objectKey = attachmentKey(file.name);
  const res = await handleUpload({ ...cfg, name: objectKey, file, fileSize: file.size });
  if (!res) throw new Error("上传失败");
  return {
    objectKey,
    url: resolveMaterialAccessUrl(
      typeof res.Location === "string" ? res.Location : undefined,
      objectKey,
    ),
  };
}

/** 封面仅接受 JPG/PNG 素材（后端同口径白名单），不超过 5MB。 */
function onCoverConfirm(items: MaterialListItem[]) {
  const item = items[0];
  if (!item) return;
  if (!item.url || item.type !== "image") {
    ElMessage.warning("请选择可用的图片素材");
    return;
  }
  if (!/\.(jpe?g|png)$/i.test(item.name)) {
    ElMessage.warning("封面仅支持 JPG/PNG 图片素材");
    return;
  }
  if (!item.fileSize || item.fileSize <= 0) {
    ElMessage.warning("该图片缺少大小信息，请重新选择");
    return;
  }
  if (item.fileSize > MAX_COVER_SIZE) {
    ElMessage.warning("封面图片不能超过 5MB");
    return;
  }
  Object.assign(form, {
    coverUrl: item.url,
    coverObjectKey: item.objectKey,
    coverFileSize: item.fileSize,
    coverMimeType: /\.png$/i.test(item.name) ? "image/png" : "image/jpeg",
    coverMaterialId: item.id,
  });
  selectedCoverId.value = item.id;
}

function removeCover() {
  Object.assign(form, {
    coverUrl: "",
    coverObjectKey: "",
    coverFileSize: 0,
    coverMimeType: "",
    coverMaterialId: "",
  });
  selectedCoverId.value = "";
}

async function downloadAttachment(f: ReportAttachment) {
  const res = await downloadFiles([{ fileUrl: f.url, fileName: f.name }], { useLink: true });
  if (!res.success) ElMessage.error("下载失败");
}

async function loadEmployees(keyword?: string) {
  hostLoading.value = true;
  try {
    const data = await listEmployees(keyword);
    const list = data.list ?? [];
    const map = new Map<string, EmployeeItem>();
    for (const o of list) map.set(o.id, o);
    if (form.hostId && !map.has(form.hostId)) {
      const keep = employees.value.find((x) => x.id === form.hostId);
      if (keep) map.set(keep.id, keep);
    }
    employees.value = [...map.values()];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
  } finally {
    hostLoading.value = false;
  }
}

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  if (form.attachments.length + files.length > 20) {
    ElMessage.warning("最多上传 20 份材料");
    return;
  }
  for (const f of files) {
    if (!/\.(doc|docx|pdf)$/i.test(f.name) || f.size > MAX_ATTACHMENT_SIZE) {
      ElMessage.warning(`${f.name} 格式或大小不符合要求`);
      return;
    }
  }
  uploading.value = true;
  try {
    for (const f of files) {
      const r = await upload(f);
      form.attachments.push({
        name: f.name,
        url: r.url,
        objectKey: r.objectKey,
        fileSize: f.size,
        mimeType: f.type,
      });
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "上传失败");
  } finally {
    uploading.value = false;
    (e.target as HTMLInputElement).value = "";
  }
}

function addTime() {
  if (form.planTimes.length < 10) form.planTimes.push({ startTime: "", endTime: "" });
}

function removeTime(i: number) {
  if (i >= originalCount.value && form.planTimes.length > 1) form.planTimes.splice(i, 1);
}

function validate() {
  if (!form.title.trim() || form.title.trim().length > 64) return "请输入 1~64 字报备名称";
  if (!form.content.trim() || form.content.trim().length > 500) return "请输入 1~500 字报备内容";
  if (form.planTimes.some((x) => !x.startTime || !x.endTime || x.endTime <= x.startTime))
    return "请填写有效的计划起止时间";
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 59, 999);
  if (form.planTimes.some((x) => new Date(x.endTime.replace(" ", "T")) > max))
    return "报备计划截止日期不能超过未来第 7 天";
  if (passedAppendOnly.value) return "";
  if (!form.coverUrl || !form.coverMaterialId) return "请上传报备封面";
  if (!form.hostId) return "请选择主播";
  if (!form.attachments.length) return "请上传直播报备材料";
  return "";
}

async function save() {
  const msg = validate();
  if (msg) {
    ElMessage.warning(msg);
    return;
  }
  saving.value = true;
  try {
    if (passedAppendOnly.value) {
      await updateLiveReport(id.value, { planTimes: form.planTimes });
    } else {
      const payload: SaveReportPayload = { id: id.value, ...form };
      if (editing.value) await updateLiveReport(id.value, payload);
      else await createLiveReport(payload);
    }
    ElMessage.success("保存成功");
    void router.push("/live-reports");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function init() {
  loading.value = true;
  try {
    if (editing.value) {
      const d = await getLiveReport(id.value);
      status.value = d.status;
      bound.value = d.boundLiveCount;
      Object.assign(form, {
        title: d.title,
        content: d.content,
        planTimes: d.planTimes.map((x) => ({ ...x })),
        coverUrl: d.coverUrl,
        coverObjectKey: d.coverObjectKey,
        coverFileSize: d.coverFileSize,
        coverMimeType: d.coverMimeType,
        coverMaterialId: d.coverMaterialId || "",
        hostId: d.host.id,
        attachments: d.attachments.map((x) => ({ ...x })),
      });
      selectedCoverId.value = d.coverMaterialId || "";
      employees.value = [{ id: d.host.id, userName: d.host.userName, avatar: d.host.avatar }];
      originalCount.value = d.status === "passed" ? d.planTimes.length : 0;
      if (d.status === "pending" || d.boundLiveCount > 0) {
        ElMessage.warning("当前报备不可编辑");
        void router.replace(`/live-reports/${id.value}`);
      }
    }
    await loadEmployees();
  } finally {
    loading.value = false;
  }
}

onMounted(init);
</script>

<template>
  <div v-loading="loading" class="form-page">
    <div class="crumb">直播 / 直播报备 / {{ editing ? "编辑" : "新建直播报备" }}</div>
    <div class="card">
      <h2>{{ passedAppendOnly ? "增加计划时间" : editing ? "编辑直播报备" : "新建直播报备" }}</h2>
      <template v-if="!passedAppendOnly">
        <div class="field">
          <label><i>*</i> 报备直播名称</label>
          <ElInput
            v-model="form.title"
            maxlength="64"
            show-word-limit
            placeholder="请输入报备直播名称"
          />
        </div>
        <div class="field">
          <label><i>*</i> 直播报备内容</label>
          <ElInput v-model="form.content" type="textarea" :rows="4" maxlength="500" show-word-limit />
        </div>
      </template>
      <div class="field">
        <label><i>*</i> 计划时间</label>
        <div class="times">
          <div v-for="(t, i) in form.planTimes" :key="i" class="time-row">
            <ElDatePicker
              v-model="t.startTime"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="开始时间"
              :disabled="i < originalCount"
            />
            <span>至</span>
            <ElDatePicker
              v-model="t.endTime"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="结束时间"
              :disabled="i < originalCount"
            />
            <ElButton
              v-if="i >= originalCount && form.planTimes.length > 1"
              link
              type="danger"
              @click="removeTime(i)"
            >
              删除
            </ElButton>
          </div>
          <ElButton v-if="form.planTimes.length < 10" class="add-time" type="primary" link @click="addTime">
            + 增加时间段
          </ElButton>
          <small>报备计划的截止日期不能超过未来第 7 天，最多 10 段</small>
        </div>
      </div>
      <template v-if="!passedAppendOnly">
        <div class="field">
          <label><i>*</i> 报备直播封面</label>
          <div>
            <div class="cover-box" :class="{ 'is-empty': !form.coverUrl }">
              <img v-if="form.coverUrl" :src="form.coverUrl" alt="封面" />
              <div v-else class="cover-placeholder">
                <span>▧</span>
                <small>从素材中心选择</small>
              </div>
              <button v-if="!form.coverUrl" type="button" class="cover-pick" @click="coverPicker = true" />
              <div v-else class="cover-mask">
                <button type="button" @click="coverPreview = true">预览</button>
                <button type="button" @click="coverPicker = true">替换</button>
                <button type="button" @click="removeCover">删除</button>
              </div>
            </div>
            <small>从素材中心选择 JPG/PNG，不超过 5MB，建议 400×400</small>
          </div>
        </div>
        <div class="field">
          <label><i>*</i> 主播</label>
          <ElSelect
            v-model="form.hostId"
            filterable
            remote
            :remote-method="loadEmployees"
            :loading="hostLoading"
            placeholder="请输入主播姓名搜索"
            @visible-change="(open: boolean) => open && loadEmployees()"
          >
            <ElOption v-for="x in employees" :key="x.id" :label="x.userName" :value="x.id" />
          </ElSelect>
        </div>
        <div class="field">
          <label><i>*</i> 直播报备材料</label>
          <div class="materials">
            <label class="pick">
              + 添加材料
              <input type="file" multiple accept=".doc,.docx,.pdf" @change="onFiles" />
            </label>
            <small>支持 doc、docx、pdf，单份不超过 10MB，最多 20 份</small>
            <div v-for="(f, i) in form.attachments" :key="f.objectKey" class="file">
              <img :src="getMaterialFileIcon(f.name)" class="file-icon" alt="" />
              <b>{{ f.name }}</b>
              <span>{{ (f.fileSize / 1024 / 1024).toFixed(2) }}MB</span>
              <button type="button" @click="previewDocument()">预览</button>
              <button type="button" @click="downloadAttachment(f)">下载</button>
              <button type="button" @click="form.attachments.splice(i, 1)">删除</button>
            </div>
          </div>
        </div>
        <MaterialPickerDialog
          v-model="coverPicker"
          title="选择报备直播封面"
          hint="从素材中心选择一张图片作为报备直播封面"
          :selected-ids="selectedCoverId ? [selectedCoverId] : []"
          :max="1"
          :allowed-types="['image']"
          default-type="image"
          @confirm="onCoverConfirm"
        />
        <ElImageViewer
          v-if="coverPreview && form.coverUrl"
          :url-list="[form.coverUrl]"
          teleported
          @close="coverPreview = false"
        />
      </template>
      <div class="actions">
        <UiButton @click="router.back()">取消</UiButton>
        <UiButton variant="primary" :disabled="saving || uploading" @click="save">
          {{ saving ? "保存中…" : "确定" }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-page {
  min-width: 820px;
}
.crumb {
  margin-bottom: 12px;
  color: #666;
  font-size: 13px;
}
.card {
  background: #fff;
  padding: 22px 28px;
  border-radius: 6px;
}
.card h2 {
  margin: 0 0 24px;
  font-size: 17px;
}
.field {
  display: grid;
  grid-template-columns: 140px minmax(0, 620px);
  gap: 14px;
  margin: 0 0 20px;
  align-items: start;
}
.field > label {
  text-align: right;
  padding-top: 8px;
  font-size: 13px;
}
.field > label i {
  color: var(--color-danger, #f5222d);
  font-style: normal;
}
.times,
.materials {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-row .el-date-editor {
  width: 220px;
}
.add-time {
  align-self: flex-start;
  width: max-content;
  padding-left: 0;
  padding-right: 0;
}
small {
  display: block;
  color: #999;
  font-size: 12px;
}
.cover-box {
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
.cover-box.is-empty:hover {
  border-color: var(--color-primary);
}
.cover-box > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #999;
  pointer-events: none;
}
.cover-placeholder > span {
  font-size: 28px;
  color: #c0c4cc;
}
.cover-pick {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.cover-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.cover-box:hover .cover-mask {
  opacity: 1;
  pointer-events: auto;
}
.cover-mask button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.cover-mask button:hover {
  color: var(--color-primary-light);
}
.pick input {
  display: none;
}
.pick {
  width: max-content;
  border: 1px solid var(--color-primary);
  padding: 6px 12px;
  color: var(--color-primary);
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
}
.file {
  display: grid;
  grid-template-columns: 28px minmax(150px, 1fr) 70px auto auto auto;
  gap: 10px;
  align-items: center;
  background: #f7f8fa;
  padding: 10px 12px;
  font-size: 13px;
}
.file-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.file a,
.file button {
  border: 0;
  background: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  border-top: 1px solid #eee;
  padding-top: 20px;
  margin-top: 28px;
}
</style>
