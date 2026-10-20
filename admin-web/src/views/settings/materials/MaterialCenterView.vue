<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ElInput,
  ElSelect,
  ElOption,
  ElButton,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElTag,
  ElMessageBox,
  ElMessage,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElDialog,
} from "element-plus";
import { Plus, RefreshRight } from "@element-plus/icons-vue";
import ImageCropDialog from "@/views/live/components/ImageCropDialog.vue";
import { downloadFiles } from "@/utils/downloadFile";
import { handleUpload } from "@/utils/upload";
import { useMaterialsStore } from "@/stores/materials";
import MaterialUploadDialog from "./MaterialUploadDialog.vue";
import MaterialGroupSidebar from "./MaterialGroupSidebar.vue";
import MaterialVideoPreviewDialog from "./MaterialVideoPreviewDialog.vue";
import ImagePreview from "@/components/ImagePreview.vue";
import MaterialAssetCell from "./MaterialAssetCell.vue";
import MaterialAuditRecordsDrawer from "./MaterialAuditRecordsDrawer.vue";
import {
  asFileMaterialType,
  AUDIT_OPTIONS,
  CENTER_TYPE_TABS,
  COL_ASSET_LABEL,
  COL_STATUS_LABEL,
  NAME_FILTER_LABEL,
  UPLOAD_BTN,
  type AuditStatus,
} from "./mock";
import {
  isMaterialAuditPending,
  isMaterialSelectable,
  MaterialAudit,
  MATERIAL_AUDIT_LABEL,
  materialAvailabilityLabel,
  moveMaterial,
  replaceMaterialImage,
  type MaterialAuditStatus,
  type MaterialCenterType,
  type MaterialListItem,
} from "@/api/materials";
import type { MaterialRegisterItem } from "./materialUploadTypes";
import { buildMaterialObjectKey, formatUploadSize, resolveMaterialAccessUrl } from "./materialUploadFormat";
import { useMaterialCenter } from "@/composables/useMaterialCenter";

const route = useRoute();
const router = useRouter();

function initialCenterType(): MaterialCenterType {
  const raw = route.query.type;
  if (raw === "image" || raw === "video" || raw === "document" || raw === "article") {
    return raw;
  }
  return "image";
}

const {
  materialType,
  groupKeyword,
  nameKeyword,
  activeGroupId,
  page,
  pageSize,
  total,
  listLoading,
  list,
  filteredGroups,
  uploadGroups,
  refreshAll,
  search,
  resetFilter,
  onPageChange,
  onPageSizeChange,
  addGroup,
  renameGroup,
  removeGroup,
  registerAfterUpload,
  renameMaterialItem,
  toggleAiAudit,
  toggleRiskAudit,
} = useMaterialCenter({ initialType: initialCenterType() });

const primaryLabel = computed(() =>
  materialType.value === "article" ? "新增文章" : UPLOAD_BTN[materialType.value],
);
const namePlaceholder = computed(() =>
  materialType.value === "article" ? "请输入文章名称" : "请输入",
);

/** 审核筛选：本迭代仅 UI 占位，不进列表 API */
const auditFilter = ref<"" | AuditStatus>("");
const uploadVisible = ref(false);

/** 图片：Element Plus 查看器（当前页原图列表） */
const imageViewerVisible = ref(false);
const imageViewerIndex = ref(0);
const imagePreviewItems = computed(() =>
  list.value
    .filter((row) => !!row.url)
    .map((row) => ({ url: row.url as string, name: row.name })),
);

/** 视频：弹窗播放 */
const videoPreviewVisible = ref(false);
const videoPreviewUrl = ref("");
const videoPreviewTitle = ref("");

onMounted(() => {
  void refreshAll();
});

function openUpload() {
  if (materialType.value === "article") {
    const groupId = activeGroupId.value === "all" ? undefined : activeGroupId.value;
    void router.push({
      name: "settings-article-create",
      query: groupId ? { groupId } : {},
    });
    return;
  }
  uploadVisible.value = true;
}

async function onUploadConfirm(payload: {
  groupId: string;
  registerItems: MaterialRegisterItem[];
}) {
  if (!payload.registerItems.length) return;
  await registerAfterUpload(payload.groupId, payload.registerItems);
}

function onThumbClick(row: MaterialListItem) {
  if (materialType.value === "image") {
    if (!row.url) {
      ElMessage.warning("暂无预览地址");
      return;
    }
    const idx = imagePreviewItems.value.findIndex((i) => i.url === row.url);
    if (idx < 0) {
      ElMessage.warning("暂无预览地址");
      return;
    }
    imageViewerIndex.value = idx;
    imageViewerVisible.value = true;
    return;
  }
  if (materialType.value === "video") {
    if (!row.url) {
      ElMessage.warning("暂无可播放地址");
      return;
    }
    videoPreviewUrl.value = row.url;
    videoPreviewTitle.value = row.name;
    videoPreviewVisible.value = true;
  }
}

function auditLabel(s?: MaterialAuditStatus | null) {
  return MATERIAL_AUDIT_LABEL[normalizeAudit(s)];
}

function auditTagType(s?: MaterialAuditStatus | null): "success" | "danger" | "info" {
  const n = normalizeAudit(s);
  if (n === MaterialAudit.PASSED) return "success";
  if (n === MaterialAudit.REJECTED) return "danger";
  return "info";
}

function normalizeAudit(s?: MaterialAuditStatus | null): MaterialAuditStatus {
  if (s === MaterialAudit.PASSED || s === MaterialAudit.REJECTED) return s;
  return MaterialAudit.PENDING;
}

const auditDrawerVisible = ref(false);
const auditDrawerId = ref("");
const auditDrawerTitle = ref("");
const auditDrawerCover = ref("");

function openAuditRecords(row: MaterialListItem) {
  auditDrawerId.value = row.id;
  auditDrawerTitle.value = row.name;
  auditDrawerCover.value = row.url?.trim() || "";
  auditDrawerVisible.value = true;
}

const moveVisible = ref(false);
const moveSaving = ref(false);
const moveRow = ref<MaterialListItem | null>(null);
const moveTargetId = ref("");

const moveOptions = computed(() =>
  uploadGroups.value.filter(
    (g) => g.id !== "all" && g.id !== moveRow.value?.groupId,
  ),
);

const cropVisible = ref(false);
const cropSrc = ref("");
const cropRow = ref<MaterialListItem | null>(null);
const cropSaving = ref(false);

function onMoreCommand(cmd: string, row: MaterialListItem) {
  if (cmd === "move") {
    openMove(row);
    return;
  }
  if (cmd === "crop") {
    openCrop(row);
    return;
  }
  if (cmd === "download") {
    void downloadRow(row);
    return;
  }
  if (cmd === "edit") {
    openArticleEdit(row);
    return;
  }
  if (cmd === "ai") {
    void toggleAiAudit(row);
    return;
  }
  if (cmd === "risk") {
    void toggleRiskAudit(row);
  }
}

function openMove(row: MaterialListItem) {
  moveRow.value = row;
  const options = uploadGroups.value.filter((g) => g.id !== "all" && g.id !== row.groupId);
  if (!options.length) {
    ElMessage.warning("没有其他分组");
    return;
  }
  moveTargetId.value = options[0].id;
  moveVisible.value = true;
}

async function confirmMove() {
  const row = moveRow.value;
  if (!row || !moveTargetId.value || moveSaving.value) return;
  moveSaving.value = true;
  try {
    await moveMaterial(row.id, moveTargetId.value);
    ElMessage.success("已移动");
    moveVisible.value = false;
    await refreshAll();
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : "移动失败");
  } finally {
    moveSaving.value = false;
  }
}

function openCrop(row: MaterialListItem) {
  if (isMaterialAuditPending(row)) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  if (!row.url) {
    ElMessage.warning("暂无图片地址");
    return;
  }
  cropRow.value = row;
  cropSrc.value = row.url;
  cropVisible.value = true;
}

async function onCropConfirm(file: File) {
  const row = cropRow.value;
  if (!row || cropSaving.value) return;
  cropSaving.value = true;
  try {
    const config = await useMaterialsStore().ensureTosConfig();
    const objectKey = buildMaterialObjectKey("image", file.name);
    const result = await handleUpload({
      ...config,
      name: objectKey,
      file,
      fileSize: file.size,
    });
    if (!result || result.cancelled) throw new Error("裁剪上传已取消");
    const url = resolveMaterialAccessUrl(
      typeof result.Location === "string" ? result.Location : undefined,
      objectKey,
    );
    await replaceMaterialImage(row.id, {
      url,
      objectKey,
      fileSize: file.size,
    });
    ElMessage.success("已裁剪，重新进入审核");
    await refreshAll();
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : "裁剪失败");
  } finally {
    cropSaving.value = false;
  }
}

async function downloadRow(row: MaterialListItem) {
  if (!row.url) {
    ElMessage.warning("暂无下载地址");
    return;
  }
  try {
    const res = await downloadFiles(
      [{ fileUrl: row.url, fileName: row.name || "download" }],
      { useLink: true },
    );
    if (!res.success) ElMessage.error("下载失败");
  } catch {
    ElMessage.error("下载失败");
  }
}

function openArticleEdit(row: MaterialListItem) {
  if (isMaterialAuditPending(row)) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  void router.push({ name: "settings-article-edit", params: { id: row.id } });
}

function sizeText(row: MaterialListItem) {
  return typeof row.fileSize === "number" ? formatUploadSize(row.fileSize) : "—";
}

function displayOrDash(value?: string | null) {
  const t = value?.trim();
  return t ? t : "—";
}

async function onEditName(row: MaterialListItem) {
  try {
    const { value } = await ElMessageBox.prompt(
      "请输入新的展示名称（建议保留原扩展名，不影响云端文件）",
      "编辑名称",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputValue: row.name,
        inputPlaceholder: "素材名称",
        inputValidator: (v) => {
          const t = String(v ?? "").trim();
          if (!t) return "名称不能为空";
          if (t.length > 256) return "名称不能超过 256 字";
          return true;
        },
      },
    );
    await renameMaterialItem(row, String(value).trim());
  } catch {
    /* 取消 */
  }
}
</script>

<template>
  <div class="material-page">
    <div class="page-crumb">
      <span class="crumb-muted">设置</span>
      <span class="crumb-sep">/</span>
      <span>素材中心</span>
    </div>

    <div class="type-tabs">
      <button
        v-for="tab in CENTER_TYPE_TABS"
        :key="tab.key"
        type="button"
        class="type-tab"
        :class="{ 'is-active': materialType === tab.key }"
        @click="materialType = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="material-body">
      <MaterialGroupSidebar
        v-model:keyword="groupKeyword"
        v-model:active-group-id="activeGroupId"
        :groups="filteredGroups"
        @add="addGroup"
        @rename="renameGroup"
        @remove="removeGroup"
      />

      <section class="list-panel">
        <div class="toolbar">
          <ElButton
            type="primary"
            :icon="materialType === 'article' ? Plus : undefined"
            @click="openUpload"
          >
            {{ primaryLabel }}
          </ElButton>
          <div class="filters">
            <span class="filter-label">{{ NAME_FILTER_LABEL[materialType] }}</span>
            <ElInput
              v-model="nameKeyword"
              clearable
              :placeholder="namePlaceholder"
              :style="{ width: materialType === 'article' ? '220px' : '180px' }"
              @keyup.enter="search"
            />
            <span class="filter-label">审核状态</span>
            <ElSelect
              v-model="auditFilter"
              placeholder="全部状态"
              style="width: 140px"
            >
              <ElOption
                v-for="opt in AUDIT_OPTIONS"
                :key="String(opt.value)"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
            <ElButton
              type="primary"
              @click="search"
            >
              查询
            </ElButton>
            <ElButton
              :icon="RefreshRight"
              @click="resetFilter"
            >
              重置
            </ElButton>
          </div>
        </div>

        <div
          v-loading="listLoading"
          class="table-wrap"
        >
          <ElTable
            :data="list"
            row-key="id"
            height="100%"
            class="material-table"
          >
            <ElTableColumn
              type="selection"
              width="48"
            />
            <ElTableColumn
              :label="COL_ASSET_LABEL[materialType]"
              min-width="220"
            >
              <template #default="{ row }">
                <span
                  v-if="materialType === 'article'"
                  class="article-title"
                  :title="(row as MaterialListItem).name"
                >{{ (row as MaterialListItem).name }}</span>
                <MaterialAssetCell
                  v-else
                  :row="(row as MaterialListItem)"
                  :material-type="asFileMaterialType(materialType)"
                  @edit-name="onEditName"
                  @thumb-click="onThumbClick"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn
              v-if="materialType !== 'article'"
              label="大小"
              width="100"
            >
              <template #default="{ row }">
                {{ sizeText(row as MaterialListItem) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              :label="COL_STATUS_LABEL[materialType]"
              width="110"
            >
              <template #default="{ row }">
                <span
                  class="status-dot"
                  :class="
                    isMaterialSelectable(row as MaterialListItem) ? 'is-ok' : 'is-off'
                  "
                >
                  {{ materialAvailabilityLabel(row as MaterialListItem) }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="uploadedTime"
              label="上传时间"
              width="170"
            />
            <ElTableColumn
              label="上传人"
              width="100"
            >
              <template #default="{ row }">
                {{ displayOrDash((row as MaterialListItem).uploaderName) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="所在部门"
              width="140"
            >
              <template #default="{ row }">
                {{ displayOrDash((row as MaterialListItem).departmentName) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="AI审核状态"
              width="120"
            >
              <template #default="{ row }">
                <ElTag
                  size="small"
                  :type="auditTagType(normalizeAudit((row as MaterialListItem).aiAuditStatus))"
                  effect="light"
                >
                  {{ auditLabel(normalizeAudit((row as MaterialListItem).aiAuditStatus)) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="风控合规审核"
              width="130"
            >
              <template #default="{ row }">
                <ElTag
                  size="small"
                  :type="auditTagType(normalizeAudit((row as MaterialListItem).riskAuditStatus))"
                  effect="light"
                >
                  {{ auditLabel(normalizeAudit((row as MaterialListItem).riskAuditStatus)) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="操作"
              width="120"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="op-row">
                  <button
                    type="button"
                    class="op-link"
                    @click="openAuditRecords(row as MaterialListItem)"
                  >
                    审核记录
                  </button>
                  <ElDropdown
                    trigger="click"
                    @command="(cmd: string) => onMoreCommand(cmd, row as MaterialListItem)"
                  >
                    <button
                      type="button"
                      class="op-more"
                    >
                      ···
                    </button>
                    <template #dropdown>
                      <ElDropdownMenu>
                        <ElDropdownItem command="move">
                          移动
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="materialType === 'image'"
                          command="crop"
                          :disabled="isMaterialAuditPending(row as MaterialListItem)"
                        >
                          裁剪
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="materialType === 'image' || materialType === 'video' || materialType === 'document'"
                          command="download"
                        >
                          下载
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="materialType === 'article'"
                          command="edit"
                          :disabled="isMaterialAuditPending(row as MaterialListItem)"
                        >
                          编辑
                        </ElDropdownItem>
                        <ElDropdownItem command="ai">
                          {{
                            normalizeAudit((row as MaterialListItem).aiAuditStatus) ===
                            MaterialAudit.PASSED
                              ? "AI审核驳回"
                              : "AI审核通过"
                          }}
                        </ElDropdownItem>
                        <ElDropdownItem command="risk">
                          {{
                            normalizeAudit((row as MaterialListItem).riskAuditStatus) ===
                            MaterialAudit.PASSED
                              ? "风控合规驳回"
                              : "风控合规通过"
                          }}
                        </ElDropdownItem>
                      </ElDropdownMenu>
                    </template>
                  </ElDropdown>
                </div>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="pager">
          <ElPagination
            :current-page="page"
            :page-size="pageSize"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            :page-sizes="[10, 20, 50]"
            @current-change="onPageChange"
            @size-change="onPageSizeChange"
          />
        </div>
      </section>
    </div>

    <MaterialUploadDialog
      v-model="uploadVisible"
      :material-type="asFileMaterialType(materialType)"
      :groups="uploadGroups"
      :default-group-id="activeGroupId"
      @confirm="onUploadConfirm"
    />

    <ImagePreview
      v-model="imageViewerVisible"
      :items="imagePreviewItems"
      :initial-index="imageViewerIndex"
    />

    <MaterialVideoPreviewDialog
      v-model="videoPreviewVisible"
      :url="videoPreviewUrl"
      :title="videoPreviewTitle"
    />

    <MaterialAuditRecordsDrawer
      v-model="auditDrawerVisible"
      :material-id="auditDrawerId"
      :title="auditDrawerTitle"
      :cover-url="auditDrawerCover || undefined"
    />

    <ElDialog
      v-model="moveVisible"
      title="移动到分组"
      width="420px"
      align-center
      append-to-body
    >
      <ElSelect
        v-model="moveTargetId"
        placeholder="请选择分组"
        style="width: 100%"
      >
        <ElOption
          v-for="g in moveOptions"
          :key="g.id"
          :label="g.name"
          :value="g.id"
        />
      </ElSelect>
      <template #footer>
        <ElButton @click="moveVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="moveSaving"
          @click="confirmMove"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ImageCropDialog
      v-model:visible="cropVisible"
      :src="cropSrc"
      aspect-selectable
      @confirm="onCropConfirm"
    />
  </div>
</template>

<style scoped>
.material-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}

.page-crumb {
  flex: none;
  font-size: 13px;
  color: var(--color-text);
}

.crumb-muted,
.crumb-sep {
  color: var(--color-text-placeholder);
}

.crumb-sep {
  margin: 0 6px;
}

.type-tabs {
  display: flex;
  flex: none;
  gap: 4px;
  border-bottom: 1px solid var(--color-border-light);
}

.type-tab {
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 10px 16px;
  background: transparent;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.type-tab:hover {
  color: var(--color-primary);
}

.type-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}

.material-body {
  display: flex;
  flex: 1;
  gap: 0;
  min-height: 0;
  background: var(--color-bg-card);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.list-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.material-table {
  width: 100%;
  height: 100%;
}

.material-table :deep(.el-table__cell) {
  border-right: none !important;
}

.material-table :deep(.el-table--border::after),
.material-table :deep(.el-table--border::before),
.material-table :deep(.el-table__border-left-patch),
.material-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.filter-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.status-dot::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-disabled);
}

.status-dot.is-ok::before {
  background: var(--color-success);
}

.op-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.op-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  line-height: 1.3;
}

.op-link:hover {
  color: var(--color-primary-hover);
}

.op-more {
  border: 0;
  background: transparent;
  padding: 0 4px;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.op-more:hover {
  color: var(--color-primary);
}

.article-title {
  display: block;
  overflow: hidden;
  font-size: 13px;
  color: var(--color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pager {
  display: flex;
  flex: none;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 2px;
}
</style>
