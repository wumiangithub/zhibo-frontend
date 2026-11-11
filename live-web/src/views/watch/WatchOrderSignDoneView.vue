<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { watchRoomRoute } from "@/composables/useViewerOrderFlow";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { backOrHome, backOrReplace } from "@/utils/navigation";
import { loadViewerOrderCheckoutSession } from "@/utils/viewerOrderCheckoutSession";
import { clearViewerPendingSignSession } from "@/utils/viewerPendingSignSession";

const route = useRoute();
const router = useRouter();

const activityId = String(route.params.id ?? "").trim();
const orderId = String(route.query.orderId ?? "").trim();
const inMiniProgram = isLikelyMiniProgramWebView();

onMounted(() => {
  clearViewerPendingSignSession(activityId, orderId);
});

function goBack() {
  const session = loadViewerOrderCheckoutSession(activityId);
  backOrReplace(
    router,
    watchRoomRoute(activityId, session?.watchMode ?? "live"),
  );
}

function goHome() {
  backOrHome(router);
}
</script>

<template>
  <div class="done-root">
    <UiPageHeader
      v-if="!inMiniProgram"
      title="完成"
      back-text=""
      @back="goBack"
    />

    <div class="done-body">
      <div class="done-hero">
        <span
          class="done-check"
          aria-hidden="true"
        >✓</span>
        <h2 class="done-title">
          全部完成
        </h2>
        <p class="done-sub">
          实名认证与合同签署已完成
        </p>
        <p class="done-note">
          商品已正式生效
        </p>
      </div>

      <button
        type="button"
        class="done-primary"
        @click="goHome"
      >
        返回首页
      </button>
    </div>
  </div>
</template>

<style scoped>
.done-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.done-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px calc(24px + env(safe-area-inset-bottom, 0px));
}

.done-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-top: 40px;
}

.done-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: #1dbf6e;
  color: #fff;
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.done-title {
  margin: 20px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
}

.done-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: #5c6570;
}

.done-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: #8a9199;
}

.done-primary {
  margin-top: auto;
  width: 100%;
  max-width: 400px;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #2f6bff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.done-primary:active {
  background: #2558db;
}
</style>
