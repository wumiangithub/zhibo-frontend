<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog } from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import { copyText } from "@/utils/copyText";
import { buildRoleInviteUrl } from "@/utils/liveLinks";
import {
  ACTIVITY_MEMBER_ROLE_LABEL,
  ROLE_ORDER,
  type LiveRoomRole,
} from "@/views/live/detail/role/roleTypes";

const PLATFORM_NAME = "钱坤云直播平台";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    activityId: string;
    /** 发出邀约的当前员工 */
    inviterId: number;
    liveTitle?: string;
    startTime?: string;
  }>(),
  { liveTitle: "", startTime: "" },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const role = ref<LiveRoomRole>(ROLE_ORDER[0]);

watch(
  () => props.modelValue,
  (open) => {
    if (open) role.value = ROLE_ORDER[0];
  },
);

function shown(value: string | undefined) {
  const text = (value ?? "").trim();
  return text || "暂无";
}

const titleText = computed(() => shown(props.liveTitle));
const timeText = computed(() => shown(props.startTime));
const roleLabel = computed(() => ACTIVITY_MEMBER_ROLE_LABEL[role.value]);
const inviteUrl = computed(() =>
  buildRoleInviteUrl(props.activityId, role.value, props.inviterId),
);

const copyAllText = computed(() =>
  [
    PLATFORM_NAME,
    `直播名称：${titleText.value}`,
    `直播时间：${timeText.value}`,
    `${roleLabel.value}链接：`,
    inviteUrl.value,
  ].join("\n"),
);

function copyUrl() {
  void copyText(inviteUrl.value, "链接已复制");
}

function copyAll() {
  void copyText(copyAllText.value, "已复制");
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="邀请角色"
    width="480px"
    align-center
    append-to-body
    destroy-on-close
  >
    <div class="role-tabs">
      <button
        v-for="item in ROLE_ORDER"
        :key="item"
        type="button"
        class="role-tab"
        :class="{ 'is-active': role === item }"
        @click="role = item"
      >
        {{ ACTIVITY_MEMBER_ROLE_LABEL[item] }}
      </button>
    </div>
    <div class="invite-card">
      <p class="brand">{{ PLATFORM_NAME }}</p>
      <p class="line">
        <span>直播名称：</span>{{ titleText }}
      </p>
      <p class="line">
        <span>直播时间：</span>{{ timeText }}
      </p>
      <p class="line link-label">{{ roleLabel }}链接：</p>
      <p class="url-row">
        <span class="url">{{ inviteUrl }}</span>
        <button
          type="button"
          class="copy-link"
          @click="copyUrl"
        >
          复制
        </button>
      </p>
      <UiButton
        class="copy-all"
        variant="primary"
        @click="copyAll"
      >
        复制全部信息
      </UiButton>
    </div>
  </ElDialog>
</template>

<style scoped>
.role-tabs {
  display: flex;
  gap: 28px;
  margin: -4px 0 16px;
  border-bottom: 1px solid var(--color-border-light);
}
.role-tab {
  border: 0;
  background: transparent;
  padding: 8px 0 10px;
  margin-bottom: -1px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
  border-bottom: 2px solid transparent;
}
.role-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}
.invite-card {
  padding: 20px 20px 16px;
  border-radius: 8px;
  background: #f5f7fb;
}
.brand {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--color-text);
}
.line {
  margin: 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text);
}
.line + .line {
  margin-top: 8px;
}
.link-label {
  margin-top: 18px;
}
.url-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 4px 0 0;
}
.url {
  min-width: 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.copy-link {
  flex: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  line-height: 22px;
  cursor: pointer;
}
.copy-link:hover {
  color: var(--color-primary-hover);
}
.copy-all {
  margin-top: 18px;
}
</style>
