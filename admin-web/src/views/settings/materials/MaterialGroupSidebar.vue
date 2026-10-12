<script setup lang="ts">
import { ElInput, ElMessageBox, ElIcon } from "element-plus";
import { Search, CirclePlus } from "@element-plus/icons-vue";
import type { MaterialGroup } from "./mock";
import { useToast } from "@/composables/useToast";

const props = defineProps<{
  groups: MaterialGroup[];
  activeGroupId: string;
  keyword: string;
}>();

const emit = defineEmits<{
  "update:keyword": [v: string];
  "update:activeGroupId": [v: string];
  add: [name: string];
  rename: [g: MaterialGroup, name: string];
  remove: [g: MaterialGroup];
}>();

const { toast } = useToast();

async function addGroup() {
  try {
    const { value } = await ElMessageBox.prompt("请输入分组名称", "新建分组", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      inputPlaceholder: "分组名称",
      inputPattern: /\S+/,
      inputErrorMessage: "名称不能为空",
    });
    emit("add", String(value).trim());
    toast("已新建分组（Mock）");
  } catch {
    /* cancel */
  }
}

async function renameGroup(g: MaterialGroup) {
  if (g.id === "all") return;
  try {
    const { value } = await ElMessageBox.prompt("请输入新的分组名称", "重命名", {
      inputValue: g.name,
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      inputPattern: /\S+/,
      inputErrorMessage: "名称不能为空",
    });
    emit("rename", g, String(value).trim());
    toast("已重命名（Mock）");
  } catch {
    /* cancel */
  }
}

async function removeGroup(g: MaterialGroup) {
  if (g.id === "all") return;
  try {
    await ElMessageBox.confirm(`确定删除分组「${g.name}」？`, "删除分组", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
    emit("remove", g);
    toast("已删除（Mock）");
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <aside class="group-panel">
    <ElInput
      :model-value="keyword"
      clearable
      placeholder="请输入分组名称"
      :prefix-icon="Search"
      @update:model-value="emit('update:keyword', $event)"
    />
    <ul class="group-list">
      <li
        v-for="g in groups"
        :key="g.id"
        class="group-item"
        :class="{ 'is-active': activeGroupId === g.id }"
        @click="emit('update:activeGroupId', g.id)"
      >
        <span class="group-name">{{ g.name }}</span>
        <span class="group-count">{{ g.count }}</span>
        <button
          v-if="g.id === 'all'"
          type="button"
          class="group-add"
          title="新建分组"
          @click.stop="addGroup"
        >
          <ElIcon :size="18"><CirclePlus /></ElIcon>
        </button>
        <span
          v-else
          class="group-actions"
        >
          <button
            type="button"
            @click.stop="renameGroup(g)"
          >
            重命名
          </button>
          <button
            type="button"
            @click.stop="removeGroup(g)"
          >
            删除
          </button>
        </span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.group-panel {
  flex: none;
  display: flex;
  flex-direction: column;
  width: 220px;
  min-height: 0;
  padding: 16px 12px;
  border-right: 1px solid var(--color-border-light);
  background: var(--color-bg-aside);
  overflow: hidden;
}

.group-list {
  flex: 1;
  min-height: 0;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.group-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}

.group-item:hover,
.group-item.is-active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.group-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  flex: none;
  color: var(--color-text-placeholder);
  font-size: 12px;
}

.group-item.is-active .group-count,
.group-item:hover .group-count {
  color: var(--color-primary);
}

.group-add {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-primary);
  line-height: 1;
  cursor: pointer;
}

.group-add:hover {
  background: var(--color-primary-bg-active);
}

.group-actions {
  display: none;
  flex: none;
  gap: 6px;
}

.group-item:hover .group-actions {
  display: inline-flex;
}

.group-item:hover .group-count {
  display: none;
}

.group-actions button {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
}
</style>
