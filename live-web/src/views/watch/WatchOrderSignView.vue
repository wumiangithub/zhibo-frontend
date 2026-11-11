<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { useToast } from "@/composables/useToast";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { backOrReplace } from "@/utils/navigation";
import { loadViewerPendingSignSession } from "@/utils/viewerPendingSignSession";

/**
 * 法大大 UAT 响应头限制嵌套域名：
 * frame-ancestors / X-Frame-Options ALLOW-FROM 仅
 * ia-background-h5.scqkxx.com、grctest-h5.scqkxx.com、wx.qkyqubit.cn；
 * 另有 SAMEORIGIN。本站 live-web 不在白名单 → iframe 空白。
 * 因此顶层跳转打开 signUrl，不用 iframe。
 */
const OPENED_PREFIX = "zhibo.viewerSignOpened.";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const activityId = String(route.params.id ?? "").trim();
const orderId = String(route.query.orderId ?? "").trim();
const inMiniProgram = isLikelyMiniProgramWebView();

const signUrl = ref("");
const ready = ref(false);
/** 是否已跳去过第三方；从签署页返回后为 true，避免再次自动跳转死循环 */
const alreadyOpened = ref(false);

function openedKey(): string {
  return `${OPENED_PREFIX}${activityId}.${orderId}`;
}

function markOpened() {
  try {
    sessionStorage.setItem(openedKey(), "1");
  } catch {
    /* ignore */
  }
  alreadyOpened.value = true;
}

function openSignTopLevel() {
  const url = signUrl.value.trim();
  if (!url) {
    toast("签署链接无效");
    return;
  }
  markOpened();
  window.location.assign(url);
}

onMounted(() => {
  const row = loadViewerPendingSignSession(activityId, orderId);
  if (!row?.signUrl) {
    toast("签署链接无效，请重新实名认证");
    void router.replace({
      name: "watch-order-realname",
      params: { id: activityId },
      query: { orderId },
    });
    return;
  }
  signUrl.value = row.signUrl;
  ready.value = true;

  try {
    alreadyOpened.value = sessionStorage.getItem(openedKey()) === "1";
  } catch {
    alreadyOpened.value = false;
  }

  // 首次进入：顶层打开法大大；用户签完点浏览器返回会回到本页，不再自动跳
  if (!alreadyOpened.value) {
    openSignTopLevel();
  }
});

function goBack() {
  backOrReplace(router, {
    name: "watch-order-contract",
    params: { id: activityId },
    query: { orderId },
  });
}

/**
 * 法大大签完回跳尚未约定：本轮用手动确认进完成页，
 * 确认对方回跳规则后再改自动跳转。
 */
function markSigned() {
  try {
    sessionStorage.removeItem(openedKey());
  } catch {
    /* ignore */
  }
  void router.replace({
    name: "watch-order-sign-done",
    params: { id: activityId },
    query: { orderId },
  });
}
</script>

<template>
  <div class="sg-root">
    <UiPageHeader
      v-if="!inMiniProgram"
      title="签约"
      back-text=""
      @back="goBack"
    />

    <div
      v-if="ready"
      class="sg-body"
    >
      <p class="sg-title">
        {{ alreadyOpened ? "签署页已打开" : "正在打开签署页…" }}
      </p>
      <p class="sg-tip">
        签约由法大大提供，需整页打开（对方禁止 iframe 嵌套本站域名）。
        签完后请用浏览器返回本页，再点「我已完成签署」。回跳地址确认后会改为自动进入完成页。
      </p>

      <button
        type="button"
        class="sg-primary"
        @click="openSignTopLevel"
      >
        {{ alreadyOpened ? "重新打开签署页" : "打开签署页" }}
      </button>

      <button
        type="button"
        class="sg-secondary"
        @click="markSigned"
      >
        我已完成签署
      </button>
    </div>
  </div>
</template>

<style scoped>
.sg-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.sg-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 32px 20px calc(24px + env(safe-area-inset-bottom, 0px));
}

.sg-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
}

.sg-tip {
  margin: 14px 0 28px;
  font-size: 13px;
  line-height: 1.55;
  color: #5c6570;
  text-align: center;
}

.sg-primary {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #2f6bff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.sg-primary:active {
  background: #2558db;
}

.sg-secondary {
  margin-top: 12px;
  width: 100%;
  height: 48px;
  border: 1px solid #d5dbe6;
  border-radius: 10px;
  background: #fff;
  color: #1f2329;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.sg-secondary:active {
  background: #f0f2f5;
}
</style>
