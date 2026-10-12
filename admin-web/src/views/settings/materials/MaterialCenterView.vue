<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
} from "element-plus";
import { RefreshRight } from "@element-plus/icons-vue";
import MaterialUploadDialog from "./MaterialUploadDialog.vue";
import MaterialGroupSidebar from "./MaterialGroupSidebar.vue";
import MaterialVideoPreviewDialog from "./MaterialVideoPreviewDialog.vue";
import MaterialImageViewer from "./MaterialImageViewer.vue";
import MaterialAssetCell from "./MaterialAssetCell.vue";
import {
  AUDIT_OPTIONS,
  COL_ASSET_LABEL,
  COL_STATUS_LABEL,
  NAME_FILTER_LABEL,
  TYPE_TABS,
  UPLOAD_BTN,
  type AuditStatus,
} from "./mock";
import type { MaterialListItem } from "@/api/materials";
import type { MaterialRegisterItem } from "./materialUploadTypes";
import { useToast } from "@/composables/useToast";
import { useMaterialCenter } from "@/composables/useMaterialCenter";

const { toast } = useToast();

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
} = useMaterialCenter();

/** 审核筛选本迭代占位（契约无此字段） */
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

function auditLabel(s: AuditStatus) {
  if (s === "passed") return "已通过";
  if (s === "rejected") return "已驳回";
  return "待审核";
}

function auditTagType(s: AuditStatus): "success" | "danger" | "info" {
  if (s === "passed") return "success";
  if (s === "rejected") return "danger";
  return "info";
}

/** 本迭代占位 */
const PLACEHOLDER_AUDIT: AuditStatus = "pending";

function shell(label: string) {
  toast(`「${label}」暂未开放`);
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
        v-for="tab in TYPE_TABS"
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
            @click="openUpload"
          >
            {{ UPLOAD_BTN[materialType] }}
          </ElButton>
          <div class="filters">
            <span class="filter-label">{{ NAME_FILTER_LABEL[materialType] }}</span>
            <ElInput
              v-model="nameKeyword"
              clearable
              placeholder="请输入"
              style="width: 180px"
              @keyup.enter="search"
            />
            <span class="filter-label">审核状态</span>
            <ElSelect
              v-model="auditFilter"
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
                <MaterialAssetCell
                  :row="row"
                  :material-type="materialType"
                  @edit-name="onEditName"
                  @thumb-click="onThumbClick"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn
              :label="COL_STATUS_LABEL[materialType]"
              width="110"
            >
              <template #default="{ row }">
                <span
                  class="status-dot"
                  :class="row.status === 'available' ? 'is-ok' : 'is-off'"
                >
                  {{ row.status === "available" ? "可用" : "不可用" }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="uploadedAt"
              label="上传时间"
              width="170"
            />
            <ElTableColumn
              label="上传人"
              width="100"
            >
              <template #default>—</template>
            </ElTableColumn>
            <ElTableColumn
              label="所在部门"
              width="120"
            >
              <template #default>—</template>
            </ElTableColumn>
            <ElTableColumn
              label="AI审核状态"
              width="120"
            >
              <template #default>
                <ElTag
                  size="small"
                  :type="auditTagType(PLACEHOLDER_AUDIT)"
                  effect="light"
                >
                  {{ auditLabel(PLACEHOLDER_AUDIT) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="风控合规审核"
              width="130"
            >
              <template #default>
                <ElTag
                  size="small"
                  :type="auditTagType(PLACEHOLDER_AUDIT)"
                  effect="light"
                >
                  {{ auditLabel(PLACEHOLDER_AUDIT) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="操作"
              width="100"
              fixed="right"
            >
              <template #default>
                <button
                  type="button"
                  class="op-link"
                  @click="shell('审核记录')"
                >
                  审核记录
                </button>
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
      :material-type="materialType"
      :groups="uploadGroups"
      :default-group-id="activeGroupId"
      @confirm="onUploadConfirm"
    />

    <MaterialImageViewer
      v-model="imageViewerVisible"
      :items="imagePreviewItems"
      :initial-index="imageViewerIndex"
    />

    <MaterialVideoPreviewDialog
      v-model="videoPreviewVisible"
      :url="videoPreviewUrl"
      :title="videoPreviewTitle"
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

.op-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.op-link:hover {
  color: var(--color-primary-hover);
}

.pager {
  display: flex;
  flex: none;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 2px;
}
</style>
