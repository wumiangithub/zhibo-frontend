<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  isMaterialSelectable,
  materialAvailabilityLabel,
  type MaterialListItem,
} from "@/api/materials";
import { useMaterialCenter } from "@/composables/useMaterialCenter";
import MaterialGroupSidebar from "@/views/settings/materials/MaterialGroupSidebar.vue";
import MaterialAssetCell from "@/views/settings/materials/MaterialAssetCell.vue";
import MaterialUploadDialog from "@/views/settings/materials/MaterialUploadDialog.vue";
import ImagePreview from "@/components/ImagePreview.vue";
import MaterialVideoPreviewDialog from "@/views/settings/materials/MaterialVideoPreviewDialog.vue";
import {
  asFileMaterialType,
  COL_ASSET_LABEL,
  COL_STATUS_LABEL,
  NAME_FILTER_LABEL,
  TYPE_TABS,
  UPLOAD_BTN,
  type MaterialType,
} from "@/views/settings/materials/mock";
import type { MaterialRegisterItem } from "@/views/settings/materials/materialUploadTypes";
import { formatUploadSize } from "@/views/settings/materials/materialUploadFormat";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 已选素材 id（用于回显勾选） */
    selectedIds?: string[];
    /** 最多可选 */
    max?: number;
    /** 弹窗标题 */
    title?: string;
    /** 顶部说明 */
    hint?: string;
    /** 允许的素材类型；不传则三类都可 */
    allowedTypes?: MaterialType[];
    /** 打开时默认类型 */
    defaultType?: MaterialType;
  }>(),
  {
    max: 100,
    title: "添加课件资料",
    hint: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  confirm: [items: MaterialListItem[]];
}>();

const router = useRouter();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const max = computed(() => props.max ?? 100);
const allowedTabs = computed(() => {
  const all = TYPE_TABS;
  if (!props.allowedTypes?.length) return all;
  const set = new Set(props.allowedTypes);
  return all.filter((t) => set.has(t.key));
});
const showTypeTabs = computed(() => allowedTabs.value.length > 1);

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
} = useMaterialCenter({ selectableOnly: true });

const picked = ref<MaterialListItem[]>([]);
/**
 * 本弹窗会话内刚登记的素材（含两审未过）。
 * 列表请求带 selectableOnly 时接口不会返回它们，需本地 prepend 以免「上传后消失」。
 */
const sessionNewItems = ref<MaterialListItem[]>([]);
const dialogHint = computed(() => {
  if (props.hint) return props.hint;
  return `从素材中心已登记素材多选绑定，最多 ${max.value} 个；已选 ${picked.value.length}`;
});
const uploadVisible = ref(false);
const tableRef = ref<{
  clearSelection: () => void;
  toggleRowSelection: (row: MaterialListItem, selected?: boolean) => void;
} | null>(null);
const syncingSelection = ref(false);

function matchesPickerFilters(item: MaterialListItem): boolean {
  if (item.type !== materialType.value) return false;
  if (activeGroupId.value !== "all" && item.groupId !== activeGroupId.value) {
    return false;
  }
  const kw = nameKeyword.value.trim();
  if (kw && !item.name.includes(kw)) return false;
  return true;
}

/** 可用列表 ∪ 本会话新上传（未进接口结果的） */
const displayList = computed(() => {
  const api = list.value;
  const apiIds = new Set(api.map((r) => r.id));
  const extras = sessionNewItems.value.filter(
    (item) => matchesPickerFilters(item) && !apiIds.has(item.id),
  );
  return extras.length ? [...extras, ...api] : api;
});

const displayTotal = computed(() => {
  const apiIds = new Set(list.value.map((r) => r.id));
  const extraCount = sessionNewItems.value.filter(
    (item) => matchesPickerFilters(item) && !apiIds.has(item.id),
  ).length;
  return total.value + extraCount;
});

const imageViewerVisible = ref(false);
const imageViewerIndex = ref(0);
const imagePreviewItems = computed(() =>
  displayList.value
    .filter((row) => !!row.url)
    .map((row) => ({ url: row.url as string, name: row.name })),
);

const videoPreviewVisible = ref(false);
const videoPreviewUrl = ref("");
const videoPreviewTitle = ref("");

const TYPE_LABEL: Record<MaterialType, string> = {
  image: "图片",
  video: "视频",
  document: "文档",
};

function stubItem(id: string): MaterialListItem {
  return {
    id,
    name: id,
    type: "document",
    url: "",
    groupId: "",
    objectKey: "",
    status: "available",
    uploadedTime: "",
  };
}

function seedPicked() {
  const ids = props.selectedIds ?? [];
  const prev = new Map(picked.value.map((p) => [p.id, p]));
  picked.value = ids.map((id) => prev.get(id) ?? stubItem(id));
}

function enrichPickedFromList() {
  if (!picked.value.length || !displayList.value.length) return;
  const byId = new Map(displayList.value.map((row) => [row.id, row]));
  picked.value = picked.value.map((p) => byId.get(p.id) ?? p);
}

function rememberSessionUploads(created: MaterialListItem[]) {
  if (!created.length) return;
  const map = new Map(sessionNewItems.value.map((item) => [item.id, item]));
  for (const item of created) {
    map.set(item.id, item);
  }
  sessionNewItems.value = [...map.values()];
}

function isPicked(id: string) {
  return picked.value.some((i) => i.id === id);
}

/** 不可用不可新勾；已选历史不可用仍可选中（便于取消） */
function rowSelectable(row: MaterialListItem) {
  return isMaterialSelectable(row) || isPicked(row.id);
}

function filterSelectableRows(
  rows: MaterialListItem[],
  prevIds: Set<string>,
): MaterialListItem[] {
  return rows.filter((r) => isMaterialSelectable(r) || prevIds.has(r.id));
}

function syncTableSelection() {
  const table = tableRef.value;
  if (!table) return;
  syncingSelection.value = true;
  table.clearSelection();
  for (const row of displayList.value) {
    if (isPicked(row.id)) table.toggleRowSelection(row, true);
  }
  void nextTick(() => {
    syncingSelection.value = false;
  });
}

function onSelectionChange(rows: MaterialListItem[]) {
  if (syncingSelection.value) return;
  const prevIds = new Set(picked.value.map((p) => p.id));
  const allowedRows = filterSelectableRows(rows, prevIds);
  if (allowedRows.length !== rows.length) {
    void nextTick(syncTableSelection);
  }
  if (max.value <= 1) {
    // 单选：以当前页最新勾选为准
    const last = allowedRows[allowedRows.length - 1];
    picked.value = last ? [{ ...last }] : [];
    if (allowedRows.length > 1) void nextTick(syncTableSelection);
    return;
  }
  const pageIds = new Set(displayList.value.map((r) => r.id));
  const kept = picked.value.filter((p) => !pageIds.has(p.id));
  const room = max.value - kept.length;
  if (allowedRows.length > room) {
    ElMessage.warning(`最多选择 ${max.value} 个`);
    const allowed = allowedRows.slice(0, Math.max(0, room)).map((r) => ({ ...r }));
    picked.value = [...kept, ...allowed];
    void nextTick(syncTableSelection);
    return;
  }
  picked.value = [...kept, ...allowedRows.map((r) => ({ ...r }))];
}

function onRowClick(
  row: MaterialListItem,
  column: { type?: string } | null,
  event: Event,
) {
  // 点勾选列本身会触发 selection-change，避免再 toggle 一次
  if (column?.type === "selection") return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("button, a, input, .el-checkbox")) return;
  // 不可用且非已选：禁止点行勾选
  if (!isMaterialSelectable(row) && !isPicked(row.id)) return;
  tableRef.value?.toggleRowSelection(row, !isPicked(row.id));
}

function onConfirm() {
  emit("confirm", [...picked.value]);
  visible.value = false;
}

function openUpload() {
  uploadVisible.value = true;
}

async function onUploadConfirm(payload: {
  groupId: string;
  registerItems: MaterialRegisterItem[];
}) {
  if (!payload.registerItems.length) return;
  const created = await registerAfterUpload(
    payload.groupId,
    payload.registerItems,
  );
  // selectableOnly 刷新后新行不会出现在接口 list；本会话 merge 展示，仍禁选
  rememberSessionUploads(created);
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
    const nextName = String(value).trim();
    await renameMaterialItem(row, nextName);
    // 仅存在于会话 merge 的行不会进 selectableOnly 列表，就地改 stash
    sessionNewItems.value = sessionNewItems.value.map((item) =>
      item.id === row.id ? { ...item, name: nextName } : item,
    );
  } catch {
    /* 取消 */
  }
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

function goMaterialCenter() {
  visible.value = false;
  void router.push("/settings/materials");
}

function resolveOpenType(): MaterialType {
  const allowed = allowedTabs.value.map((t) => t.key);
  const preferred = props.defaultType ?? allowed[0] ?? "document";
  return allowed.includes(preferred) ? preferred : (allowed[0] ?? "document");
}

async function openAndLoad() {
  sessionNewItems.value = [];
  seedPicked();
  groupKeyword.value = "";
  nameKeyword.value = "";
  page.value = 1;
  activeGroupId.value = "all";
  const openType = resolveOpenType();
  if (materialType.value !== openType) {
    // useMaterialCenter 会 watch type 并 refreshAll
    materialType.value = openType;
  } else {
    await refreshAll();
  }
  enrichPickedFromList();
  await nextTick();
  syncTableSelection();
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      sessionNewItems.value = [];
      return;
    }
    void openAndLoad();
  },
);

watch(displayList, () => {
  enrichPickedFromList();
  void nextTick(syncTableSelection);
});
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="960px"
    align-center
    destroy-on-close
    class="mat-picker-dlg"
  >
    <p class="picker-hint">
      {{ dialogHint }}
    </p>

    <div
      v-if="showTypeTabs"
      class="type-tabs"
    >
      <button
        v-for="tab in allowedTabs"
        :key="tab.key"
        type="button"
        class="type-tab"
        :class="{ 'is-active': materialType === tab.key }"
        @click="materialType = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="picker-body">
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
            {{ UPLOAD_BTN[asFileMaterialType(materialType)] }}
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
            <ElButton
              type="primary"
              @click="search"
            >
              查询
            </ElButton>
            <ElButton @click="resetFilter">
              重置
            </ElButton>
          </div>
        </div>

        <div
          v-loading="listLoading"
          class="table-wrap"
        >
          <ElTable
            ref="tableRef"
            :data="displayList"
            row-key="id"
            height="360"
            class="picker-table"
            @selection-change="onSelectionChange"
            @row-click="onRowClick"
          >
            <ElTableColumn
              type="selection"
              width="48"
              reserve-selection
              :selectable="rowSelectable"
            />
            <ElTableColumn
              :label="COL_ASSET_LABEL[materialType]"
              min-width="220"
            >
              <template #default="{ row }">
                <MaterialAssetCell
                  :row="(row as MaterialListItem)"
                  :material-type="asFileMaterialType(materialType)"
                  @edit-name="onEditName"
                  @thumb-click="onThumbClick"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="大小"
              width="100"
            >
              <template #default="{ row }">
                {{
                  typeof (row as MaterialListItem).fileSize === "number"
                    ? formatUploadSize((row as MaterialListItem).fileSize!)
                    : "—"
                }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              label="类型"
              width="72"
            >
              <template #default="{ row }">
                {{ TYPE_LABEL[row.type as MaterialType] ?? row.type }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              :label="COL_STATUS_LABEL[materialType]"
              width="100"
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
              width="160"
            />
            <template #empty>
              <div class="picker-empty">
                暂无素材，可上传或前往素材中心添加
              </div>
            </template>
          </ElTable>
        </div>

        <div class="pager">
          <ElPagination
            :current-page="page"
            :page-size="pageSize"
            :total="displayTotal"
            background
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            @current-change="onPageChange"
            @size-change="onPageSizeChange"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="footer">
        <ElButton
          link
          type="primary"
          @click="goMaterialCenter"
        >
          前往素材中心
        </ElButton>
        <div class="footer-actions">
          <ElButton @click="visible = false">取消</ElButton>
          <ElButton
            type="primary"
            @click="onConfirm"
          >
            确定（{{ picked.length }}）
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>

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
</template>

<style scoped>
.picker-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #999;
}

.type-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.type-tab {
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 8px 14px;
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

.picker-body {
  display: flex;
  gap: 0;
  min-height: 420px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  overflow: hidden;
}

.list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
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

.table-wrap {
  flex: 1;
  min-height: 0;
}

.picker-table {
  width: 100%;
}

.picker-table :deep(.el-table__empty-block) {
  min-height: 280px;
}

.picker-empty {
  padding: 24px 12px;
  font-size: 13px;
  color: var(--color-text-placeholder);
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

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
