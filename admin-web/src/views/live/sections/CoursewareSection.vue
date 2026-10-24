<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage, ElPopover, ElRadio, ElRadioGroup, ElTooltip } from "element-plus";
import { InfoFilled, Rank } from "@element-plus/icons-vue";
import Sortable from "sortablejs";
import type { MaterialListItem } from "@/api/materials";
import {
  CourseMaterialAccess,
  type CourseMaterialAccessPermission,
} from "@/api/course";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import MaterialPickerDialog from "../components/MaterialPickerDialog.vue";
import UiButton from "@/components/ui/UiButton.vue";
import type { ActivityCourseware } from "@/api/activity";
import { formatUploadSize } from "@/views/settings/materials/materialUploadFormat";
import { getMaterialFileIcon } from "@/views/settings/materials/materialFileIcons";
import { getTosPreviewUrl } from "@/utils/fileInfo";
import coursewareExampleImg from "@/assets/images/example_of_courseware_materials.png";

const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);

const props = withDefaults(
  defineProps<{
    form: {
      coursewareMaterialIds: string[];
      coursewares: ActivityCourseware[];
    };
    /** 课程新建：展示并编辑学员权限；直播课件不传 */
    enableAccessPermission?: boolean;
  }>(),
  { enableAccessPermission: false },
);

const form = props.form;
const markDirty = useMarkDirty();
const pickerVisible = ref(false);
const tbodyRef = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

function isArchiveName(name: string): boolean {
  return ARCHIVE_EXTS.has(fileExt(name));
}

function defaultAccessPermission(name: string): CourseMaterialAccessPermission {
  return isArchiveName(name)
    ? CourseMaterialAccess.DOWNLOAD_ONLY
    : CourseMaterialAccess.PREVIEW_DOWNLOAD;
}

function formatLabel(item: ActivityCourseware): string {
  const ext = fileExt(item.name);
  if (ext) return ext.toUpperCase();
  return (item.type || "").toUpperCase() || "--";
}

function sizeLabel(item: ActivityCourseware): string {
  return typeof item.fileSize === "number" ? formatUploadSize(item.fileSize) : "--";
}

function durationLabel(item: ActivityCourseware): string {
  if (item.type !== "video") return "--";
  const t = item.durationText?.trim();
  return t || "--";
}

function thumbSrc(item: ActivityCourseware): string {
  if (item.type === "document") {
    return getMaterialFileIcon(item.name);
  }
  const base = item.thumbUrl || item.url;
  if (!base) return "";
  return getTosPreviewUrl(base, 80, 80);
}

function onConfirm(items: MaterialListItem[]) {
  if (items.length > 100) {
    ElMessage.warning("课件资料最多 100 个");
    return;
  }
  const prev = new Map(form.coursewares.map((c) => [c.id, c]));
  form.coursewareMaterialIds = items.map((i) => i.id);
  form.coursewares = items.map((i) => {
    const old = prev.get(i.id);
    const accessPermission =
      props.enableAccessPermission
        ? (old?.accessPermission ?? defaultAccessPermission(i.name))
        : old?.accessPermission;
    const row: ActivityCourseware = {
      id: i.id,
      name: i.name || old?.name || i.id,
      type: i.type,
      url: i.url,
      fileSize: i.fileSize ?? old?.fileSize,
      mimeType: old?.mimeType,
      thumbUrl: i.thumbUrl || old?.thumbUrl,
      durationText:
        i.type === "video" ? (i.meta?.trim() || old?.durationText) : undefined,
      accessPermission: props.enableAccessPermission
        ? isArchiveName(i.name)
          ? CourseMaterialAccess.DOWNLOAD_ONLY
          : (accessPermission === CourseMaterialAccess.PREVIEW_ONLY
              ? CourseMaterialAccess.PREVIEW_ONLY
              : CourseMaterialAccess.PREVIEW_DOWNLOAD)
        : undefined,
    };
    return row;
  });
  markDirty();
}

function removeAt(index: number) {
  form.coursewareMaterialIds.splice(index, 1);
  form.coursewares.splice(index, 1);
  markDirty();
}

function setAccessPermission(item: ActivityCourseware, value: CourseMaterialAccessPermission) {
  if (isArchiveName(item.name)) return;
  item.accessPermission = value;
  markDirty();
}

function reorder(oldIndex: number, newIndex: number) {
  const ids = form.coursewareMaterialIds;
  const rows = form.coursewares;
  const [movedId] = ids.splice(oldIndex, 1);
  const [movedRow] = rows.splice(oldIndex, 1);
  if (movedId == null || movedRow == null) return;
  ids.splice(newIndex, 0, movedId);
  rows.splice(newIndex, 0, movedRow);
  markDirty();
}

function destroySortable() {
  sortable?.destroy();
  sortable = null;
}

function initSortable() {
  destroySortable();
  if (!tbodyRef.value || form.coursewares.length < 2) return;
  sortable = Sortable.create(tbodyRef.value, {
    handle: ".cw-drag",
    animation: 150,
    ghostClass: "cw-row-ghost",
    onEnd(evt) {
      const { oldIndex, newIndex } = evt;
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      reorder(oldIndex, newIndex);
    },
  });
}

watch(
  () => form.coursewares.length,
  async () => {
    await nextTick();
    initSortable();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  destroySortable();
});
</script>

<template>
  <FormRow
    label="课件资料:"
    label-width="90px"
  >
    <div class="cw-wrap">
      <div class="cw-toolbar">
        <UiButton
          class="cw-add-btn"
          variant="outline"
          @click="pickerVisible = true"
        >
          + 添加资料
        </UiButton>
        <p class="cw-hint">
          最多可上传100个文件。学员获得该课程后，课件资料作为该课程的配套资料供学员下载或预览
          <ElPopover
            placement="bottom-start"
            :width="360"
            trigger="hover"
            :show-after="200"
            popper-class="cw-example-popper"
          >
            <template #reference>
              <button
                type="button"
                class="cw-example"
              >
                查看示例
              </button>
            </template>
            <div class="cw-example-card">
              <div class="cw-example-title">
                课件资料示例图
              </div>
              <img
                class="cw-example-img"
                :src="coursewareExampleImg"
                alt="课件资料示例图"
              >
            </div>
          </ElPopover>
        </p>
      </div>

      <div
        v-if="form.coursewares.length"
        class="cw-table-wrap"
      >
        <table class="cw-table">
          <thead>
            <tr>
              <th class="col-file">
                文件
              </th>
              <th class="col-format">
                格式
              </th>
              <th class="col-size">
                文件大小
              </th>
              <th class="col-duration">
                时长
              </th>
              <th
                v-if="enableAccessPermission"
                class="col-perm"
              >
                用户权限设置
              </th>
              <th class="col-op">
                操作
              </th>
            </tr>
          </thead>
          <tbody ref="tbodyRef">
            <tr
              v-for="(item, i) in form.coursewares"
              :key="item.id"
            >
              <td class="col-file">
                <div class="cw-file">
                  <button
                    type="button"
                    class="cw-drag"
                    title="拖拽排序"
                  >
                    <el-icon :size="16">
                      <Rank />
                    </el-icon>
                  </button>
                  <div
                    class="cw-thumb"
                    :class="{ 'is-icon': item.type === 'document' }"
                  >
                    <img
                      v-if="thumbSrc(item)"
                      :src="thumbSrc(item)"
                      :alt="item.name"
                    >
                    <span v-else>—</span>
                  </div>
                  <span
                    class="cw-name"
                    :title="item.name"
                  >{{ item.name }}</span>
                </div>
              </td>
              <td class="col-format">
                {{ formatLabel(item) }}
              </td>
              <td class="col-size">
                {{ sizeLabel(item) }}
              </td>
              <td class="col-duration">
                {{ durationLabel(item) }}
              </td>
              <td
                v-if="enableAccessPermission"
                class="col-perm"
              >
                <template v-if="isArchiveName(item.name)">
                  <span class="cw-perm-fixed">
                    仅下载
                    <ElTooltip
                      content="压缩包不支持在线预览，学员仅可下载"
                      placement="top"
                    >
                      <el-icon class="cw-perm-info">
                        <InfoFilled />
                      </el-icon>
                    </ElTooltip>
                  </span>
                </template>
                <ElRadioGroup
                  v-else
                  :model-value="item.accessPermission ?? CourseMaterialAccess.PREVIEW_DOWNLOAD"
                  size="small"
                  @update:model-value="(v) => setAccessPermission(item, v as CourseMaterialAccessPermission)"
                >
                  <ElRadio :value="CourseMaterialAccess.PREVIEW_DOWNLOAD">
                    预览及下载
                  </ElRadio>
                  <ElRadio :value="CourseMaterialAccess.PREVIEW_ONLY">
                    仅预览
                  </ElRadio>
                </ElRadioGroup>
              </td>
              <td class="col-op">
                <a
                  class="cw-remove"
                  @click.prevent="removeAt(i)"
                >移除</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <MaterialPickerDialog
      v-model="pickerVisible"
      :selected-ids="form.coursewareMaterialIds"
      :max="100"
      @confirm="onConfirm"
    />
  </FormRow>
</template>

<style scoped>
.cw-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.cw-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.cw-add-btn {
  flex: none;
  width: auto;
}
.cw-hint {
  margin: 0;
  flex: 1;
  min-width: 200px;
  font-size: 12px;
  line-height: 1.5;
  color: #999;
}
.cw-example {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: inherit;
  line-height: inherit;
  cursor: pointer;
}
.cw-example:hover {
  text-decoration: underline;
}
.cw-example-card {
  margin: -4px;
}
.cw-example-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}
.cw-example-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
}
.cw-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.cw-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
  color: #333;
}
.cw-table thead th {
  padding: 10px 12px;
  background: #f5f7fa;
  color: #606266;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid #ebeef5;
  white-space: nowrap;
}
.cw-table tbody td {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
  vertical-align: middle;
}
.cw-table tbody tr:last-child td {
  border-bottom: none;
}
.col-file {
  width: auto;
  min-width: 220px;
}
.col-format {
  width: 72px;
}
.col-size {
  width: 100px;
}
.col-duration {
  width: 72px;
}
.col-perm {
  width: 240px;
}
.col-op {
  width: 72px;
}
.cw-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cw-drag {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c0c4cc;
  cursor: grab;
}
.cw-drag:active {
  cursor: grabbing;
}
.cw-thumb {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
}
.cw-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cw-thumb.is-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.cw-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}
.cw-perm-fixed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #606266;
}
.cw-perm-info {
  color: #c0c4cc;
  cursor: help;
  font-size: 14px;
}
.cw-remove {
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
}
.cw-row-ghost {
  opacity: 0.55;
  background: #f0f7ff;
}
:deep(.el-radio) {
  margin-right: 12px;
  height: auto;
}
:deep(.el-radio__label) {
  padding-left: 6px;
  font-size: 13px;
}
</style>

<style>
/* Popover 挂到 body，需非 scoped */
.cw-example-popper.el-popover.el-popper {
  padding: 12px 14px;
}
</style>
