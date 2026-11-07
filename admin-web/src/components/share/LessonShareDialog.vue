<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog, ElMessage } from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import { copyText } from "@/utils/copyText";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 小节标题 */
    title: string;
    /** 分享链接（已含邀请人 c） */
    shareUrl: string;
    brandLine?: string;
    watchVerb?: string;
    titleFallback?: string;
  }>(),
  {
    brandLine: "钱坤云直播平台 发现一门精彩课程",
    watchVerb: "点击学习",
    titleFallback: "小节",
  },
);

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const displayUrl = computed(() => props.shareUrl.trim());
const displayTitle = computed(() => props.title.trim() || props.titleFallback);

const shareText = computed(() =>
  [props.brandLine, displayTitle.value, `${props.watchVerb}：${displayUrl.value}`].join("\n"),
);

const qrSrc = ref("");
const qrError = ref("");
let qrSeq = 0;

watch(
  () => [props.modelValue, displayUrl.value] as const,
  async ([open, url]) => {
    const seq = ++qrSeq;
    if (!open) return;
    qrSrc.value = "";
    qrError.value = "";
    if (!url) {
      qrError.value = "暂无分享链接";
      return;
    }
    try {
      const qrcode = await import("qrcode");
      const toDataURL = qrcode.toDataURL ?? qrcode.default.toDataURL;
      const dataUrl = await toDataURL(url, {
        margin: 1,
        width: 200,
        errorCorrectionLevel: "M",
      });
      if (seq !== qrSeq) return;
      qrSrc.value = dataUrl;
    } catch {
      if (seq !== qrSeq) return;
      qrSrc.value = "";
      qrError.value = "二维码生成失败";
    }
  },
  { immediate: true },
);

function copyUrl() {
  if (!displayUrl.value) {
    ElMessage.warning("暂无链接");
    return;
  }
  void copyText(displayUrl.value, "链接已复制");
}

function copyShareText() {
  if (!displayUrl.value) {
    ElMessage.warning("暂无分享内容");
    return;
  }
  void copyText(shareText.value, "分享文本已复制");
}

function downloadQr() {
  if (!qrSrc.value) {
    ElMessage.warning(qrError.value || "二维码未就绪");
    return;
  }
  const a = document.createElement("a");
  a.href = qrSrc.value;
  a.download = `小节分享-${displayTitle.value}.png`;
  a.click();
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="分享"
    width="560px"
    align-center
    append-to-body
    destroy-on-close
    class="lesson-share-dialog"
  >
    <div class="lesson-share">
      <div class="lesson-share__qr">
        <img
          v-if="qrSrc"
          class="lesson-share__qr-img"
          :src="qrSrc"
          alt="小节分享二维码"
        >
        <span
          v-else
          class="lesson-share__qr-empty"
        >{{ qrError || "二维码生成中" }}</span>
      </div>
      <div class="lesson-share__body">
        <p class="lesson-share__brand">
          {{ brandLine }}
        </p>
        <p class="lesson-share__title">
          {{ displayTitle }}
        </p>
        <p class="lesson-share__link-row">
          <span>{{ watchVerb }}：</span>
          <a
            class="lesson-share__url"
            :href="displayUrl || undefined"
            target="_blank"
            rel="noopener noreferrer"
          >{{ displayUrl || "—" }}</a>
          <button
            type="button"
            class="lesson-share__copy-inline"
            :disabled="!displayUrl"
            @click="copyUrl"
          >
            复制
          </button>
        </p>
      </div>
    </div>

    <template #footer>
      <div class="lesson-share__footer">
        <UiButton
          variant="default"
          :disabled="!qrSrc"
          @click="downloadQr"
        >
          下载二维码
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!displayUrl"
          @click="copyShareText"
        >
          复制分享文本
        </UiButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.lesson-share {
  display: flex;
  gap: 16px;
  align-items: stretch;
}
.lesson-share__qr {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  min-height: 200px;
  padding: 12px;
  border-radius: 8px;
  background: #f5f6f8;
}
.lesson-share__qr-img {
  display: block;
  width: 176px;
  height: 176px;
  background: #fff;
}
.lesson-share__qr-empty {
  font-size: 13px;
  color: #909399;
  text-align: center;
  padding: 12px;
}
.lesson-share__body {
  flex: 1;
  min-width: 0;
  padding: 16px 18px;
  border-radius: 8px;
  background: #f5f6f8;
}
.lesson-share__brand,
.lesson-share__title,
.lesson-share__link-row {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: #303133;
}
.lesson-share__title {
  margin-top: 8px;
  font-weight: 500;
}
.lesson-share__link-row {
  margin-top: 10px;
  word-break: break-all;
}
.lesson-share__url {
  color: var(--color-primary);
  text-decoration: none;
}
.lesson-share__url:hover {
  text-decoration: underline;
}
.lesson-share__copy-inline {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}
.lesson-share__copy-inline:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}
.lesson-share__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}
</style>
