<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import { Search } from "@element-plus/icons-vue";
import {
  MATERIAL_AUDIT_LABEL,
  MaterialAudit,
  isMaterialSelectable,
  listMaterials,
  type MaterialAuditStatus,
  type MaterialCenterType,
  type MaterialListItem,
} from "@/api/materials";
import {
  bindCatalogMaterials,
  listCatalogUsedContents,
} from "@/api/course";
import { AUDIT_OPTIONS, CENTER_TYPE_TABS } from "@/views/settings/materials/mock";
import { getMaterialFileIcon } from "@/views/settings/materials/materialFileIcons";
import { getTosPreviewUrl } from "@/utils/fileInfo";

const props = defineProps<{
  courseId: string;
  parentId: number;
  materialType: MaterialCenterType;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [] }>();

const loading = ref(false);
const confirming = ref(false);
const keyword = ref("");
/** 联合审核筛选；默认已通过。空串=全部。走 list `auditStatus`。 */
const auditFilter = ref<"" | MaterialAuditStatus>(MaterialAudit.PASSED);
const list = ref<MaterialListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const selected = ref<MaterialListItem[]>([]);
const usedMaterialIds = ref<Set<string>>(new Set());
const tableRef = ref<InstanceType<typeof ElTable> | null>(null);

const typeLabel = computed(
  () => CENTER_TYPE_TABS.find((t) => t.key === props.materialType)?.label ?? "素材",
);

const dialogTitle = computed(() => `关联已有${typeLabel.value}`);

const nameColumnLabel = computed(() => `${typeLabel.value}名称`);

const selectedIds = computed(() => new Set(selected.value.map((r) => String(r.id))));

function timeText(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

function normalizeAudit(status?: MaterialAuditStatus): MaterialAuditStatus {
  if (
    status === MaterialAudit.PASSED
    || status === MaterialAudit.REJECTED
    || status === MaterialAudit.PENDING
  ) {
    return status;
  }
  return MaterialAudit.PENDING;
}

function auditLabel(status?: MaterialAuditStatus) {
  return MATERIAL_AUDIT_LABEL[normalizeAudit(status)];
}

function auditTagType(status?: MaterialAuditStatus): "success" | "danger" | "warning" {
  const s = normalizeAudit(status);
  if (s === MaterialAudit.PASSED) return "success";
  if (s === MaterialAudit.REJECTED) return "danger";
  return "warning";
}

function thumbSrc(row: MaterialListItem) {
  if (props.materialType === "document" || props.materialType === "article") {
    return getMaterialFileIcon(row.name || (props.materialType === "article" ? "a.txt" : "a.pdf"));
  }
  const base = row.thumbUrl || row.url;
  if (!base) return "";
  return getTosPreviewUrl(base, 160, 90);
}

function isUsed(row: MaterialListItem) {
  return usedMaterialIds.value.has(String(row.id));
}

function auditPassed(row: MaterialListItem) {
  return isMaterialSelectable(row);
}

function selectable(row: MaterialListItem) {
  return auditPassed(row) && !isUsed(row);
}

function rowClassName({ row }: { row: MaterialListItem }) {
  return selectable(row) ? "" : "is-row-disabled";
}

async function loadUsed() {
  try {
    const data = await listCatalogUsedContents(props.courseId);
    usedMaterialIds.value = new Set((data.materials ?? []).map(String));
  } catch {
    usedMaterialIds.value = new Set();
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const data = await listMaterials({
      type: props.materialType,
      page: page.value,
      pageSize: pageSize.value,
      ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
      ...(typeof auditFilter.value === "number" ? { auditStatus: auditFilter.value } : {}),
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : `加载${typeLabel.value}失败`);
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onAuditFilterChange() {
  page.value = 1;
  selected.value = [];
  void fetchList();
}

function onSelectionChange(rows: MaterialListItem[]) {
  const pageIds = new Set(list.value.map((r) => String(r.id)));
  const kept = selected.value.filter((r) => !pageIds.has(String(r.id)));
  const next = [...kept, ...rows.filter((r) => selectable(r))];
  const map = new Map(next.map((r) => [String(r.id), r]));
  selected.value = [...map.values()];
}

function onPageChange(p: number) {
  page.value = p;
  void fetchList();
}

function onPageSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  void fetchList();
}

async function onConfirm() {
  if (!selected.value.length) {
    ElMessage.warning(`请选择${typeLabel.value}`);
    return;
  }
  confirming.value = true;
  try {
    await bindCatalogMaterials(props.courseId, {
      parentId: props.parentId,
      materialIds: selected.value.map((r) => String(r.id)),
    });
    ElMessage.success(`已关联${typeLabel.value}小节`);
    visible.value = false;
    emit("confirmed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "关联失败");
  } finally {
    confirming.value = false;
  }
}

function resetFilters() {
  keyword.value = "";
  auditFilter.value = MaterialAudit.PASSED;
  page.value = 1;
  selected.value = [];
}

watch(visible, (open) => {
  if (!open) return;
  resetFilters();
  void loadUsed().then(() => fetchList());
});

watch(
  () => props.materialType,
  () => {
    if (!visible.value) return;
    resetFilters();
    void fetchList();
  },
);

watch(list, () => {
  const restore = list.value.filter((r) => selectedIds.value.has(String(r.id)) && selectable(r));
  if (restore.length) {
    requestAnimationFrame(() => {
      restore.forEach((row) => tableRef.value?.toggleRowSelection(row, true));
    });
  }
});
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="dialogTitle"
    width="920px"
    append-to-body
    destroy-on-close
    class="associate-material-dialog"
  >
    <div class="toolbar">
      <span class="toolbar-label">{{ nameColumnLabel }}</span>
      <ElInput
        v-model="keyword"
        clearable
        :placeholder="`请输入${typeLabel}名称`"
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #append>
          <ElButton
            :icon="Search"
            @click="onSearch"
          />
        </template>
      </ElInput>
      <span class="toolbar-label">审核状态</span>
      <ElSelect
        v-model="auditFilter"
        placeholder="全部状态"
        style="width: 140px"
        @change="onAuditFilterChange"
      >
        <ElOption
          v-for="opt in AUDIT_OPTIONS"
          :key="String(opt.value)"
          :label="opt.label"
          :value="opt.value"
        />
      </ElSelect>
    </div>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="list"
      row-key="id"
      height="420"
      :empty-text="`暂无${typeLabel}`"
      :row-class-name="rowClassName"
      @selection-change="onSelectionChange"
    >
      <ElTableColumn
        type="selection"
        width="48"
        :selectable="selectable"
      />
      <ElTableColumn
        :label="nameColumnLabel"
        min-width="320"
      >
        <template #default="{ row }">
          <div
            class="name-cell"
            :class="{ 'is-disabled': !selectable(row) }"
          >
            <div
              class="thumb"
              :class="{ 'is-icon': materialType === 'document' || materialType === 'article' }"
            >
              <img
                v-if="thumbSrc(row)"
                :src="thumbSrc(row)"
                alt=""
              >
              <span v-else>封面</span>
            </div>
            <div class="name-meta">
              <p
                class="title"
                :title="row.name"
              >
                {{ row.name }}
              </p>
              <p
                v-if="isUsed(row)"
                class="hint hint--used"
              >
                已关联本课程
              </p>
              <p
                v-else-if="!auditPassed(row)"
                class="hint hint--audit"
              >
                审核未通过，不可关联
              </p>
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="上传时间"
        width="180"
      >
        <template #default="{ row }">
          {{ timeText(row.uploadedTime) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="风控合规审核"
        width="130"
      >
        <template #default="{ row }">
          <ElTag
            size="small"
            :type="auditTagType(row.riskAuditStatus)"
            effect="light"
          >
            {{ auditLabel(row.riskAuditStatus) }}
          </ElTag>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <span>共 {{ total }} 条</span>
      <ElPagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        background
        layout="sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="confirming"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.toolbar-label {
  font-size: 13px;
  color: #666;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.name-cell.is-disabled {
  opacity: 0.55;
}
.thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 12px;
}
.thumb.is-icon {
  width: 40px;
  height: 40px;
  background: transparent;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb.is-icon img {
  object-fit: contain;
}
.name-meta {
  min-width: 0;
}
.title {
  margin: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint {
  margin: 2px 0 0;
  font-size: 12px;
}
.hint--used {
  color: #fa8c16;
}
.hint--audit {
  color: #f56c6c;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
  color: #666;
}
</style>

<style>
.associate-material-dialog .el-table .is-row-disabled {
  color: #a8abb2;
}
.associate-material-dialog .el-table .is-row-disabled .el-checkbox {
  cursor: not-allowed;
}
</style>
