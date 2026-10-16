<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTree,
} from "element-plus";
import {
  fetchDeptTree,
  fetchOrgEmployees,
  fetchRoles,
  hqStatusLabel,
  ORG_DEPT_ALL,
  setLiveEnabled,
  type DeptTreeNode,
  type OrgEmployeeItem,
  type RoleListItem,
} from "@/api/org";

const ALL_NODE: DeptTreeNode = {
  id: ORG_DEPT_ALL,
  name: "全部",
  code: "",
  parentId: "0",
  children: [],
};

const treeLoading = ref(false);
const treeData = ref<DeptTreeNode[]>([]);
const treeRef = ref<InstanceType<typeof ElTree>>();
/** 默认「全部」 */
const selectedDeptId = ref(ORG_DEPT_ALL);

const nameKeyword = ref("");
const selectedRoleId = ref<number | undefined>(undefined);
const roles = ref<RoleListItem[]>([]);
const listLoading = ref(false);
const list = ref<OrgEmployeeItem[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

onMounted(() => {
  void loadTree();
  void loadRoles();
});

async function loadRoles() {
  try {
    roles.value = await fetchRoles();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载角色失败");
  }
}

async function loadTree() {
  treeLoading.value = true;
  try {
    const depts = await fetchDeptTree();
    treeData.value = [ALL_NODE, ...depts];
    selectedDeptId.value = ORG_DEPT_ALL;
    await loadList();
    queueMicrotask(() => {
      treeRef.value?.setCurrentKey(ORG_DEPT_ALL);
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载组织架构失败");
  } finally {
    treeLoading.value = false;
  }
}

function onDeptClick(data: DeptTreeNode) {
  selectedDeptId.value = data.id;
  page.value = 1;
  void loadList();
}

async function loadList() {
  listLoading.value = true;
  try {
    const data = await fetchOrgEmployees({
      deptId: selectedDeptId.value,
      userName: nameKeyword.value.trim() || undefined,
      roleId: typeof selectedRoleId.value === "number" ? selectedRoleId.value : undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = data.list;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
  } finally {
    listLoading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void loadList();
}

function onReset() {
  nameKeyword.value = "";
  selectedRoleId.value = undefined;
  page.value = 1;
  void loadList();
}

function hasRole(row: OrgEmployeeItem) {
  return Boolean(row.roleNames);
}

function onAssignRole() {
  ElMessage.info("请在钱坤云CRM主系统操作");
}

async function onToggleLive(row: OrgEmployeeItem) {
  const next = !row.liveEnabled;
  try {
    const data = await setLiveEnabled(row.id, next);
    row.liveEnabled = data.liveEnabled;
    ElMessage.success(next ? "已启用" : "已禁用");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
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
</script>

<template>
  <div class="employee-org">
    <div class="page-head">
      <div class="breadcrumb">设置 / 员工组织 / 员工管理</div>
      <h1 class="title">员工管理</h1>
    </div>

    <div class="body">
      <aside class="tree-panel">
        <div class="panel-title">组织架构</div>
        <div
          v-loading="treeLoading"
          class="tree-scroll"
        >
          <ElTree
            ref="treeRef"
            :data="treeData"
            node-key="id"
            highlight-current
            :current-node-key="selectedDeptId"
            default-expand-all
            :expand-on-click-node="false"
            :props="{ label: 'name', children: 'children' }"
            class="dept-tree"
            @node-click="onDeptClick"
          />
        </div>
      </aside>

      <section class="list-panel">
        <div class="filters">
          <label class="filter-item">
            <span>员工姓名</span>
            <ElInput
              v-model="nameKeyword"
              clearable
              placeholder="请输入"
              class="w-200px"
              @keyup.enter="onSearch"
            />
          </label>
          <label class="filter-item">
            <span>角色</span>
            <ElSelect
              v-model="selectedRoleId"
              clearable
              placeholder="全部角色"
              style="width: 180px"
            >
              <ElOption
                v-for="role in roles"
                :key="role.id"
                :label="role.name"
                :value="role.id"
              />
            </ElSelect>
          </label>
          <ElButton type="primary" @click="onSearch">查询</ElButton>
          <ElButton @click="onReset">重置</ElButton>
        </div>

        <ElTable
          v-loading="listLoading"
          :data="list"
          border
          height="100%"
          class="emp-table"
          empty-text="暂无数据"
        >
          <ElTableColumn prop="userName" label="姓名" min-width="120" />
          <ElTableColumn prop="departmentName" label="所属组织架构" min-width="180" />
          <ElTableColumn label="角色" min-width="140">
            <template #default="{ row }">
              {{ row.roleNames || "--" }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="直播账号状态" min-width="120">
            <template #default="{ row }">
              <span class="status-dot" :class="row.liveEnabled ? 'is-on' : 'is-off'" />
              {{ row.liveEnabled ? "已启用" : "已禁用" }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="总部账号状态" min-width="120">
            <template #default="{ row }">
              {{ hqStatusLabel(row.hqStatus) }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" min-width="220" fixed="right">
            <template #default="{ row }">
              <button type="button" class="link-btn" @click="onAssignRole">
                {{ hasRole(row) ? "更换角色" : "赋予角色" }}
              </button>
              <button type="button" class="link-btn" @click="onToggleLive(row)">
                {{ row.liveEnabled ? "禁用" : "启用" }}
              </button>
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="pager">
          <ElPagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="onPageChange"
            @size-change="onPageSizeChange"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.employee-org {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.page-head {
  flex: none;
}

.breadcrumb {
  color: #8a919f;
  font-size: 12px;
}

.title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}

.body {
  display: flex;
  gap: 16px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.tree-panel {
  width: 280px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
  overflow: hidden;
}

.panel-title {
  flex: none;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.dept-tree {
  background: transparent;
}

.list-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.filters {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4e5969;
  white-space: nowrap;
  flex: none;
}

.emp-table {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.emp-table :deep(.el-table) {
  height: 100%;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot.is-on {
  background: #00b42a;
}

.status-dot.is-off {
  background: #c9cdd4;
}

.link-btn {
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  padding: 0;
  margin-right: 12px;
  font-size: 13px;
}

.link-btn:hover {
  color: #4080ff;
}

.pager {
  flex: none;
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
