<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog, ElInput, ElMessage } from "element-plus";
import { TosObjectKeyPrefix, uploadFileToTos } from "@/utils/tosUpload";
import UiButton from "@/components/ui/UiButton.vue";
import MemberAvatar from "./MemberAvatar.vue";
import type { LiveRoomMember } from "./roleTypes";

const props = defineProps<{
  modelValue: boolean;
  mode: "profile" | "tag";
  member: LiveRoomMember | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [patch: Pick<LiveRoomMember, "nickname" | "avatarUrl" | "tag">];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const nickname = ref("");
const avatarUrl = ref("");
const tag = ref("");
const uploading = ref(false);
const fileRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.member) return;
    nickname.value = props.member.nickname;
    avatarUrl.value = props.member.avatarUrl;
    tag.value = props.member.tag;
  },
);

const title = computed(() => (props.mode === "tag" ? "编辑标签" : "编辑本场头像/昵称"));

function pickFile() {
  fileRef.value?.click();
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    ElMessage.warning("请选择图片文件");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning("图片需小于 5M");
    return;
  }
  uploading.value = true;
  try {
    avatarUrl.value = await uploadFileToTos(file, TosObjectKeyPrefix.ACTIVITY_MEMBER_AVATAR);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    uploading.value = false;
  }
}

function onSave() {
  if (!props.member) return;
  if (props.mode === "tag") {
    const nextTag = tag.value.trim();
    if (!nextTag) {
      ElMessage.warning("请填写标签");
      return;
    }
    emit("save", {
      nickname: props.member.nickname,
      avatarUrl: props.member.avatarUrl,
      tag: nextTag,
    });
  } else {
    const nextNick = nickname.value.trim();
    if (nextNick.length > 10) {
      ElMessage.warning("本场昵称不能超过10个字");
      return;
    }
    emit("save", {
      nickname: nextNick || props.member.userName,
      avatarUrl: avatarUrl.value.trim(),
      tag: props.member.tag,
    });
  }
  visible.value = false;
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="420px"
    align-center
    append-to-body
    destroy-on-close
  >
    <div
      v-if="mode === 'profile'"
      class="profile"
    >
      <button
        type="button"
        class="avatar-btn"
        :disabled="uploading"
        @click="pickFile"
      >
        <MemberAvatar
          :name="nickname || member?.userName || ''"
          :url="avatarUrl"
          :size="64"
        />
        <span>{{ uploading ? "上传中…" : "点击更换头像" }}</span>
      </button>
      <input
        ref="fileRef"
        class="file"
        type="file"
        accept="image/*"
        @change="onFile"
      >
      <label class="field">
        <span>本场昵称</span>
        <ElInput
          v-model="nickname"
          maxlength="10"
          show-word-limit
          placeholder="观众看到的昵称"
        />
      </label>
    </div>
    <label
      v-else
      class="field"
    >
      <span>标签</span>
      <ElInput
        v-model="tag"
        maxlength="10"
        show-word-limit
        placeholder="如讲师、助教"
      />
    </label>
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
          :disabled="uploading"
          @click="onSave"
        >
          确定
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
.profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.avatar-btn {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}
.avatar-btn:disabled {
  cursor: wait;
}
.file {
  display: none;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
