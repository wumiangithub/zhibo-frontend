<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDrawer, ElMessage, ElMessageBox } from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import AddMemberDialog from "./AddMemberDialog.vue";
import MemberAvatar from "./MemberAvatar.vue";
import {
  ActivityMemberRole,
  ROLE_META,
  ROLE_ORDER,
  type LiveRoomMember,
  type LiveRoomRole,
} from "./roleTypes";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    members: LiveRoomMember[];
    /** 已绑报备：主播人选不可增删改 */
    hostLocked?: boolean;
  }>(),
  { hostLocked: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [members: LiveRoomMember[]];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const draft = ref<LiveRoomMember[]>([]);
/** Snapshot of members when the drawer opened; used to detect unsaved edits. */
const baseline = ref<LiveRoomMember[]>([]);
const pickerOpen = ref(false);
const pickerRole = ref<LiveRoomRole>(ActivityMemberRole.HOST);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const snapshot = props.members.map((member) => ({ ...member }));
    draft.value = snapshot.map((member) => ({ ...member }));
    baseline.value = snapshot;
  },
);

function membersSignature(list: LiveRoomMember[]) {
  return list
    .map((member) => `${member.id}:${member.role}`)
    .sort()
    .join("|");
}

function isDraftDirty() {
  return membersSignature(draft.value) !== membersSignature(baseline.value);
}

async function confirmDiscardIfDirty(): Promise<boolean> {
  if (!isDraftDirty()) return true;
  try {
    await ElMessageBox.confirm("此时离开将丢失已编辑的角色", "确认离开吗？", {
      type: "info",
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      distinguishCancelAndClose: true,
      closeOnClickModal: false,
    });
    return true;
  } catch {
    return false;
  }
}

/** Mask / X / ESC — ElDrawer before-close. */
function onBeforeClose(done: () => void) {
  void (async () => {
    if (await confirmDiscardIfDirty()) done();
  })();
}

/** Footer 取消 — same confirm path as before-close. */
async function onCancel() {
  if (await confirmDiscardIfDirty()) {
    visible.value = false;
  }
}

function membersOf(role: LiveRoomRole) {
  return draft.value.filter((member) => member.role === role);
}

function toastHostLocked() {
  ElMessage.warning("已绑定直播报备不可修改");
}

function openPicker(role: LiveRoomRole) {
  if (props.hostLocked && role === ActivityMemberRole.HOST) {
    toastHostLocked();
    return;
  }
  pickerRole.value = role;
  pickerOpen.value = true;
}

function applyPicked(picked: LiveRoomMember[]) {
  const pickedIds = new Set(picked.map((member) => member.id));
  const byId = new Map(picked.map((member) => [member.id, member]));
  const next: LiveRoomMember[] = [];
  const seen = new Set<number>();
  for (const member of draft.value) {
    if (pickedIds.has(member.id)) {
      if (!seen.has(member.id)) {
        next.push(byId.get(member.id)!);
        seen.add(member.id);
      }
      continue;
    }
    if (member.role === pickerRole.value) continue;
    next.push(member);
  }
  for (const member of picked) {
    if (!seen.has(member.id)) next.push(member);
  }
  draft.value = next;
}

function removeDraft(id: number) {
  const target = draft.value.find((member) => member.id === id);
  if (props.hostLocked && target?.role === ActivityMemberRole.HOST) {
    toastHostLocked();
    return;
  }
  draft.value = draft.value.filter((member) => member.id !== id);
}

function onSave() {
  emit("save", draft.value.map((member) => ({ ...member })));
  // Programmatic close skips before-close; no leave prompt after save.
  visible.value = false;
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    title="角色设置"
    direction="rtl"
    size="480px"
    append-to-body
    :before-close="onBeforeClose"
    class="role-drawer"
  >
    <h3 class="section-title">添加角色</h3>
    <article
      v-for="role in ROLE_ORDER"
      :key="role"
      class="role-card"
    >
      <span
        class="role-icon"
        :class="`is-${ROLE_META[role].tone}`"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
        </svg>
      </span>
      <div class="role-main">
        <div class="role-head">
          <span class="role-name">{{ ROLE_META[role].label }}</span>
          <UiButton
            variant="outline"
            :look-disabled="hostLocked && role === ActivityMemberRole.HOST"
            @click="openPicker(role)"
          >
            + 添加{{ ROLE_META[role].label }}
          </UiButton>
        </div>
        <p class="role-desc">{{ ROLE_META[role].description }}</p>
        <ul
          v-if="membersOf(role).length"
          class="draft-list"
        >
          <li
            v-for="member in membersOf(role)"
            :key="member.id"
            class="draft-item"
          >
            <MemberAvatar
              :name="member.nickname || member.userName"
              :url="member.avatarUrl"
              :size="24"
            />
            <span class="draft-name">{{ member.userName }}</span>
            <button
              type="button"
              class="draft-remove"
              :class="{ 'is-look-disabled': hostLocked && role === ActivityMemberRole.HOST }"
              aria-label="移除"
              @click="removeDraft(member.id)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
    </article>

    <template #footer>
      <div class="footer">
        <UiButton
          variant="default"
          @click="onCancel"
        >
          取消
        </UiButton>
        <UiButton
          variant="primary"
          @click="onSave"
        >
          保存
        </UiButton>
      </div>
    </template>

    <AddMemberDialog
      v-model="pickerOpen"
      :role="pickerRole"
      :selected="membersOf(pickerRole)"
      :all-members="draft"
      @confirm="applyPicked"
    />
  </ElDrawer>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.role-card {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 8px;
  background: #f7f8fa;
}
.role-icon {
  flex: none;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.role-icon svg {
  width: 28px;
  height: 28px;
}
.role-icon.is-blue {
  color: var(--color-primary);
}
.role-icon.is-orange {
  color: #fa8c16;
}
.role-main {
  flex: 1;
  min-width: 0;
}
.role-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.role-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.role-desc {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-placeholder);
}
.draft-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.draft-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 8px 4px 4px;
  border-radius: 16px;
  background: #fff;
}
.draft-name {
  font-size: 12px;
  color: var(--color-text);
}
.draft-remove {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-text-placeholder);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.draft-remove:hover:not(.is-look-disabled) {
  color: var(--color-danger);
}
.draft-remove.is-look-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
