<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { Search } from "@element-plus/icons-vue";
import { listViewerTags, type ViewerTagItem } from "@/api/viewerTag";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 已选标签（回显） */
    selectedTags?: Array<Pick<ViewerTagItem, "id" | "name" | "userCount">>;
    /** 最多可选 */
    max?: number;
    title?: string;
  }>(),
  {
    selectedTags: () => [],
    max: 5,
    title: "选择用户标签",
  },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  confirm: [items: ViewerTagItem[]];
}>();

const router = useRouter();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const draftKeyword = ref("");
const nameKeyword = ref("");
const loading = ref(false);
const list = ref<ViewerTagItem[]>([]);
const picked = ref<ViewerTagItem[]>([]);
const tableRef = ref<{
  clearSelection: () => void;
  toggleRowSelection: (row: ViewerTagItem, selected?: boolean) => void;
} | null>(null);
const syncingSelection = ref(false);

const pickCountText = computed(() => `(${picked.value.length} / ${props.max})`);

async function fetchList() {
  loading.value = true;
  try {
    const kw = nameKeyword.value.trim();
    const res = await listViewerTags({
      page: 1,
      pageSize: 100,
      name: kw || undefined,
    });
    list.value = res.list ?? [];
    await nextTick();
    syncTableSelection();
  } catch (e) {
    list.value = [];
    ElMessage.error(e instanceof Error ? e.message : "加载标签失败");
  } finally {
    loading.value = false;
  }
}

function syncTableSelection() {
  const table = tableRef.value;
  if (!table) return;
  syncingSelection.value = true;
  table.clearSelection();
  const idSet = new Set(picked.value.map((t) => t.id));
  for (const row of list.value) {
    if (idSet.has(row.id)) {
      table.toggleRowSelection(row, true);
    }
  }
  syncingSelection.value = false;
}

function onSelectionChange(rows: ViewerTagItem[]) {
  if (syncingSelection.value) return;
  const pageIds = new Set(list.value.map((t) => t.id));
  const kept = picked.value.filter((t) => !pageIds.has(t.id));
  const merged = [...kept];
  for (const row of rows) {
    if (!merged.some((t) => t.id === row.id)) merged.push(row);
  }
  if (merged.length > props.max) {
    ElMessage.warning(`最多选择 ${props.max} 个标签`);
    picked.value = merged.slice(0, props.max);
    void nextTick(() => syncTableSelection());
    return;
  }
  picked.value = merged;
}

function onSearch() {
  nameKeyword.value = draftKeyword.value.trim();
  void fetchList();
}

function onRefresh() {
  void fetchList();
}

function onCreateTag() {
  const href = router.resolve({ name: "user-tags-create" }).href;
  window.open(href, "_blank", "noopener");
}

function onConfirm() {
  emit("confirm", [...picked.value]);
  visible.value = false;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    draftKeyword.value = "";
    nameKeyword.value = "";
    picked.value = (props.selectedTags ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      type: 1,
      userCount: t.userCount ?? 0,
      groupId: 0,
      groupName: "",
      createdTime: "",
    }));
    void fetchList();
  },
);
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="640px"
    destroy-on-close
    append-to-body
    class="viewer-tag-picker-dialog"
  >
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="onCreateTag"
      >
        新建用户标签
      </ElButton>
      <button
        type="button"
        class="link-btn"
        @click="onRefresh"
      >
        刷新
      </button>
      <ElInput
        v-model="draftKeyword"
        clearable
        placeholder="请输入标签名称"
        class="search-input"
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
    </div>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="list"
      row-key="id"
      max-height="360"
      empty-text="暂无标签"
      class="hover-scrollbar"
      @selection-change="onSelectionChange"
    >
      <ElTableColumn
        type="selection"
        width="48"
        :reserve-selection="true"
      />
      <ElTableColumn
        prop="name"
        label="标签名称"
        min-width="200"
        show-overflow-tooltip
      />
      <ElTableColumn
        label="包含人数 (人)"
        width="130"
        align="right"
      >
        <template #default="{ row }">{{ row.userCount ?? 0 }}</template>
      </ElTableColumn>
    </ElTable>

    <template #footer>
      <div class="footer-row">
        <span class="pick-count">{{ pickCountText }}</span>
        <div class="footer-actions">
          <ElButton @click="visible = false">取消</ElButton>
          <ElButton
            type="primary"
            @click="onConfirm"
          >
            确认
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.link-btn {
  border: 0;
  background: transparent;
  color: var(--color-primary, #2f54eb);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.search-input {
  margin-left: auto;
  width: 240px;
}
.footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  width: 100%;
}
.pick-count {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
}
.footer-actions {
  display: inline-flex;
  gap: 8px;
}
</style>
