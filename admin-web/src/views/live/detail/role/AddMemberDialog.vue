<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog, ElIcon, ElInput, ElMessage, ElTree } from "element-plus";
import { Folder, Search } from "@element-plus/icons-vue";
import { fetchDeptTree, fetchOrgEmployees, type DeptTreeNode, type OrgEmployeeItem } from "@/api/org";
import UiButton from "@/components/ui/UiButton.vue";
import MemberAvatar from "./MemberAvatar.vue";
import {
  createRoomMember,
  ROLE_META,
  type LiveRoomMember,
  type LiveRoomRole,
} from "./roleTypes";

interface PickedPerson {
  id: number;
  userName: string;
  departmentName: string;
}

const props = defineProps<{
  modelValue: boolean;
  role: LiveRoomRole;
  /** 打开弹窗时，该角色已选的人 */
  selected: LiveRoomMember[];
  /** 抽屉里的全部草稿，用来提示已担任其他角色 */
  allMembers: LiveRoomMember[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [members: LiveRoomMember[]];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const meta = computed(() => ROLE_META[props.role]);
const treeLoading = ref(false);
const treeData = ref<DeptTreeNode[]>([]);
const currentDeptId = ref<number | undefined>(undefined);
const keyword = ref("");
const searching = ref(false);
const empLoading = ref(false);
const employees = ref<OrgEmployeeItem[]>([]);
const employeeTotal = ref(0);
const picked = ref<PickedPerson[]>([]);
let searchTimer = 0;
let empSeq = 0;

const otherRoleById = computed(() => {
  const map = new Map<number, LiveRoomRole>();
  for (const member of props.allMembers) {
    if (member.role !== props.role) map.set(member.id, member.role);
  }
  return map;
});

function isPicked(id: number) {
  return picked.value.some((item) => item.id === id);
}

function toPicked(emp: { id: number; userName: string; departmentName?: string }): PickedPerson {
  return {
    id: emp.id,
    userName: emp.userName,
    departmentName: emp.departmentName?.trim() ?? "",
  };
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    keyword.value = "";
    searching.value = false;
    employees.value = [];
    employeeTotal.value = 0;
    currentDeptId.value = undefined;
    picked.value = props.selected.map((member) => toPicked(member));
    if (!treeData.value.length) void loadTree();
  },
);

watch(keyword, (value) => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    void runSearch(value);
  }, 300);
});

async function loadTree() {
  treeLoading.value = true;
  try {
    treeData.value = await fetchDeptTree();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载组织架构失败");
  } finally {
    treeLoading.value = false;
  }
}

async function loadEmployees(params: { deptId?: number; userName?: string }) {
  const seq = ++empSeq;
  empLoading.value = true;
  try {
    const data = await fetchOrgEmployees({
      deptId: params.deptId,
      userName: params.userName,
      page: 1,
      pageSize: 100,
    });
    if (seq !== empSeq) return;
    employees.value = data.list;
    employeeTotal.value = data.total;
  } catch (e) {
    if (seq !== empSeq) return;
    employees.value = [];
    employeeTotal.value = 0;
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
  } finally {
    if (seq === empSeq) empLoading.value = false;
  }
}

async function runSearch(raw: string) {
  const text = raw.trim();
  if (!text) {
    searching.value = false;
    if (currentDeptId.value != null) {
      await loadEmployees({ deptId: currentDeptId.value });
    } else {
      employees.value = [];
      employeeTotal.value = 0;
    }
    return;
  }
  searching.value = true;
  await loadEmployees({ userName: text });
}

function onDeptClick(data: DeptTreeNode) {
  if (searching.value) return;
  currentDeptId.value = data.id;
  void loadEmployees({ deptId: data.id });
}

function onCheck(emp: OrgEmployeeItem, event: Event) {
  const checked = event.target instanceof HTMLInputElement && event.target.checked;
  toggle(emp, checked);
}

function toggle(emp: OrgEmployeeItem, checked: boolean) {
  if (checked) {
    if (!isPicked(emp.id)) picked.value = [...picked.value, toPicked(emp)];
    return;
  }
  picked.value = picked.value.filter((item) => item.id !== emp.id);
}

function removePicked(id: number) {
  picked.value = picked.value.filter((item) => item.id !== id);
}

function clearPicked() {
  picked.value = [];
}

function onConfirm() {
  const previous = new Map(props.allMembers.map((member) => [member.id, member]));
  const members = picked.value.map((person) => {
    const old = previous.get(person.id);
    if (!old) return createRoomMember(person, props.role);
    return {
      ...old,
      userName: person.userName,
      departmentName: person.departmentName || old.departmentName,
      role: props.role,
      tag: old.role === props.role ? old.tag : ROLE_META[props.role].defaultTag,
    };
  });
  emit("confirm", members);
  visible.value = false;
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="`添加${meta.label}`"
    width="780px"
    align-center
    append-to-body
    destroy-on-close
    class="add-member-dialog"
  >
    <div class="picker">
      <p class="perm">
        角色权限：{{ meta.description }}
      </p>
      <div class="panes">
        <section class="pane pane-left">
          <div class="search">
            <ElInput
              v-model="keyword"
              clearable
              placeholder="请输入员工姓名"
            >
              <template
                v-if="!keyword"
                #suffix
              >
                <ElIcon class="search-icon">
                  <Search />
                </ElIcon>
              </template>
            </ElInput>
          </div>
          <div
            v-loading="treeLoading || empLoading"
            class="scroll"
          >
            <ElTree
              v-show="!searching"
              class="dept-tree"
              :data="treeData"
              node-key="id"
              highlight-current
              default-expand-all
              :expand-on-click-node="false"
              :props="{ label: 'name', children: 'children' }"
              @node-click="onDeptClick"
            >
              <template #default="{ data }">
                <span class="tree-label">
                  <ElIcon class="folder">
                    <Folder />
                  </ElIcon>
                  {{ data.name }}
                </span>
              </template>
            </ElTree>
            <div
              v-if="searching || currentDeptId != null"
              class="emp-pane"
              :class="{ 'is-search': searching }"
            >
              <p class="list-title">
                {{ searching ? "搜索结果" : "部门成员" }}
              </p>
              <ul class="emp-list">
                <li
                  v-if="!employees.length && !empLoading"
                  class="emp-empty"
                >
                  {{ searching ? "没有匹配的员工" : "该部门暂无员工" }}
                </li>
                <li
                  v-for="emp in employees"
                  :key="emp.id"
                >
                  <label class="emp-row">
                    <input
                      type="checkbox"
                      :checked="isPicked(emp.id)"
                      @change="onCheck(emp, $event)"
                    >
                    <MemberAvatar
                      :name="emp.userName"
                      :size="24"
                    />
                    <span class="emp-name">{{ emp.userName }}</span>
                    <span
                      v-if="emp.departmentName"
                      class="emp-dept"
                    >{{ emp.departmentName }}</span>
                    <span
                      v-if="otherRoleById.get(emp.id)"
                      class="emp-role"
                    >已是{{ ROLE_META[otherRoleById.get(emp.id)!].label }}</span>
                  </label>
                </li>
              </ul>
              <p
                v-if="employeeTotal > employees.length"
                class="more"
              >
                仅显示前 {{ employees.length }} 人，请用姓名继续缩小范围
              </p>
            </div>
          </div>
        </section>
        <section class="pane pane-right">
          <div class="right-head">
            <span>选择需要添加的人</span>
            <button
              type="button"
              class="clear-btn"
              :disabled="!picked.length"
              @click="clearPicked"
            >
              清空
            </button>
          </div>
          <ul class="picked">
            <li
              v-for="person in picked"
              :key="person.id"
              class="picked-row"
            >
              <MemberAvatar
                :name="person.userName"
                :size="28"
              />
              <span class="picked-text">
                <span class="picked-name">{{ person.userName }}</span>
                <span
                  v-if="person.departmentName"
                  class="picked-dept"
                >{{ person.departmentName }}</span>
              </span>
              <button
                type="button"
                class="remove"
                aria-label="移除"
                @click="removePicked(person.id)"
              >
                ×
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <UiButton
          variant="default"
          @click="visible = false"
        >
          取消
        </UiButton>
        <UiButton
          variant="primary"
          @click="onConfirm"
        >
          确认
        </UiButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.perm {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.panes {
  display: flex;
  height: 420px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}
.pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pane-left {
  flex: 1;
}
.pane-right {
  flex: none;
  width: 260px;
  border-left: 1px solid var(--color-border);
}
.search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-light);
}
.search-icon {
  color: var(--color-text-placeholder);
}
.scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dept-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 4px;
}
.emp-pane {
  flex: none;
  height: 168px;
  overflow: auto;
  border-top: 1px solid var(--color-border-light);
}
.emp-pane.is-search {
  flex: 1;
  height: auto;
}
.tree-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.folder {
  color: var(--color-primary);
}
.list-title {
  margin: 8px 12px 4px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.emp-list {
  margin: 0;
  padding: 0 8px;
  list-style: none;
}
.emp-empty,
.more {
  margin: 8px 12px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.emp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.emp-row:hover {
  background: var(--color-primary-bg);
}
.emp-row input {
  margin: 0;
  accent-color: var(--color-primary);
}
.emp-name {
  color: var(--color-text);
}
.emp-dept,
.emp-role {
  color: var(--color-text-placeholder);
  font-size: 12px;
}
.right-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 13px;
  color: var(--color-text);
}
.clear-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}
.clear-btn:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
.picked {
  flex: 1;
  margin: 0;
  padding: 8px;
  list-style: none;
  overflow: auto;
}
.picked-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
}
.picked-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.picked-name {
  font-size: 13px;
  color: var(--color-text);
}
.picked-dept {
  font-size: 12px;
  color: var(--color-text-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.remove {
  border: 0;
  background: transparent;
  color: var(--color-text-placeholder);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.remove:hover {
  color: var(--color-danger);
}
</style>
