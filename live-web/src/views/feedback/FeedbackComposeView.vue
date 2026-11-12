<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  submitFeedback,
  uploadFeedbackImage,
  type FeedbackImageRef,
} from "@/api/feedback";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import { getViewerUsername } from "@/utils/viewerAuth";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

/** 与小程序 pages/feedback/feedback/feedback 一致 */
const CONTENT_MAX = 200;
const IMAGES_MAX = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const CATEGORIES = [
  { value: 1, label: "课程权益" },
  { value: 2, label: "视频播放" },
  { value: 3, label: "学习体验" },
  { value: 4, label: "其他" },
];

interface LocalShot {
  key: string;
  file: File;
  url: string;
}

const router = useRouter();
const { toast } = useToast();

const category = ref(1);
const content = ref("");
const contactPhone = ref("");
const images = ref<LocalShot[]>([]);
const submitting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let leaveTimer: ReturnType<typeof setTimeout> | undefined;

const contentLen = computed(() => content.value.length);

function errText(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : fallback;
  return (msg || fallback).slice(0, 40);
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

/** 对齐小程序 buildObjectKey：viewer/feedback/{username}_{timestamp}_{rand}.{ext} */
function buildObjectKey(username: string, ext: string): string {
  const rand = Math.floor(Math.random() * 1000);
  return `viewer/feedback/${username}_${Date.now()}_${rand}.${ext}`;
}

function onContentInput(e: Event) {
  let value = (e.target as HTMLTextAreaElement).value || "";
  if (value.length > CONTENT_MAX) value = value.slice(0, CONTENT_MAX);
  content.value = value;
}

function onPhoneInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value || "";
  contactPhone.value = raw.replace(/\D/g, "").slice(0, 11);
}

function onAddImage() {
  if (submitting.value) return;
  if (images.value.length >= IMAGES_MAX) return;
  fileInput.value?.click();
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length || submitting.value) return;
  const next = images.value.slice();
  for (const file of files) {
    if (next.length >= IMAGES_MAX) break;
    if (file.size > MAX_BYTES) {
      toast("单张图片不能超过2MB");
      continue;
    }
    if (!extOf(file)) {
      toast("仅支持 jpg/png/gif/webp 图片");
      continue;
    }
    next.push({
      key: `${Date.now()}_${Math.floor(Math.random() * 1000)}_${file.name}`,
      file,
      url: URL.createObjectURL(file),
    });
  }
  images.value = next;
}

function onRemoveImage(index: number) {
  const next = images.value.slice();
  const removed = next.splice(index, 1)[0];
  if (removed) URL.revokeObjectURL(removed.url);
  images.value = next;
}

async function uploadAll(): Promise<FeedbackImageRef[]> {
  if (!images.value.length) return [];
  const username = getViewerUsername();
  if (!username) throw new Error("请重新登录");
  const out: FeedbackImageRef[] = [];
  for (const shot of images.value) {
    if (shot.file.size > MAX_BYTES) throw new Error("图片不能超过2MB");
    const ext = extOf(shot.file);
    if (!ext) throw new Error("仅支持 jpg/png/gif/webp 图片");
    const uploaded = await uploadFeedbackImage(
      shot.file,
      buildObjectKey(username, ext),
      contentTypeOf(ext),
    );
    if (!uploaded?.url || !uploaded.objectKey) throw new Error("上传失败");
    out.push({ url: uploaded.url, objectKey: uploaded.objectKey });
  }
  return out;
}

async function uploadAllAuthed(): Promise<FeedbackImageRef[] | null> {
  try {
    return await uploadAll();
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) throw e;
    const outcome = await recoverViewerAuth("/feedback");
    if (outcome !== "refreshed") return null;
    return uploadAll();
  }
}

async function submitAuthed(
  text: string,
  phone: string,
  shots: FeedbackImageRef[],
): Promise<boolean> {
  const body = {
    category: category.value,
    content: text,
    contactPhone: phone || undefined,
    images: shots,
  };
  try {
    await submitFeedback(body);
    return true;
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) throw e;
    const outcome = await recoverViewerAuth("/feedback");
    if (outcome !== "refreshed") return false;
    await submitFeedback(body);
    return true;
  }
}

function leaveAfterSubmit() {
  leaveTimer = setTimeout(() => {
    const back = window.history.state?.back;
    if (typeof back === "string" && back && !back.startsWith("/login")) {
      router.back();
      return;
    }
    void router.replace({ name: "feedback-list" });
  }, 500);
}

async function onSubmit() {
  if (submitting.value) return;
  const text = content.value.trim();
  if (!category.value) {
    toast("请选择意见类型");
    return;
  }
  if (!text) {
    toast("请描述你的问题或建议");
    return;
  }
  if (text.length > CONTENT_MAX) {
    toast(`描述最多${CONTENT_MAX}字`);
    return;
  }
  const phone = contactPhone.value.trim();
  if (phone && !/^1\d{10}$/.test(phone)) {
    toast("请输入正确的手机号");
    return;
  }

  submitting.value = true;
  try {
    const shots = await uploadAllAuthed();
    if (!shots) return;
    const ok = await submitAuthed(text, phone, shots);
    if (!ok) return;
    toast("提交成功");
    leaveAfterSubmit();
  } catch (e) {
    toast(errText(e, "提交失败"));
  } finally {
    submitting.value = false;
  }
}

onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer);
  for (const shot of images.value) URL.revokeObjectURL(shot.url);
});
</script>

<template>
  <AudienceFrame title="意见反馈">
    <div class="page">
      <div class="scroll">
        <div class="screen">
          <section class="section">
            <div class="label-row">
              <span class="label">意见描述</span>
              <span class="req">*</span>
            </div>
            <div class="cats">
              <button
                v-for="item in CATEGORIES"
                :key="item.value"
                type="button"
                class="cat"
                :class="{ on: category === item.value }"
                @click="category = item.value"
              >
                {{ item.label }}
              </button>
            </div>
            <div class="textarea-wrap">
              <textarea
                class="textarea"
                :maxlength="CONTENT_MAX"
                :value="content"
                placeholder="请描述你的功能问题或建议，帮助我们做的更好"
                @input="onContentInput"
              />
              <span class="count">{{ contentLen }}/{{ CONTENT_MAX }}</span>
            </div>
          </section>

          <section class="section">
            <div class="label-row between">
              <span class="label">相关截图</span>
              <span class="hint">{{ images.length }}/{{ IMAGES_MAX }}</span>
            </div>
            <div class="shots">
              <div
                v-for="(shot, index) in images"
                :key="shot.key"
                class="shot"
              >
                <img
                  :src="shot.url"
                  alt=""
                >
                <button
                  type="button"
                  class="shot-del"
                  aria-label="删除截图"
                  @click="onRemoveImage(index)"
                >
                  ×
                </button>
              </div>
              <button
                v-if="images.length < IMAGES_MAX"
                type="button"
                class="shot shot-add"
                aria-label="添加截图"
                @click="onAddImage"
              >
                +
              </button>
            </div>
            <input
              ref="fileInput"
              class="file"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              @change="onFile"
            >
          </section>

          <section class="section contact">
            <span class="label">联系方式</span>
            <input
              class="phone-input"
              type="tel"
              inputmode="numeric"
              maxlength="11"
              :value="contactPhone"
              placeholder="请输入你的手机号（选填）"
              @input="onPhoneInput"
            >
          </section>
        </div>
        <button
          type="button"
          class="history"
          @click="router.push({ name: 'feedback-list' })"
        >
          历史提交记录
        </button>
      </div>
      <div class="footer">
        <button
          type="button"
          class="submit"
          :disabled="submitting"
          @click="onSubmit"
        >
          提交反馈
        </button>
      </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.scroll { flex: 1; min-height: 0; overflow: auto; }
.screen { min-height: 100%; box-sizing: border-box; padding: 12px 20px 8px; }
.section { margin-bottom: 24px; }
.label-row { display: flex; align-items: center; margin-bottom: 12px; }
.label-row.between { justify-content: space-between; }
.label { font-size: 15px; color: #111; font-weight: 500; }
.req { margin-left: 2px; font-size: 15px; color: #ff4d4f; }
.hint { font-size: 13px; color: #bfbfbf; }
.cats { display: flex; flex-wrap: wrap; gap: 8px 10px; margin-bottom: 14px; }
.cat {
  padding: 6px 14px; border: 0; border-radius: 4px; font-size: 13px; color: #666;
  background: #f5f5f5; line-height: 1.4; cursor: pointer;
}
.cat.on { color: #1677ff; background: #e8f3ff; }
.textarea-wrap {
  position: relative; background: #f7f8fa; border-radius: 6px;
  padding: 12px 12px 24px; min-height: 120px; box-sizing: border-box;
}
.textarea {
  width: 100%; min-height: 100px; border: 0; resize: none; background: transparent;
  font-size: 14px; color: #111; line-height: 1.5; font-family: inherit;
}
.textarea::placeholder, .phone-input::placeholder { color: #bfbfbf; }
.count { position: absolute; right: 12px; bottom: 8px; font-size: 12px; color: #bfbfbf; }
.shots { display: flex; flex-wrap: wrap; gap: 10px; }
.shot { width: 80px; height: 80px; border-radius: 6px; position: relative; overflow: hidden; background: #f5f5f5; }
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.shot-del {
  position: absolute; top: 0; right: 0; width: 22px; height: 22px; border: 0; padding: 0;
  border-radius: 0 6px 0 6px; background: rgba(0, 0, 0, 0.45); color: #fff;
  font-size: 14px; line-height: 22px; cursor: pointer;
}
.shot-add {
  display: flex; align-items: center; justify-content: center; border: 1px dashed #d9d9d9;
  box-sizing: border-box; background: #fafafa; color: #bfbfbf; font-size: 28px;
  font-weight: 300; line-height: 1; cursor: pointer;
}
.contact { padding-top: 4px; border-top: 1px solid #f0f0f0; }
.contact .label { display: block; margin-bottom: 8px; }
.phone-input {
  width: 100%; height: 36px; border: 0; padding: 0; font-size: 14px; color: #111; background: transparent;
}
.history {
  display: block; width: 100%; border: 0; background: transparent; text-align: center;
  font-size: 13px; line-height: 20px; color: #bfbfbf; padding: 12px 12px 24px; cursor: pointer;
}
.footer {
  flex-shrink: 0; padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: #fff; box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.submit {
  width: 100%; height: 44px; border: 0; border-radius: 22px; background: #1677ff;
  color: #fff; font-size: 16px; font-weight: 500; cursor: pointer;
}
.submit:disabled { opacity: 0.65; }
.file { display: none; }
</style>
