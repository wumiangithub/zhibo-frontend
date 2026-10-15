import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  createMaterialGroup,
  createMaterials,
  deleteMaterialGroup,
  listMaterialGroups,
  listMaterials,
  renameMaterial,
  renameMaterialGroup,
  updateMaterialAiAudit,
  updateMaterialRiskAudit,
  type CreateMaterialItem,
  type MaterialGroup,
  type MaterialListItem,
  type MaterialType,
} from "@/api/materials";
import { ALL_GROUP_LABEL } from "@/views/settings/materials/mock";
import { ApiError } from "@/api/http";

function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

export type UseMaterialCenterOptions = {
  /**
   * true：列表请求带 `selectableOnly=true`（封面/课件选择弹窗）。
   * 默认 false：素材中心主列表不带该参数。
   */
  selectableOnly?: boolean;
};

export function useMaterialCenter(options: UseMaterialCenterOptions = {}) {
  const selectableOnly = options.selectableOnly === true;
  const materialType = ref<MaterialType>("image");
  const groupKeyword = ref("");
  const nameKeyword = ref("");
  const activeGroupId = ref("all");
  const page = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const listLoading = ref(false);
  const groupsLoading = ref(false);

  const apiGroups = ref<MaterialGroup[]>([]);
  const list = ref<MaterialListItem[]>([]);

  const groupsWithAll = computed<MaterialGroup[]>(() => {
    const sum = apiGroups.value.reduce((n, g) => n + (g.count || 0), 0);
    return [
      {
        id: "all",
        name: ALL_GROUP_LABEL[materialType.value],
        count: sum,
        isDefault: false,
      },
      ...apiGroups.value,
    ];
  });

  const filteredGroups = computed(() => {
    const kw = groupKeyword.value.trim();
    if (!kw) return groupsWithAll.value;
    return groupsWithAll.value.filter((g) => g.id === "all" || g.name.includes(kw));
  });

  /** 上传弹窗用：真实分组（不含 all） */
  const uploadGroups = computed(() => groupsWithAll.value);

  async function loadGroups() {
    groupsLoading.value = true;
    try {
      apiGroups.value = await listMaterialGroups(materialType.value);
      if (
        activeGroupId.value !== "all" &&
        !apiGroups.value.some((g) => g.id === activeGroupId.value)
      ) {
        activeGroupId.value = "all";
      }
    } catch (err: unknown) {
      apiGroups.value = [];
      ElMessage.error(errMsg(err, "加载分组失败"));
    } finally {
      groupsLoading.value = false;
    }
  }

  async function loadList() {
    listLoading.value = true;
    try {
      const data = await listMaterials({
        type: materialType.value,
        groupId: activeGroupId.value === "all" ? undefined : activeGroupId.value,
        keyword: nameKeyword.value.trim() || undefined,
        selectableOnly: selectableOnly || undefined,
        page: page.value,
        pageSize: pageSize.value,
      });
      list.value = data.list ?? [];
      total.value = data.total ?? 0;
      if (typeof data.page === "number" && data.page !== page.value) {
        page.value = data.page;
      }
    } catch (err: unknown) {
      list.value = [];
      total.value = 0;
      ElMessage.error(errMsg(err, "加载素材列表失败"));
    } finally {
      listLoading.value = false;
    }
  }

  async function refreshAll() {
    await loadGroups();
    await loadList();
  }

  let switchingType = false;

  watch(materialType, () => {
    switchingType = true;
    activeGroupId.value = "all";
    nameKeyword.value = "";
    page.value = 1;
    void refreshAll().finally(() => {
      switchingType = false;
    });
  });

  watch(activeGroupId, () => {
    if (switchingType) return;
    page.value = 1;
    void loadList();
  });

  function search() {
    page.value = 1;
    void loadList();
  }

  function resetFilter() {
    nameKeyword.value = "";
    page.value = 1;
    void loadList();
  }

  function onPageChange(p: number) {
    page.value = p;
    void loadList();
  }

  function onPageSizeChange(size: number) {
    pageSize.value = size;
    page.value = 1;
    void loadList();
  }

  async function addGroup(name: string) {
    try {
      const g = await createMaterialGroup(materialType.value, name);
      await loadGroups();
      activeGroupId.value = g.id;
      ElMessage.success("已新建分组");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "新建分组失败"));
    }
  }

  async function renameGroup(g: MaterialGroup, name: string) {
    if (g.id === "all") return;
    try {
      await renameMaterialGroup(g.id, name);
      await loadGroups();
      ElMessage.success("已重命名");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "重命名失败"));
    }
  }

  async function removeGroup(g: MaterialGroup) {
    if (g.id === "all" || g.isDefault) return;
    try {
      await deleteMaterialGroup(g.id);
      if (activeGroupId.value === g.id) activeGroupId.value = "all";
      await refreshAll();
      ElMessage.success("已删除分组");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "删除分组失败"));
    }
  }

  /** 登记成功后刷新列表；返回接口 `list`（选择弹窗可 merge 进本会话展示） */
  async function registerAfterUpload(
    groupId: string,
    items: CreateMaterialItem[],
  ): Promise<MaterialListItem[]> {
    if (!items.length) return [];
    try {
      const data = await createMaterials({
        type: materialType.value,
        groupId,
        items,
      });
      await refreshAll();
      return data.list ?? [];
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "素材登记失败"));
      return [];
    }
  }

  /** 只改展示名；成功后就地更新列表行 */
  async function renameMaterialItem(item: MaterialListItem, name: string) {
    const next = name.trim();
    if (!next) {
      ElMessage.warning("名称不能为空");
      return;
    }
    if (next.length > 256) {
      ElMessage.warning("名称不能超过 256 字");
      return;
    }
    if (next === item.name) return;
    try {
      const updated = await renameMaterial(item.id, next);
      patchListItem(item.id, updated);
      ElMessage.success("已修改名称");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "修改名称失败"));
    }
  }

  function patchListItem(id: string, updated: MaterialListItem) {
    const idx = list.value.findIndex((row) => row.id === id);
    if (idx >= 0) {
      list.value[idx] = { ...list.value[idx], ...updated };
    } else {
      void loadList();
    }
  }

  /** passed → 驳回；否则 → 通过 */
  async function toggleAiAudit(item: MaterialListItem) {
    const next = item.aiAuditStatus === "passed" ? "rejected" : "passed";
    try {
      const updated = await updateMaterialAiAudit(item.id, next);
      patchListItem(item.id, updated);
      ElMessage.success(next === "passed" ? "AI 审核已通过" : "AI 审核已驳回");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "更新 AI 审核失败"));
    }
  }

  async function toggleRiskAudit(item: MaterialListItem) {
    const next = item.riskAuditStatus === "passed" ? "rejected" : "passed";
    try {
      const updated = await updateMaterialRiskAudit(item.id, next);
      patchListItem(item.id, updated);
      ElMessage.success(next === "passed" ? "风控合规已通过" : "风控合规已驳回");
    } catch (err: unknown) {
      ElMessage.error(errMsg(err, "更新风控合规失败"));
    }
  }

  return {
    materialType,
    groupKeyword,
    nameKeyword,
    activeGroupId,
    page,
    pageSize,
    total,
    listLoading,
    groupsLoading,
    list,
    filteredGroups,
    uploadGroups,
    loadGroups,
    loadList,
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
  };
}
