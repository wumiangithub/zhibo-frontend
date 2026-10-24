<script setup lang="ts">
import { ref, watch } from "vue";
import { ElIcon, ElMessage, ElMessageBox, ElTable, ElTableColumn } from "element-plus";
import { EditPen } from "@element-plus/icons-vue";
import {
  addActivityMembers,
  deleteActivityMembers,
  listActivityMembers,
  updateActivityMember,
  type ActivityId,
  type ActivityMemberBinding,
  type ActivityMemberItem,
} from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import { useAuthStore } from "@/stores/auth";
import AddRoleDrawer from "./AddRoleDrawer.vue";
import MemberAvatar from "./MemberAvatar.vue";
import RoleMemberEditDialog from "./RoleMemberEditDialog.vue";
import WechatInviteDialog from "./WechatInviteDialog.vue";
import {
  ActivityMemberRole,
  ACTIVITY_MEMBER_ROLE_LABEL,
  isLiveRoomRole,
  ROLE_META,
  type LiveRoomMember,
  type LiveRoomRole,
} from "./roleTypes";

const props = withDefaults(
  defineProps<{
    activityId: ActivityId;
    liveTitle?: string;
    startTime?: string;
    /** 已绑报备：主播来自报备，不可增删改人员 */
    hostLocked?: boolean;
  }>(),
  { liveTitle: "", startTime: "", hostLocked: false },
);

const auth = useAuthStore();
const members = ref<LiveRoomMember[]>([]);
const loading = ref(false);
const saving = ref(false);
const drawerOpen = ref(false);
const inviteOpen = ref(false);
const editOpen = ref(false);
const editMode = ref<"profile" | "tag">("profile");
const editing = ref<LiveRoomMember | null>(null);

function toRoomMember(item: ActivityMemberItem): LiveRoomMember | null {
  if (!isLiveRoomRole(item.role)) return null;
  return {
    id: item.id,
    userName: item.userName ?? "",
    headimgurl: item.headimgurl?.trim() ?? "",
    departmentName: item.departmentName?.trim() ?? "",
    role: item.role,
    nickname: item.nickname?.trim() || item.userName || "",
    avatarUrl: item.avatarUrl?.trim() ?? "",
    tag: item.tag?.trim() ?? "",
  };
}

function toBindings(list: LiveRoomMember[]): ActivityMemberBinding[] {
  return list.map((member) => ({
    id: member.id,
    role: member.role,
    nickname: member.nickname.trim() || undefined,
    avatarUrl: member.avatarUrl.trim() || undefined,
    tag: member.tag.trim() || undefined,
  }));
}

function applyList(list: ActivityMemberItem[] | undefined) {
  members.value = (list ?? [])
    .map(toRoomMember)
    .filter((row): row is LiveRoomMember => row != null);
}

async function loadMembers() {
  if (!props.activityId) return;
  loading.value = true;
  try {
    const data = await listActivityMembers(props.activityId);
    applyList(data.list);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载开播成员失败");
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.activityId,
  () => {
    void loadMembers();
  },
  { immediate: true },
);

function onWechatInvite() {
  if (!auth.user?.id) {
    ElMessage.warning("请重新登录后再邀请");
    return;
  }
  inviteOpen.value = true;
}

function memberFromRow(row: unknown): LiveRoomMember {
  return row as LiveRoomMember;
}

function roleLabel(role: LiveRoomRole) {
  return ACTIVITY_MEMBER_ROLE_LABEL[role] ?? ROLE_META[role].label;
}

async function onSave(next: LiveRoomMember[]) {
  const current = members.value;
  const nextById = new Map(next.map((member) => [member.id, member]));
  const currentIds = new Set(current.map((member) => member.id));
  const removed = current.filter((member) => !nextById.has(member.id));
  const roleChanged = current.filter((member) => {
    const item = nextById.get(member.id);
    return item != null && item.role !== member.role;
  });
  const added = next.filter((member) => !currentIds.has(member.id));
  const toDelete = [...removed, ...roleChanged].map((member) => member.id);
  if (added.length === 0 && toDelete.length === 0) return;
  if (!props.activityId || saving.value) return;
  saving.value = true;
  try {
    if (added.length > 0) {
      await addActivityMembers(props.activityId, toBindings(added));
    }
    if (toDelete.length > 0) {
      await deleteActivityMembers(props.activityId, toDelete);
    }
    if (roleChanged.length > 0) {
      const changed = roleChanged
        .map((member) => nextById.get(member.id))
        .filter((member): member is LiveRoomMember => member != null);
      await addActivityMembers(props.activityId, toBindings(changed));
    }
    const data = await listActivityMembers(props.activityId);
    applyList(data.list);
    ElMessage.success("已保存");
  } catch (e) {
    try {
      const data = await listActivityMembers(props.activityId);
      applyList(data.list);
    } catch {
      // 名单刷新失败时保留上次成功态
    }
    ElMessage.error(e instanceof Error ? e.message : "保存开播成员失败");
  } finally {
    saving.value = false;
  }
}

function openEdit(row: LiveRoomMember, mode: "profile" | "tag") {
  editing.value = row;
  editMode.value = mode;
  editOpen.value = true;
}

async function onEditSave(patch: Pick<LiveRoomMember, "nickname" | "avatarUrl" | "tag">) {
  const current = editing.value;
  if (!current || !props.activityId || saving.value) return;
  saving.value = true;
  try {
    const data = await updateActivityMember(props.activityId, {
      id: current.id,
      nickname: patch.nickname.trim() || undefined,
      avatarUrl: patch.avatarUrl.trim() || undefined,
      tag: patch.tag.trim() || undefined,
    });
    applyList(data.list);
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存开播成员失败");
  } finally {
    saving.value = false;
  }
}

function isHostLockedRow(row: LiveRoomMember) {
  return props.hostLocked && row.role === ActivityMemberRole.HOST;
}

function toastHostLocked() {
  ElMessage.warning("已绑定直播报备不可修改");
}

async function onDelete(row: LiveRoomMember) {
  if (isHostLockedRow(row)) {
    toastHostLocked();
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定移除「${row.userName}」的${roleLabel(row.role)}角色吗？`,
      "删除角色",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  if (!props.activityId || saving.value) return;
  saving.value = true;
  try {
    const data = await deleteActivityMembers(props.activityId, [row.id]);
    applyList(data.list);
    ElMessage.success("已删除");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除开播成员失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-loading="loading || saving"
    class="role-settings"
  >
    <div class="toolbar">
      <UiButton
        variant="primary"
        :disabled="saving"
        @click="drawerOpen = true"
      >
        + 添加角色
      </UiButton>
      <UiButton
        variant="outline"
        @click="onWechatInvite"
      >
        + 微信邀约      </UiButton>
      <span class="hint">添加用户成为主播、助理或嘉宾</span>
    </div>

    <ElTable
      :data="members"
      class="role-table"
      empty-text="暂无角色，请添加主播、助理或嘉宾"
    >
      <ElTableColumn
        label="用户"
        min-width="180"
      >
        <template #default="{ row }">
          <span class="person">
            <MemberAvatar
              :name="row.userName"
              :url="row.headimgurl"
              :size="32"
            />
            <span>{{ row.userName }}</span>
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="角色"
        width="120"
      >
        <template #default="{ row }">
          {{ roleLabel(memberFromRow(row).role) }}
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="本场直播头像/昵称"
        min-width="220"
      >
        <template #default="{ row }">
          <span class="person">
            <MemberAvatar
              :name="row.nickname || row.userName"
              :url="row.avatarUrl"
              :size="32"
            />
            <span>{{ row.nickname }}</span>
            <button
              type="button"
              class="icon-btn"
              aria-label="编辑头像和昵称"
              :disabled="saving"
              @click="openEdit(memberFromRow(row), 'profile')"
            >
              <ElIcon :size="14">
                <EditPen />
              </ElIcon>
            </button>
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="标签设置"
        min-width="140"
      >
        <template #default="{ row }">
          <span class="person">
            <span>{{ row.tag }}</span>
            <button
              type="button"
              class="icon-btn"
              aria-label="编辑标签"
              :disabled="saving"
              @click="openEdit(memberFromRow(row), 'tag')"
            >
              <ElIcon :size="14">
                <EditPen />
              </ElIcon>
            </button>
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn
        label="操作"
        width="90"
      >
        <template #default="{ row }">
          <button
            type="button"
            class="link-btn"
            :class="{ 'is-look-disabled': isHostLockedRow(memberFromRow(row)) }"
            :disabled="saving"
            @click="onDelete(memberFromRow(row))"
          >
            删除
          </button>
        </template>
      </ElTableColumn>
    </ElTable>

    <AddRoleDrawer
      v-model="drawerOpen"
      :members="members"
      :host-locked="hostLocked"
      @save="onSave"
    />
    <RoleMemberEditDialog
      v-model="editOpen"
      :mode="editMode"
      :member="editing"
      @save="onEditSave"
    />
    <WechatInviteDialog
      v-if="auth.user?.id"
      v-model="inviteOpen"
      :activity-id="activityId"
      :inviter-id="auth.user.id"
      :live-title="liveTitle"
      :start-time="startTime"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.hint {
  font-size: 13px;
  color: var(--color-text-placeholder);
}
.role-table {
  width: 100%;
}
.role-table :deep(.el-table__header th) {
  background: #fafafa;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.person {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--color-text);
  font-size: 13px;
}
.icon-btn,
.link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.icon-btn:disabled,
.link-btn:disabled,
.link-btn.is-look-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.icon-btn {
  display: inline-flex;
  color: var(--color-text-secondary);
}
.icon-btn:hover:not(:disabled),
.link-btn:hover:not(:disabled):not(.is-look-disabled) {
  color: var(--color-primary);
}
.link-btn {
  color: var(--color-primary);
  font-size: 13px;
}
.link-btn.is-look-disabled:hover {
  color: var(--color-primary);
}
</style>
