<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog } from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import { copyText } from "@/utils/copyText";
import { buildAudienceWatchUrl, buildHostInviteUrl } from "@/utils/liveLinks";

const PLATFORM_NAME = "钱坤云直播平台";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    activityId: string;
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

function shown(value: string | undefined) {
  const text = (value ?? "").trim();
  return text || "暂无";
}

const titleText = computed(() => shown(props.liveTitle));
const timeText = computed(() => shown(props.startTime));
const hostUrl = computed(() => buildHostInviteUrl(props.activityId));
const watchUrl = computed(() => buildAudienceWatchUrl(props.activityId));

const qrSrc = ref("");
const qrError = ref("");
let qrSeq = 0;

watch(
  () => [props.modelValue, hostUrl.value] as const,
  async ([open, url]) => {
    const seq = ++qrSeq;
    if (!open) return;
    qrSrc.value = "";
    qrError.value = "";
    if (!url.trim()) {
      qrError.value = "暂无主播链接";
      return;
    }
    try {
      const qrcode = await import("qrcode");
      const toDataURL = qrcode.toDataURL ?? qrcode.default.toDataURL;
      const dataUrl = await toDataURL(url, {
        margin: 1,
        width: 180,
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

const copyAllText = computed(() =>
  [
    PLATFORM_NAME,
    `直播名称：${titleText.value}`,
    `直播时间：${timeText.value}`,
    "主播链接：",
    hostUrl.value,
    "观众观看链接：",
    watchUrl.value,
  ].join("\n"),
);

function copyAll() {
  void copyText(copyAllText.value, "已复制");
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="邀请主播"
    width="680px"
    align-center
    append-to-body
    destroy-on-close
    class="invite-host-dialog"
  >
    <div class="invite-layout">
      <div class="invite-main">
        <p class="brand">{{ PLATFORM_NAME }}</p>
        <p class="line">
          <span>直播名称：</span>{{ titleText }}
        </p>
        <p class="line">
          <span>直播时间：</span>{{ timeText }}
        </p>
        <p class="line">主播链接：</p>
        <p class="url">{{ hostUrl }}</p>
        <p class="line">观众观看链接：</p>
        <p class="url">{{ watchUrl }}</p>
        <UiButton
          class="copy-all"
          variant="primary"
          @click="copyAll"
        >
          复制全部信息
        </UiButton>
      </div>
      <div class="invite-qr">
        <img
          v-if="qrSrc"
          class="invite-qr__img"
          :src="qrSrc"
          alt="主播邀请二维码"
        >
        <span
          v-else
          class="invite-qr__empty"
        >{{ qrError || "二维码生成中" }}</span>
      </div>
    </div>
    <p class="invite-foot">二维码与邀请链接均为主播专用，请勿随意转发</p>
  </ElDialog>
</template>

<style scoped>
.invite-layout {
  display: flex;
  align-items: stretch;
  gap: 16px;
}
.invite-main {
  flex: 1;
  min-width: 0;
  padding: 18px 20px 16px;
  border-radius: 8px;
  background: #f5f7fb;
}
.brand {
  margin: 0 0 14px;
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
.line + .line,
.url + .line {
  margin-top: 8px;
}
.url {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.copy-all {
  margin-top: 16px;
}
.invite-qr {
  flex: none;
  width: 200px;
  padding: 16px;
  border-radius: 8px;
  background: #f5f7fb;
  display: flex;
  align-items: center;
  justify-content: center;
}
.invite-qr__img {
  display: block;
  width: 168px;
  height: 168px;
  background: #fff;
}
.invite-qr__empty {
  font-size: 12px;
  color: var(--color-text-placeholder);
  text-align: center;
}
.invite-foot {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-placeholder);
}
</style>
