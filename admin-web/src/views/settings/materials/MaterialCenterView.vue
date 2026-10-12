<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ElInput,
  ElSelect,
  ElOption,
  ElButton,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElTag,
} from "element-plus";
import { RefreshRight, EditPen } from "@element-plus/icons-vue";
import MaterialUploadDialog from "./MaterialUploadDialog.vue";
import MaterialGroupSidebar from "./MaterialGroupSidebar.vue";
import {
  AUDIT_OPTIONS,
  COL_ASSET_LABEL,
  COL_STATUS_LABEL,
  MOCK_GROUPS,
  NAME_FILTER_LABEL,
  TYPE_TABS,
  UPLOAD_BTN,
  buildMockDocuments,
  buildMockImages,
  buildMockVideos,
  type AuditStatus,
  type MaterialGroup,
  type MaterialItem,
  type MaterialType,
} from "./mock";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

const materialType = ref<MaterialType>("image");
const groupKeyword = ref("");
const nameKeyword = ref("");
const auditFilter = ref<"" | AuditStatus>("");
const activeGroupId = ref("all");
const uploadVisible = ref(false);

const allItems = reactive<Record<MaterialType, MaterialItem[]>>({
  image: buildMockImages(),
  video: buildMockVideos(),
  document: buildMockDocuments(),
});

const groups = reactive<Record<MaterialType, MaterialGroup[]>>({
  image: MOCK_GROUPS.image.map((g) => ({ ...g })),
  video: MOCK_GROUPS.video.map((g) => ({ ...g })),
  document: MOCK_GROUPS.document.map((g) => ({ ...g })),
});

const page = ref(1);
const pageSize = ref(10);

const currentGroups = computed(() => groups[materialType.value]);

const filteredGroups = computed(() => {
  const kw = groupKeyword.value.trim();
  if (!kw) return currentGroups.value;
  return currentGroups.value.filter((g) => g.id === "all" || g.name.includes(kw));
});

const filteredList = computed(() => {
  let list = allItems[materialType.value];
  if (activeGroupId.value !== "all") {
    list = list.filter((i) => i.groupId === activeGroupId.value);
  }
  const nameKw = nameKeyword.value.trim();
  if (nameKw) list = list.filter((i) => i.name.includes(nameKw));
  if (auditFilter.value) {
    list = list.filter(
      (i) => i.aiAudit === auditFilter.value || i.riskAudit === auditFilter.value,
    );
  }
  return list;
});

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
});

const total = computed(() => filteredList.value.length);

watch(materialType, () => {
  activeGroupId.value = "all";
  nameKeyword.value = "";
  auditFilter.value = "";
  page.value = 1;
});

watch([activeGroupId, nameKeyword, auditFilter, pageSize], () => {
  page.value = 1;
});

function search() {
  page.value = 1;
}

function resetFilter() {
  nameKeyword.value = "";
  auditFilter.value = "";
  page.value = 1;
}

function openUpload() {
  uploadVisible.value = true;
}

function onUploadConfirm(_payload: {
  groupId: string;
  files: File[];
  results: unknown[];
}) {
  // 列表落库后续迭代；本阶段上传结果仅在弹窗内展示
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

function shell(label: string) {
  toast(`「${label}」暂未开放`);
}

function addGroup(name: string) {
  const list = groups[materialType.value];
  const id = `g-${Date.now()}`;
  list.push({ id, name, count: 0 });
  activeGroupId.value = id;
}

function renameGroup(g: MaterialGroup, name: string) {
  g.name = name;
}

function removeGroup(g: MaterialGroup) {
  const list = groups[materialType.value];
  const idx = list.findIndex((x) => x.id === g.id);
  if (idx >= 0) list.splice(idx, 1);
  if (activeGroupId.value === g.id) activeGroupId.value = "all";
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

        <div class="table-wrap">
          <ElTable
            :data="pagedList"
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
                <div class="asset-cell">
                  <div class="thumb">
                    <img
                      v-if="row.thumbUrl"
                      :src="row.thumbUrl"
                      :alt="row.name"
                    >
                    <span v-else>DOC</span>
                  </div>
                  <div class="asset-meta">
                    <div class="asset-name">
                      <span
                        class="name-text"
                        :title="row.name"
                      >{{ row.name }}</span>
                      <button
                        type="button"
                        class="icon-btn"
                        title="编辑名称"
                        @click="shell('编辑名称')"
                      >
                        <el-icon><EditPen /></el-icon>
                      </button>
                    </div>
                    <div class="asset-sub">{{ row.meta }}</div>
                  </div>
                </div>
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
              prop="uploader"
              label="上传人"
              width="100"
            />
            <ElTableColumn
              prop="department"
              label="所在部门"
              width="120"
            />
            <ElTableColumn
              label="AI审核状态"
              width="120"
            >
              <template #default="{ row }">
                <ElTag
                  size="small"
                  :type="auditTagType(row.aiAudit)"
                  effect="light"
                >
                  {{ auditLabel(row.aiAudit) }}
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
                  :type="auditTagType(row.riskAudit)"
                  effect="light"
                >
                  {{ auditLabel(row.riskAudit) }}
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
            v-model:current-page="page"
            v-model:page-size="pageSize"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            :page-sizes="[10, 20, 50]"
          />
        </div>
      </section>
    </div>

    <MaterialUploadDialog
      v-model="uploadVisible"
      :material-type="materialType"
      :groups="currentGroups"
      :default-group-id="activeGroupId"
      @confirm="onUploadConfirm"
    />
  </div>
</template>

<style scoped>
.material-page {
  /* 顶栏 52 + main 上下 padding 40，页面自身不滚动 */
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

/* 只要横线，不要竖线 */
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

.asset-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.thumb {
  flex: none;
  width: 72px;
  height: 40px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);
  font-size: 11px;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-meta {
  min-width: 0;
  flex: 1;
}

.asset-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text);
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  flex: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-placeholder);
  cursor: pointer;
  display: inline-flex;
}

.icon-btn:hover {
  color: var(--color-primary);
}

.asset-sub {
  margin-top: 2px;
  font-size: 12px;
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
