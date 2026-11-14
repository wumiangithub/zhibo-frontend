<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ElCheckbox,
  ElMessage,
  ElMessageBox,
  ElPagination,
} from "element-plus";
import Sortable from "sortablejs";
import {
  batchDeleteQuickSendMessages,
  copyQuickSendMessage,
  createQuickSendGroup,
  createQuickSendMessage,
  deleteQuickSendGroup,
  deleteQuickSendMessage,
  listAllQuickSendMessageIds,
  listQuickSendGroups,
  listQuickSendMessages,
  renameQuickSendGroup,
  reorderQuickSendMessages,
  updateQuickSendMessage,
  type QuickSendGroup,
  type QuickSendMessage,
  type QuickSendPlace,
} from "@/api/quickSend";
import { ApiError } from "@/api/http";
import { splitEmojiText } from "@/views/live-console/room/constants/emoji";
import dragGripIcon from "@/assets/icons/drag-grip.svg?raw";
import QuickSendGroupSidebar from "./quick-send/QuickSendGroupSidebar.vue";
import QuickSendMessageDialog from "./quick-send/QuickSendMessageDialog.vue";

function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

const groupKeyword = ref("");
const apiGroups = ref<QuickSendGroup[]>([]);
const activeGroupId = ref("");
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const listLoading = ref(false);
const list = ref<QuickSendMessage[]>([]);
const selectedIds = ref<string[]>([]);

const dialogVisible = ref(false);
const dialogTitle = ref("添加消息");
const dialogSaving = ref(false);
const dialogInitial = ref("");
/** null=末尾追加；有值=相对插入或编辑 */
const dialogMode = ref<"create" | "edit">("create");
const dialogEditId = ref<string | null>(null);
const dialogAnchorId = ref<string | null>(null);
const dialogPlace = ref<QuickSendPlace | undefined>(undefined);

const tbodyRef = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;
let reordering = false;

const filteredGroups = computed(() => {
  const kw = groupKeyword.value.trim();
  if (!kw) return apiGroups.value;
  return apiGroups.value.filter((g) => g.name.includes(kw));
});

const pageAllSelected = computed(
  () => list.value.length > 0 && list.value.every((r) => selectedIds.value.includes(r.id)),
);

async function loadGroups(preferId?: string) {
  try {
    apiGroups.value = await listQuickSendGroups();
    const prefer =
      preferId && apiGroups.value.some((g) => g.id === preferId)
        ? preferId
        : activeGroupId.value && apiGroups.value.some((g) => g.id === activeGroupId.value)
          ? activeGroupId.value
          : apiGroups.value[0]?.id ?? "";
    if (prefer !== activeGroupId.value) {
      activeGroupId.value = prefer;
    } else if (!prefer) {
      activeGroupId.value = "";
      list.value = [];
      total.value = 0;
    }
  } catch (err: unknown) {
    apiGroups.value = [];
    ElMessage.error(errMsg(err, "加载分组失败"));
  }
}

async function loadList() {
  if (!activeGroupId.value) {
    list.value = [];
    total.value = 0;
    return;
  }
  listLoading.value = true;
  try {
    const data = await listQuickSendMessages({
      groupId: activeGroupId.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = data.list ?? [];
    total.value = data.total ?? 0;
    selectedIds.value = selectedIds.value.filter((id) =>
      list.value.some((r) => r.id === id),
    );
    await nextTick();
    bindSortable();
  } catch (err: unknown) {
    list.value = [];
    total.value = 0;
    ElMessage.error(errMsg(err, "加载消息失败"));
  } finally {
    listLoading.value = false;
  }
}

let switchingGroup = false;

async function refreshAll(preferGroupId?: string) {
  switchingGroup = true;
  try {
    await loadGroups(preferGroupId);
  } finally {
    switchingGroup = false;
  }
  await loadList();
}

watch(activeGroupId, () => {
  if (switchingGroup) return;
  page.value = 1;
  selectedIds.value = [];
  void loadList();
});

function bindSortable() {
  sortable?.destroy();
  sortable = null;
  const el = tbodyRef.value;
  if (!el) return;
  sortable = Sortable.create(el, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: (evt) => {
      void onDragEnd(evt.oldIndex, evt.newIndex);
    },
  });
}

async function onDragEnd(oldIndex?: number, newIndex?: number) {
  if (
    reordering ||
    oldIndex == null ||
    newIndex == null ||
    oldIndex === newIndex ||
    !activeGroupId.value
  ) {
    return;
  }
  reordering = true;
  try {
    const allIds = await listAllQuickSendMessageIds(activeGroupId.value);
    const offset = (page.value - 1) * pageSize.value;
    if (offset + oldIndex >= allIds.length || offset + newIndex >= allIds.length) {
      await loadList();
      return;
    }
    const [moved] = allIds.splice(offset + oldIndex, 1);
    allIds.splice(offset + newIndex, 0, moved);
    await reorderQuickSendMessages(activeGroupId.value, allIds);
    await refreshAll(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "排序失败"));
    await loadList();
  } finally {
    reordering = false;
  }
}

async function onAddGroup(name: string) {
  try {
    const g = await createQuickSendGroup(name);
    ElMessage.success("已新建分组");
    await refreshAll(g.id);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "新建分组失败"));
  }
}

async function onRenameGroup(g: QuickSendGroup, name: string) {
  try {
    await renameQuickSendGroup(g.id, name);
    ElMessage.success("已重命名");
    await loadGroups(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "重命名失败"));
  }
}

async function onRemoveGroup(g: QuickSendGroup) {
  try {
    await deleteQuickSendGroup(g.id);
    ElMessage.success("已删除分组");
    if (activeGroupId.value === g.id) activeGroupId.value = "";
    await refreshAll();
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "删除分组失败"));
  }
}

function openCreate(anchorId?: string, place?: QuickSendPlace) {
  dialogMode.value = "create";
  dialogEditId.value = null;
  dialogAnchorId.value = anchorId ?? null;
  dialogPlace.value = place;
  dialogInitial.value = "";
  dialogTitle.value = "添加消息";
  dialogVisible.value = true;
}

function openEdit(row: QuickSendMessage) {
  dialogMode.value = "edit";
  dialogEditId.value = row.id;
  dialogAnchorId.value = null;
  dialogPlace.value = undefined;
  dialogInitial.value = row.content;
  dialogTitle.value = "编辑消息";
  dialogVisible.value = true;
}

async function onDialogSave(content: string) {
  if (!activeGroupId.value) {
    ElMessage.warning("请先选择分组");
    return;
  }
  dialogSaving.value = true;
  try {
    if (dialogMode.value === "edit" && dialogEditId.value) {
      await updateQuickSendMessage(dialogEditId.value, content);
      ElMessage.success("已保存");
    } else {
      await createQuickSendMessage({
        groupId: activeGroupId.value,
        content,
        anchorId: dialogAnchorId.value ?? undefined,
        place: dialogPlace.value,
      });
      ElMessage.success("已添加");
    }
    dialogVisible.value = false;
    await refreshAll(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "保存失败"));
  } finally {
    dialogSaving.value = false;
  }
}

async function onCopy(row: QuickSendMessage) {
  try {
    await copyQuickSendMessage(row.id);
    ElMessage.success("已复制");
    await refreshAll(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "复制失败"));
  }
}

async function onDeleteOne(row: QuickSendMessage) {
  try {
    await ElMessageBox.confirm("确定删除该消息？", "删除消息", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteQuickSendMessage(row.id);
    ElMessage.success("已删除");
    await refreshAll(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "删除失败"));
  }
}

function toggleSelectPage() {
  if (pageAllSelected.value) {
    const pageIds = new Set(list.value.map((r) => r.id));
    selectedIds.value = selectedIds.value.filter((id) => !pageIds.has(id));
  } else {
    const set = new Set(selectedIds.value);
    for (const r of list.value) set.add(r.id);
    selectedIds.value = [...set];
  }
}

function toggleRow(id: string, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id];
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  }
}

async function onBatchDelete() {
  if (!selectedIds.value.length) {
    ElMessage.warning("请先勾选消息");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.value.length} 条消息？`,
      "批量删除",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    const res = await batchDeleteQuickSendMessages(selectedIds.value);
    ElMessage.success(`已删除 ${res.deleted} 条`);
    selectedIds.value = [];
    await refreshAll(activeGroupId.value);
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "批量删除失败"));
  }
}

function onPageChange(p: number) {
  page.value = p;
  void loadList();
}

function onPageSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  void loadList();
}

onMounted(() => {
  void refreshAll();
});

onBeforeUnmount(() => {
  sortable?.destroy();
  sortable = null;
});
</script>

<template>
  <div class="admin-panel quick-send-page">
    <div class="quick-send-body">
      <QuickSendGroupSidebar
        v-model:keyword="groupKeyword"
        v-model:active-group-id="activeGroupId"
        :groups="filteredGroups"
        @add="onAddGroup"
        @rename="onRenameGroup"
        @remove="onRemoveGroup"
      />

      <section class="list-panel">
        <div class="toolbar">
          <button
            type="button"
            class="admin-btn admin-btn--primary"
            :disabled="!activeGroupId"
            @click="openCreate()"
          >
            添加消息
          </button>
        </div>

        <div class="bulk-bar">
          <button
            type="button"
            class="link-btn"
            :disabled="!list.length"
            @click="toggleSelectPage"
          >
            {{ pageAllSelected ? "取消本页" : "选中本页" }}
          </button>
          <button
            type="button"
            class="link-btn"
            :disabled="!selectedIds.length"
            @click="onBatchDelete"
          >
            批量删除
          </button>
        </div>

        <div
          class="table-wrap hover-scrollbar"
          v-loading="listLoading"
        >
          <table class="msg-table">
            <thead>
              <tr>
                <th class="col-drag" />
                <th class="col-check" />
                <th class="col-content">
                  消息内容
                </th>
                <th class="col-ops">
                  操作
                </th>
              </tr>
            </thead>
            <tbody ref="tbodyRef">
              <tr
                v-for="row in list"
                :key="row.id"
                :data-id="row.id"
              >
                <td class="col-drag">
                  <span
                    class="drag-handle"
                    title="拖拽排序"
                    v-html="dragGripIcon"
                  />
                </td>
                <td class="col-check">
                  <ElCheckbox
                    :model-value="selectedIds.includes(row.id)"
                    @update:model-value="(v) => toggleRow(row.id, !!v)"
                  />
                </td>
                <td class="col-content">
                  <span class="content-text">
                    <template
                      v-for="(seg, i) in splitEmojiText(row.content)"
                      :key="i"
                    >
                      <img
                        v-if="seg.kind === 'emoji'"
                        class="emoji"
                        :src="seg.src"
                        :alt="seg.name"
                      >
                      <span v-else>{{ seg.value }}</span>
                    </template>
                  </span>
                </td>
                <td class="col-ops">
                  <button
                    type="button"
                    class="op-link"
                    @click="openEdit(row)"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    class="op-link"
                    @click="onCopy(row)"
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    class="op-link"
                    @click="openCreate(row.id, 'above')"
                  >
                    在上方添加
                  </button>
                  <button
                    type="button"
                    class="op-link"
                    @click="openCreate(row.id, 'below')"
                  >
                    在下方添加
                  </button>
                  <button
                    type="button"
                    class="op-link"
                    @click="onDeleteOne(row)"
                  >
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="!listLoading && !list.length">
                <td
                  colspan="4"
                  class="empty-cell"
                >
                  暂无消息，点击「添加消息」开始
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pager">
          <ElPagination
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            :page-sizes="[10, 20, 50]"
            @current-change="onPageChange"
            @size-change="onPageSizeChange"
          />
        </div>
      </section>
    </div>

    <QuickSendMessageDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :initial-content="dialogInitial"
      :saving="dialogSaving"
      @save="onDialogSave"
    />
  </div>
</template>

<style scoped>
.quick-send-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.quick-send-body {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  overflow: hidden;
}

.toolbar {
  flex: none;
  margin-bottom: 12px;
}

.bulk-bar {
  flex: none;
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.link-btn:disabled {
  color: var(--color-text-placeholder);
  cursor: not-allowed;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.msg-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.msg-table th,
.msg-table td {
  padding: 12px 8px;
  border-bottom: 1px solid var(--color-border-light);
  text-align: left;
  vertical-align: middle;
}

.msg-table th {
  color: var(--color-text-secondary, #8c8c8c);
  font-weight: 500;
  background: #fafafa;
}

.col-drag {
  width: 36px;
}

.col-check {
  width: 40px;
}

.col-ops {
  width: 320px;
  white-space: nowrap;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-text-placeholder);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle :deep(svg) {
  width: 16px;
  height: 16px;
}

.content-text {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  line-height: 1.5;
  word-break: break-word;
}

.emoji {
  width: 20px;
  height: 20px;
  vertical-align: middle;
}

.op-link {
  margin-right: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.op-link:last-child {
  margin-right: 0;
}

.empty-cell {
  padding: 48px 8px !important;
  text-align: center !important;
  color: var(--color-text-placeholder);
}

.pager {
  flex: none;
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
