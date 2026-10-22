<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ElButton,
  ElDatePicker,
  ElInput,
  ElMessage,
  ElOption,
  ElProgress,
  ElSelect,
  ElTimePicker,
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
import { TosObjectKeyPrefix } from "@/utils/tosUpload";
import { downloadFiles } from "@/utils/downloadFile";
import {
  formatUploadSize,
  resolveMaterialAccessUrl,
} from "@/views/settings/materials/materialUploadFormat";
import { randomUuid } from "@/utils/uuid";
import { getMaterialFileIcon } from "@/views/settings/materials/materialFileIcons";
import { previewDocument } from "@/utils/documentPreview";
import MaterialPickerDialog from "@/views/live/components/MaterialPickerDialog.vue";
import ImagePreview from "@/components/ImagePreview.vue";
import type { ImagePreviewItem } from "@/components/ImagePreview.vue";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import UiButton from "@/components/ui/UiButton.vue";

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** 材料上传队列项（对齐素材中心 MaterialUploadItem 的进度字段）。 */
type PendingUpload = {
  uid: string;
  name: string;
  fileSize: number;
  status: "waiting" | "uploading" | "error";
  percent: number;
};

/** 表单内拆成日期+时刻，提交时再拼成 API 的 startTime/endTime。 */
type PlanTimeRow = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const dateShortcuts = [{ text: "今天", value: () => new Date() }];

function emptyPlanTime(): PlanTimeRow {
  return { startDate: "", startTime: "", endDate: "", endTime: "" };
}

function fromApiPlanTime(x: PlanTime): PlanTimeRow {
  const [sd, st] = (x.startTime || "").split(" ");
  const [ed, et] = (x.endTime || "").split(" ");
  return {
    startDate: sd || "",
    startTime: st ? st.slice(0, 5) : "",
    endDate: ed || "",
    endTime: et ? et.slice(0, 5) : "",
  };
}

function joinDateTime(date: string, time: string) {
  return date && time ? `${date} ${time}:00` : "";
}

function toApiPlanTimes(rows: PlanTimeRow[]): PlanTime[] {
  return rows.map((x) => ({
    startTime: joinDateTime(x.startDate, x.startTime),
    endTime: joinDateTime(x.endDate, x.endTime),
  }));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 与新建直播同一套日期+时刻；计划时间再禁用今天之前。 */
function disablePastDate(date: Date) {
  return date.getTime() < startOfToday().getTime();
}

function isSameCalendarDay(dateStr: string, now = new Date()) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
}

function disabledPastHours(dateStr: string) {
  if (!isSameCalendarDay(dateStr)) return [];
  const hour = new Date().getHours();
  return Array.from({ length: hour }, (_, i) => i);
}

function disabledPastMinutes(dateStr: string, hour: number) {
  if (!isSameCalendarDay(dateStr)) return [];
  const now = new Date();
  if (hour !== now.getHours()) return hour < now.getHours() ? Array.from({ length: 60 }, (_, i) => i) : [];
  return Array.from({ length: now.getMinutes() }, (_, i) => i);
}

const route = useRoute();
const router = useRouter();
const store = useMaterialsStore();
const editing = computed(() => !!route.params.id);
/** 编辑态为报备 id；新建态为空（主键由后端生成）。 */
const id = ref(String(route.params.id || ""));
const status = ref("");
const bound = ref(0);
/**
 * 同一批材料共用此前缀，落在 `live-report/attachment/` 下，不再按报备建子目录。
 * 新建：进入页时生成；编辑：用报备 id。
 */
const attachmentBatchPrefix = ref(editing.value ? id.value : randomUuid());
/** 同批序号只增不补洞（删中间项也不回填）。 */
const nextAttachmentSeq = ref(1);

const crumbs = computed<AppBreadcrumbItem[]>(() => [
  { label: "直播", to: "/live" },
  { label: "直播报备", to: "/live-reports" },
  { label: editing.value ? "编辑" : "新建直播报备" },
]);

const form = reactive({
  title: "",
  content: "",
  planTimes: [emptyPlanTime()] as PlanTimeRow[],
  coverUrl: "",
  coverObjectKey: "",
  coverFileSize: 0,
  coverMimeType: "",
  coverMaterialId: "",
  hostId: "" as string | number,
  attachments: [] as ReportAttachment[],
});

/** 主播选择：对齐归属人（下拉带头像，选中后下方 tag 也带头像；部门灰色跟在姓名后） */
const hostLoading = ref(false);
const hostOptions = ref<EmployeeItem[]>([]);
const selectedHost = ref<EmployeeItem | null>(null);
const knownHost = ref<EmployeeItem | null>(null);
const brokenAvatar = ref<Record<string, boolean>>({});

function idKey(id: string | number | null | undefined) {
  if (id == null || id === "") return "";
  return String(id);
}

function mergeEmployee(a?: EmployeeItem | null, b?: EmployeeItem | null): EmployeeItem | undefined {
  if (!a && !b) return undefined;
  const raw = a?.id ?? b?.id;
  if (raw == null || raw === ("" as unknown)) return undefined;
  const id = typeof raw === "number" ? raw : Number(raw);
  const fallback = idKey(raw);
  return {
    id: Number.isFinite(id) ? id : 0,
    userName: (a?.userName || b?.userName || fallback).trim() || fallback,
    avatar: a?.avatar?.trim() || b?.avatar?.trim() || undefined,
    departmentName:
      a?.departmentName?.trim() || b?.departmentName?.trim() || undefined,
  };
}

function deptOf(emp: EmployeeItem) {
  return emp.departmentName?.trim() || "";
}

function hostAvatarOf(emp: EmployeeItem) {
  const url = emp.avatar?.trim();
  if (!url || brokenAvatar.value[idKey(emp.id)]) return "";
  return url;
}

function onHostAvatarError(id: string | number) {
  brokenAvatar.value = { ...brokenAvatar.value, [idKey(id)]: true };
}

function syncSelectedHost() {
  const id = idKey(form.hostId);
  if (!id) {
    selectedHost.value = null;
    return;
  }
  const fromOpt = hostOptions.value.find((o) => idKey(o.id) === id) ?? null;
  const fromKnown =
    knownHost.value && idKey(knownHost.value.id) === id ? knownHost.value : null;
  const prev =
    selectedHost.value && idKey(selectedHost.value.id) === id
      ? selectedHost.value
      : null;
  selectedHost.value =
    mergeEmployee(fromOpt, fromKnown) ??
    mergeEmployee(prev, fromKnown) ??
    mergeEmployee(fromKnown, null) ??
    mergeEmployee(fromOpt, null) ?? {
      id: Number(id) || 0,
      userName: id,
    };
  // 保证 ElSelect 能解析 label（避免回退显示裸 id）
  if (
    selectedHost.value &&
    !hostOptions.value.some((o) => idKey(o.id) === id)
  ) {
    hostOptions.value = [selectedHost.value, ...hostOptions.value];
  }
}

async function loadEmployees(keyword?: string) {
  hostLoading.value = true;
  try {
    const data = await listEmployees(keyword);
    const list = data.list ?? [];
    const map = new Map<string, EmployeeItem>();
    for (const o of list) map.set(idKey(o.id), o);
    if (knownHost.value) {
      const kid = idKey(knownHost.value.id);
      map.set(kid, mergeEmployee(map.get(kid), knownHost.value)!);
    }
    if (selectedHost.value) {
      const sid = idKey(selectedHost.value.id);
      map.set(sid, mergeEmployee(map.get(sid), selectedHost.value)!);
    }
    const currentId = idKey(form.hostId);
    if (currentId && !map.has(currentId)) {
      map.set(currentId, {
        id: Number(currentId) || 0,
        userName: currentId,
      });
    }
    hostOptions.value = [...map.values()];
    syncSelectedHost();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
  } finally {
    hostLoading.value = false;
  }
}

function onHostChange(id: string | number | null | undefined) {
  form.hostId = id == null || id === "" ? "" : id;
  syncSelectedHost();
  if (selectedHost.value) knownHost.value = selectedHost.value;
  else knownHost.value = null;
}

function clearHost() {
  form.hostId = "";
  selectedHost.value = null;
  knownHost.value = null;
}

watch(
  () => [
    idKey(form.hostId),
    knownHost.value
      ? `${idKey(knownHost.value.id)}:${knownHost.value.userName}`
      : "",
  ],
  () => syncSelectedHost(),
  { immediate: true },
);

const saving = ref(false);
const uploading = ref(false);
/** 串行上传时展示当前/排队文件的百分比，避免只有 uploading 布尔。 */
const pendingUploads = ref<PendingUpload[]>([]);
const loading = ref(false);
const passedAppendOnly = computed(() => status.value === "passed");
const originalCount = ref(0);

const coverPicker = ref(false);
const coverPreview = ref(false);
const selectedCoverId = ref("");
/** 封面预览走公用 ImagePreview（与素材中心一致） */
const coverPreviewItems = computed<ImagePreviewItem[]>(() =>
  form.coverUrl
    ? [{ url: form.coverUrl, name: form.title.trim() || "报备封面" }]
    : [],
);

function safeName(n: string) {
  return n.replace(/[^\w.\-一-龥]/g, "_");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 从已有 objectKey 解析同批最大序号，供编辑页续号。 */
function maxAttachmentSeqFromKeys(keys: string[], prefix: string): number {
  const re = new RegExp(
    `^${escapeRegExp(TosObjectKeyPrefix.LIVE_REPORT_ATTACHMENT)}${escapeRegExp(prefix)}_(\\d+)_`,
  );
  let max = 0;
  for (const key of keys) {
    const m = key.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * `{前缀}_{NN}_{真实文件名}`，目录统一 `live-report/attachment/`。
 * 取号即 +1，上传失败也不回退，避免重名。
 */
function takeAttachmentObjectKey(fileName: string) {
  const seq = String(nextAttachmentSeq.value).padStart(2, "0");
  nextAttachmentSeq.value += 1;
  return `${TosObjectKeyPrefix.LIVE_REPORT_ATTACHMENT}${attachmentBatchPrefix.value}_${seq}_${safeName(fileName)}`;
}

async function upload(file: File, onProgress?: (percent: number) => void) {
  const cfg = await store.ensureTosConfig();
  const objectKey = takeAttachmentObjectKey(file.name);
  const res = await handleUpload({
    ...cfg,
    name: objectKey,
    file,
    fileSize: file.size,
    onProgress: (percent) => onProgress?.(percent),
  });
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

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (uploading.value) {
    ElMessage.warning("正在上传，请稍候");
    input.value = "";
    return;
  }
  if (form.attachments.length + files.length > 20) {
    ElMessage.warning("最多上传 20 份材料");
    input.value = "";
    return;
  }
  for (const f of files) {
    if (!/\.(doc|docx|pdf)$/i.test(f.name) || f.size > MAX_ATTACHMENT_SIZE) {
      ElMessage.warning(`${f.name} 格式或大小不符合要求（单份不超过 10MB）`);
      input.value = "";
      return;
    }
  }

  const queue = files.map((f) => ({
    uid: randomUuid(),
    name: f.name,
    fileSize: f.size,
    status: "waiting" as const,
    percent: 0,
    file: f,
  }));
  pendingUploads.value = queue.map(({ uid, name, fileSize, status, percent }) => ({
    uid,
    name,
    fileSize,
    status,
    percent,
  }));
  uploading.value = true;
  try {
    for (const item of queue) {
      const pending = pendingUploads.value.find((x) => x.uid === item.uid);
      if (pending) {
        pending.status = "uploading";
        pending.percent = 0;
      }
      try {
        const r = await upload(item.file, (percent) => {
          if (pending) pending.percent = percent;
        });
        if (pending) pending.percent = 100;
        form.attachments.push({
          name: item.name,
          url: r.url,
          objectKey: r.objectKey,
          fileSize: item.fileSize,
          mimeType: item.file.type,
        });
        pendingUploads.value = pendingUploads.value.filter((x) => x.uid !== item.uid);
      } catch (err) {
        if (pending) {
          pending.status = "error";
          pending.percent = 0;
        }
        ElMessage.error(
          err instanceof Error ? `${item.name}：${err.message}` : `${item.name} 上传失败`,
        );
      }
    }
  } finally {
    uploading.value = false;
    pendingUploads.value = pendingUploads.value.filter((x) => x.status === "error");
    input.value = "";
  }
}

function dismissPending(uid: string) {
  pendingUploads.value = pendingUploads.value.filter((x) => x.uid !== uid);
}

/** 对齐 MaterialUploadFileTable.statusText：等待 / 上传中百分比 / 失败。 */
function pendingStatusText(item: PendingUpload) {
  if (item.status === "waiting") return "等待上传";
  if (item.status === "error") return "上传失败";
  return `${item.percent.toFixed(1)}%`;
}

function addTime() {
  if (form.planTimes.length < 10) form.planTimes.push(emptyPlanTime());
}

function removeTime(i: number) {
  if (i >= originalCount.value && form.planTimes.length > 1) form.planTimes.splice(i, 1);
}

function validate() {
  if (!form.title.trim() || form.title.trim().length > 64) return "请输入 1~64 字报备名称";
  if (!form.content.trim() || form.content.trim().length > 500) return "请输入 1~500 字报备内容";
  if (
    form.planTimes.some(
      (x) =>
        !x.startDate ||
        !x.startTime ||
        !x.endDate ||
        !x.endTime ||
        joinDateTime(x.endDate, x.endTime) <= joinDateTime(x.startDate, x.startTime),
    )
  )
    return "请填写有效的计划起止时间";
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 59, 999);
  if (form.planTimes.some((x) => new Date(joinDateTime(x.endDate, x.endTime).replace(" ", "T")) > max))
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
    const planTimes = toApiPlanTimes(form.planTimes);
    if (passedAppendOnly.value) {
      await updateLiveReport(id.value, { planTimes });
    } else {
      const payload: SaveReportPayload = {
        title: form.title,
        content: form.content,
        planTimes,
        coverUrl: form.coverUrl,
        coverObjectKey: form.coverObjectKey,
        coverFileSize: form.coverFileSize,
        coverMimeType: form.coverMimeType,
        coverMaterialId: form.coverMaterialId,
        hostId: Number(form.hostId),
        attachments: form.attachments,
      };
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
      attachmentBatchPrefix.value = d.id;
      Object.assign(form, {
        title: d.title,
        content: d.content,
        planTimes: d.planTimes.map(fromApiPlanTime),
        coverUrl: d.coverUrl,
        coverObjectKey: d.coverObjectKey,
        coverFileSize: d.coverFileSize,
        coverMimeType: d.coverMimeType,
        coverMaterialId: d.coverMaterialId || "",
        hostId: d.host.id,
        attachments: d.attachments.map((x) => ({ ...x })),
      });
      nextAttachmentSeq.value =
        maxAttachmentSeqFromKeys(
          form.attachments.map((x) => x.objectKey),
          attachmentBatchPrefix.value,
        ) + 1;
      selectedCoverId.value = d.coverMaterialId || "";
      knownHost.value = {
        id: d.host.id,
        userName: d.host.userName,
        avatar: d.host.avatar,
      };
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
    <AppBreadcrumb :items="crumbs" />
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
              v-model="t.startDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              :disabled-date="disablePastDate"
              :disabled="i < originalCount"
              style="width: 160px"
            />
            <ElTimePicker
              v-model="t.startTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              :disabled-hours="() => disabledPastHours(t.startDate)"
              :disabled-minutes="(h: number) => disabledPastMinutes(t.startDate, h)"
              :disabled="i < originalCount"
              style="width: 120px"
            />
            <span>至</span>
            <ElDatePicker
              v-model="t.endDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              :disabled-date="disablePastDate"
              :disabled="i < originalCount"
              style="width: 160px"
            />
            <ElTimePicker
              v-model="t.endTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              :disabled-hours="() => disabledPastHours(t.endDate)"
              :disabled-minutes="(h: number) => disabledPastMinutes(t.endDate, h)"
              :disabled="i < originalCount"
              style="width: 120px"
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
            <small>建议尺寸750*422px或16:9,小于5M的JPG、PNG格式图片</small>
          </div>
        </div>
        <div class="field">
          <label><i>*</i> 主播</label>
          <div class="host-wrap">
            <ElSelect
              :model-value="form.hostId === '' ? undefined : form.hostId"
              filterable
              remote
              clearable
              :remote-method="loadEmployees"
              :loading="hostLoading"
              placeholder="请输入主播姓名搜索"
              style="width: 360px"
              @update:model-value="onHostChange"
              @visible-change="(open: boolean) => open && loadEmployees()"
            >
              <ElOption
                v-for="emp in hostOptions"
                :key="idKey(emp.id)"
                :label="emp.userName"
                :value="emp.id"
              >
                <span class="host-option">
                  <span class="host-option__avatar">
                    <img
                      v-if="hostAvatarOf(emp)"
                      :src="hostAvatarOf(emp)"
                      alt=""
                      @error="onHostAvatarError(emp.id)"
                    >
                    <svg
                      v-else
                      class="host-option__icon"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
                    </svg>
                  </span>
                  <span>{{ emp.userName }}</span>
                  <span
                    v-if="deptOf(emp)"
                    class="host-option__dept"
                  >{{ deptOf(emp) }}</span>
                </span>
              </ElOption>
            </ElSelect>
            <div
              v-if="selectedHost"
              class="host-tags"
            >
              <span class="host-tag">
                <span class="host-tag__avatar">
                  <img
                    v-if="hostAvatarOf(selectedHost)"
                    :src="hostAvatarOf(selectedHost)"
                    alt=""
                    @error="onHostAvatarError(selectedHost.id)"
                  >
                  <svg
                    v-else
                    class="host-tag__icon"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
                  </svg>
                </span>
                <span class="host-tag__name">{{ selectedHost.userName }}</span>
                <span
                  v-if="deptOf(selectedHost)"
                  class="host-tag__dept"
                >{{ deptOf(selectedHost) }}</span>
                <i
                  class="host-tag__x"
                  @click="clearHost"
                >×</i>
              </span>
            </div>
          </div>
        </div>
        <div class="field">
          <label><i>*</i> 直播报备材料</label>
          <div class="materials">
            <label class="pick" :class="{ 'is-disabled': uploading }">
              + 添加材料
              <input
                type="file"
                multiple
                accept=".doc,.docx,.pdf"
                :disabled="uploading"
                @change="onFiles"
              />
            </label>
            <small>支持 doc、docx、pdf，单份不超过 10MB，最多 20 份</small>
            <div v-for="(f, i) in form.attachments" :key="f.objectKey" class="file">
              <img :src="getMaterialFileIcon(f.name)" class="file-icon" alt="" />
              <b>{{ f.name }}</b>
              <span>{{ (f.fileSize / 1024 / 1024).toFixed(2) }}MB</span>
              <button type="button" @click="previewDocument(f.url, f.name)">预览</button>
              <button type="button" @click="downloadAttachment(f)">下载</button>
              <button type="button" @click="form.attachments.splice(i, 1)">删除</button>
            </div>
            <!-- 上传中/失败占位固定在列表底部，成功后 append 到 attachments 仍在底部 -->
            <div v-for="p in pendingUploads" :key="p.uid" class="file file-pending">
              <img :src="getMaterialFileIcon(p.name)" class="file-icon" alt="" />
              <b>{{ p.name }}</b>
              <span>{{ (p.fileSize / 1024 / 1024).toFixed(2) }}MB</span>
              <div v-if="p.status === 'uploading'" class="status-uploading">
                <ElProgress
                  type="circle"
                  :percentage="p.percent"
                  :width="22"
                  :stroke-width="3"
                  :show-text="false"
                  color="var(--color-primary)"
                />
                <span>{{ p.percent.toFixed(1) }}%</span>
              </div>
              <span v-else-if="p.status === 'waiting'" class="status-text">等待上传</span>
              <span v-else class="status-text is-error">上传失败</span>
              <button
                v-if="p.status === 'error'"
                type="button"
                @click="dismissPending(p.uid)"
              >
                移除
              </button>
              <span v-else />
              <span />
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
        <ImagePreview v-model="coverPreview" :items="coverPreviewItems" />
      </template>
    </div>

    <div class="actions">
      <UiButton @click="router.back()">取消</UiButton>
      <UiButton variant="primary" :disabled="saving || uploading" @click="save">
        {{ saving ? "保存中…" : "确定" }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.form-page {
  position: relative;
  min-width: 980px;
  padding-bottom: 80px;
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
  grid-template-columns: 140px minmax(0, 760px);
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
.time-row :deep(.el-date-editor) {
  flex: none;
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
.host-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.host-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.host-option__dept,
.host-tag__dept {
  color: #999;
  font-size: 12px;
}
.host-option__avatar,
.host-tag__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  background: #d9d9d9;
  color: #fff;
  flex-shrink: 0;
}
.host-option__avatar img,
.host-tag__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.host-option__icon,
.host-tag__icon {
  width: 12px;
  height: 12px;
}
.host-tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  padding: 10px 12px;
  background: #f5f6f8;
  border-radius: 6px;
}
.host-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  color: #333;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 4px 10px 4px 4px;
  font-size: 13px;
}
.host-tag__name {
  line-height: 1;
}
.host-tag__x {
  cursor: pointer;
  font-style: normal;
  color: #999;
  line-height: 1;
  font-size: 14px;
}
.host-tag__x:hover {
  color: #f5222d;
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
.pick.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
/* 对齐素材中心 MaterialUploadFileTable .status-uploading */
.status-uploading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #333;
  font-size: 13px;
}
.status-text {
  font-size: 13px;
  color: #999;
}
.status-text.is-error {
  color: #f5222d;
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
/* 与新建直播 LiveCreateView .live-create__footer 同一套贴底悬浮 */
.actions {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  z-index: 10;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 0 32px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
