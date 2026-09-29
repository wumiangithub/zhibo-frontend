<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog, ElInput, ElMessage } from "element-plus";
import UiButton from "@/components/ui/UiButton.vue";
import { useToast } from "@/composables/useToast";

export type ShareTabKey = "poster" | "link" | "qrcode" | "terminal";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 直播标题 */
    title: string;
    /** 本站观看长链接 */
    watchUrl: string;
    /** 短链，缺省与 watchUrl 相同 */
    shortUrl?: string;
    /** 预览文案第一行 */
    brandLine?: string;
  }>(),
  {
    shortUrl: "",
    brandLine: "钱坤云直播平台 发现一场精彩直播",
  },
);

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
}>();

const { toast } = useToast();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const activeTab = ref<ShareTabKey>("link");

const tabs: { key: ShareTabKey; label: string }[] = [
  { key: "poster", label: "海报" },
  { key: "link", label: "链接" },
  { key: "qrcode", label: "二维码" },
  { key: "terminal", label: "公共终端" },
];

const longUrl = computed(() => props.watchUrl || "");
const displayShortUrl = computed(() => props.shortUrl || props.watchUrl || "");

const shareContent = computed(() => {
  const lines = [
    props.brandLine,
    props.title || "直播",
    `点击观看：${displayShortUrl.value}`,
  ];
  return lines.join("\n");
});

function onTab(key: ShareTabKey) {
  if (key === "link") {
    activeTab.value = key;
    return;
  }
  toast(`「${tabs.find((t) => t.key === key)?.label}」暂未开放`);
}

async function copyText(text: string, okMsg: string) {
  if (!text) {
    ElMessage.warning("暂无可复制内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(okMsg);
  } catch {
    ElMessage.error("复制失败，请手动选择复制");
  }
}

function copyLongLink() {
  void copyText(longUrl.value, "长链接已复制");
}

function copyLink() {
  void copyText(displayShortUrl.value, "链接已复制");
}

function copyContent() {
  void copyText(shareContent.value, "分享内容已复制");
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) activeTab.value = "link";
  },
);
</script>

<template>
  <ElDialog
    v-model="visible"
    title="分享"
    width="520px"
    align-center
    destroy-on-close
    class="share-dialog"
  >
    <div class="share-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="share-tab"
        :class="{ 'is-active': activeTab === t.key }"
        @click="onTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div
      v-if="activeTab === 'link'"
      class="share-link"
    >
      <p class="share-link__hint">给用户分享这个直播：</p>
      <div class="share-preview">
        <p class="share-preview__brand">{{ brandLine }}</p>
        <p class="share-preview__title">{{ title || "直播" }}</p>
        <p class="share-preview__watch">
          点击观看：
          <a
            class="share-preview__url"
            :href="displayShortUrl"
            target="_blank"
            rel="noopener noreferrer"
          >{{ displayShortUrl }}</a>
        </p>
      </div>

      <div class="share-long">
        <ElInput
          :model-value="longUrl"
          readonly
          disabled
        />
        <button
          type="button"
          class="share-long__copy"
          @click="copyLongLink"
        >
          复制长链接
        </button>
      </div>
    </div>

    <template #footer>
      <div class="share-footer">
        <UiButton
          variant="default"
          @click="copyLink"
        >
          复制链接
        </UiButton>
        <UiButton
          variant="primary"
          @click="copyContent"
        >
          复制内容
        </UiButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.share-tabs {
  display: flex;
  gap: 4px;
  margin: -8px 0 16px;
  border-bottom: 1px solid var(--color-border-light);
}
.share-tab {
  border: 0;
  background: transparent;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.share-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}
.share-link__hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.share-preview {
  padding: 16px;
  border-radius: 6px;
  background: #f5f6f8;
  margin-bottom: 14px;
  line-height: 1.6;
}
.share-preview__brand,
.share-preview__title,
.share-preview__watch {
  margin: 0;
  font-size: 13px;
  color: var(--color-text);
}
.share-preview__title {
  margin-top: 4px;
  font-weight: 500;
}
.share-preview__watch {
  margin-top: 4px;
}
.share-preview__url {
  color: var(--color-primary);
  word-break: break-all;
  text-decoration: none;
}
.share-preview__url:hover {
  text-decoration: underline;
}
.share-long {
  display: flex;
  align-items: center;
  gap: 12px;
}
.share-long :deep(.el-input) {
  flex: 1;
}
.share-long__copy {
  flex: none;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  white-space: nowrap;
}
.share-long__copy:hover {
  opacity: 0.85;
}
.share-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  width: 100%;
}
</style>
