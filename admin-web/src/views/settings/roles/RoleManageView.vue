<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { ElButton, ElMessage, ElTree } from "element-plus";
import {
  fetchRoleDetail,
  fetchRoles,
  memberLabel,
  saveRoleMenus,
  type RoleDetail,
  type RoleListItem,
  type RoleMenuNode,
} from "@/api/org";

const roles = ref<RoleListItem[]>([]);
const activeId = ref("");
const detail = ref<RoleDetail | null>(null);
const loading = ref(false);
const saving = ref(false);
const treeRef = ref<InstanceType<typeof ElTree>>();

const memberText = computed(() =>
  (detail.value?.members ?? []).map(memberLabel).join("、"),
);

onMounted(() => {
  void loadRoles();
});

async function loadRoles() {
  loading.value = true;
  try {
    roles.value = await fetchRoles();
    if (roles.value.length && !activeId.value) {
      await selectRole(roles.value[0].id);
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载角色失败");
  } finally {
    loading.value = false;
  }
}

async function selectRole(id: string) {
  activeId.value = id;
  loading.value = true;
  try {
    detail.value = await fetchRoleDetail(id);
    await nextTick();
    treeRef.value?.setCheckedKeys(leafCodes(detail.value.menus, new Set(detail.value.menuCodes)));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载角色详情失败");
  } finally {
    loading.value = false;
  }
}

function leafCodes(nodes: RoleMenuNode[], checked: Set<string>): string[] {
  const codes: string[] = [];
  for (const node of nodes) {
    if (!node.children?.length) {
      if (checked.has(node.code)) codes.push(node.code);
    } else {
      codes.push(...leafCodes(node.children, checked));
    }
  }
  return codes;
}

async function onSave() {
  if (!activeId.value || !treeRef.value) return;
  const menuCodes = treeRef.value.getCheckedKeys(true).map(String);
  saving.value = true;
  try {
    detail.value = await saveRoleMenus(activeId.value, menuCodes);
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="role-page">
    <div class="page-head">
      <div class="breadcrumb">设置 / 员工组织 / 角色管理</div>
      <h1 class="title">角色管理</h1>
    </div>
    <div class="body">
      <aside class="role-list">
        <div class="panel-title">角色</div>
        <button
          v-for="role in roles"
          :key="role.id"
          type="button"
          class="role-item"
          :class="{ 'is-active': role.id === activeId }"
          @click="selectRole(role.id)"
        >
          {{ role.name }}
        </button>
      </aside>
      <section
        v-loading="loading"
        class="role-main"
      >
        <template v-if="detail">
          <div class="summary">
            <div class="role-name">{{ detail.name }}</div>
            <div
              v-if="memberText"
              class="members"
            >
              {{ memberText }}
            </div>
            <div
              v-if="detail.remark"
              class="remark"
            >
              {{ detail.remark }}
            </div>
          </div>
          <div class="perm-title">功能权限</div>
          <ElTree
            ref="treeRef"
            class="menu-tree"
            :data="detail.menus"
            node-key="code"
            show-checkbox
            default-expand-all
            :props="{ label: 'name', children: 'children' }"
          />
          <div class="actions">
            <ElButton
              type="primary"
              :loading="saving"
              @click="onSave"
            >
              保存
            </ElButton>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.role-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.breadcrumb {
  color: #8a919f;
  font-size: 12px;
}

.title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 600;
}

.body {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.role-list,
.role-main {
  background: #fff;
  border: 1px solid #ebebeb;
  border-radius: 8px;
}

.role-list {
  width: 240px;
  flex: none;
  padding: 12px;
  overflow: auto;
}

.panel-title,
.perm-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.role-item {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: #1f2329;
}

.role-item.is-active {
  background: #e8f3ff;
  color: #165dff;
}

.role-main {
  flex: 1;
  min-width: 0;
  padding: 16px 20px;
  overflow: auto;
}

.summary {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f7f8fa;
}

.role-name {
  font-size: 16px;
  font-weight: 600;
}

.members,
.remark {
  margin-top: 6px;
  color: #4e5969;
  font-size: 13px;
  line-height: 1.6;
}

.menu-tree {
  max-width: 720px;
}

.actions {
  margin-top: 16px;
}
</style>
