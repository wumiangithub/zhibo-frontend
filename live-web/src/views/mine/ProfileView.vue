<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getViewerUserInfo, type ViewerAuthUser } from "@/api/viewerAuth";
import { updateViewerProfile, uploadViewerFile } from "@/api/viewerProfile";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  getViewerId,
  getViewerProfile,
  saveViewerProfile,
  saveViewerSession,
} from "@/utils/viewerAuth";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

const NICK_MAX = 16;
const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_AVATAR = "/audience/avatar-default.png";

const router = useRouter();
const { toast } = useToast();

const nickname = ref("");
const avatarUrl = ref("");
const avatarBroken = ref(false);
const previewUrl = ref("");
const pendingFile = ref<File | null>(null);
const saving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let leaveTimer: ReturnType<typeof setTimeout> | undefined;

function fillFromCache() {
  const profile = getViewerProfile();
  nickname.value = profile.nickname.slice(0, NICK_MAX);
  if (!pendingFile.value) {
    avatarUrl.value = profile.avatarUrl;
    avatarBroken.value = false;
  }
}

function applyUser(user: ViewerAuthUser) {
  saveViewerSession({ user });
  saveViewerProfile({
    nickname: typeof user.nickname === "string" ? user.nickname : undefined,
    avatarUrl: user.avatarUrl,
  });
  nickname.value = (user.nickname || "").trim().slice(0, NICK_MAX);
  if (!pendingFile.value) {
    avatarUrl.value = user.avatarUrl?.trim() || "";
    avatarBroken.value = false;
  }
}

async function loadMe() {
  fillFromCache();
  try {
    applyUser(await getViewerUserInfo());
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) return;
    const outcome = await recoverViewerAuth("/profile");
    if (outcome !== "refreshed") return;
    try {
      applyUser(await getViewerUserInfo());
    } catch {
      fillFromCache();
    }
  }
}

function onNickInput(e: Event) {
  let value = (e.target as HTMLInputElement).value || "";
  if (value.length > NICK_MAX) value = value.slice(0, NICK_MAX);
  nickname.value = value;
}

function onNickBlur() {
  let value = nickname.value.trim();
  if (value.length > NICK_MAX) value = value.slice(0, NICK_MAX);
  nickname.value = value;
}

function extOf(file: File): string | null {
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  const ext = fromName === "jpeg" ? "jpg" : fromName;
  if (ext === "jpg" || ext === "png" || ext === "gif" || ext === "webp") return ext;
  const mime = file.type.toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return null;
}

function contentTypeOf(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function onChooseAvatar() {
  if (saving.value) return;
  fileInput.value?.click();
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || saving.value) return;
  if (file.size > MAX_BYTES) {
    toast("图片不能超过2MB");
    return;
  }
  if (!extOf(file)) {
    toast("请选择 jpg、png、gif 或 webp 图片");
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  pendingFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  avatarBroken.value = false;
}

function errText(e: unknown): string {
  const msg = e instanceof Error ? e.message : "保存失败";
  return (msg || "保存失败").slice(0, 40);
}

async function persist(name: string): Promise<ViewerAuthUser> {
  const file = pendingFile.value;
  if (!file) return updateViewerProfile({ nickname: name });
  if (file.size > MAX_BYTES) throw new Error("图片不能超过2MB");
  const viewerId = getViewerId();
  if (!viewerId) throw new Error("请重新登录");
  const ext = extOf(file);
  if (!ext) throw new Error("请选择 jpg、png、gif 或 webp 图片");
  const uploaded = await uploadViewerFile(
    file,
    `viewer/avatar/${viewerId}.${ext}`,
    contentTypeOf(ext),
  );
  if (!uploaded?.url || !uploaded.objectKey) throw new Error("上传失败");
  return updateViewerProfile({
    nickname: name,
    avatarUrl: uploaded.url,
    avatarObjectKey: uploaded.objectKey,
  });
}

function afterOk(user: ViewerAuthUser, name: string) {
  saveViewerSession({ user });
  saveViewerProfile({
    nickname: typeof user.nickname === "string" ? user.nickname : name,
    avatarUrl: user.avatarUrl,
  });
  pendingFile.value = null;
  toast("已保存");
  leaveTimer = setTimeout(() => {
    const back = window.history.state?.back;
    if (typeof back === "string" && back && !back.startsWith("/login")) {
      router.back();
      return;
    }
    void router.replace({ name: "mine" });
  }, 400);
}

async function onSave() {
  if (saving.value) return;
  const name = nickname.value.trim();
  if (!name) {
    toast("请输入昵称");
    return;
  }
  if (name.length > NICK_MAX) {
    toast(`昵称最多${NICK_MAX}字`);
    return;
  }
  saving.value = true;
  let saved = false;
  try {
    afterOk(await persist(name), name);
    saved = true;
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) {
      toast(errText(e));
      return;
    }
    const outcome = await recoverViewerAuth("/profile");
    if (outcome !== "refreshed") return;
    try {
      afterOk(await persist(name), name);
      saved = true;
    } catch (again) {
      toast(errText(again));
    }
  } finally {
    if (!saved) saving.value = false;
  }
}

void loadMe();

onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer);
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<template>
  <AudienceFrame title="个人信息">
    <div class="page">
      <button
        type="button"
        class="avatar-wrap"
        @click="onChooseAvatar"
      >
        <img
          v-if="previewUrl"
          class="avatar"
          :src="previewUrl"
          alt=""
        >
        <img
          v-else-if="avatarUrl && !avatarBroken"
          class="avatar"
          :src="avatarUrl"
          alt=""
          @error="avatarBroken = true"
        >
        <img
          v-else
          class="avatar"
          :src="DEFAULT_AVATAR"
          alt=""
        >
        <img
          class="camera"
          src="/audience/icon-camera.png"
          alt=""
        >
      </button>
      <input
        ref="fileInput"
        class="file"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
        @change="onFile"
      >

      <div class="nick-row">
        <span class="nick-label">昵称</span>
        <input
          class="nick-input"
          type="text"
          :maxlength="NICK_MAX"
          :value="nickname"
          placeholder="请输入昵称"
          @input="onNickInput"
          @blur="onNickBlur"
        >
        <span class="nick-count">{{ nickname.length }}/{{ NICK_MAX }}</span>
      </div>
      <div class="divider" />

      <button
        type="button"
        class="save"
        :disabled="saving"
        @click="onSave"
      >
        保存
      </button>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  box-sizing: border-box;
  padding: 36px 24px 40px;
  background: #ffffff;
}
.avatar-wrap {
  width: 100px;
  height: 100px;
  margin: 0 auto 36px;
  padding: 0;
  border: 0;
  background: transparent;
  position: relative;
  display: block;
  cursor: pointer;
}
.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #e6f0ff;
  object-fit: cover;
  display: block;
}
.camera {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}
.file {
  display: none;
}
.nick-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 4px;
}
.nick-label {
  width: 48px;
  flex-shrink: 0;
  font-size: 15px;
  color: #111111;
}
.nick-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  text-align: center;
  font-size: 15px;
  color: #111111;
  height: 32px;
  line-height: 32px;
  background: transparent;
}
.nick-count {
  width: 44px;
  flex-shrink: 0;
  text-align: right;
  font-size: 13px;
  color: #bfbfbf;
}
.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 4px 32px;
}
.save {
  display: block;
  width: 100%;
  margin-top: 8px;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: #1677ff;
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}
.save:disabled {
  opacity: 0.7;
  cursor: default;
}
</style>
