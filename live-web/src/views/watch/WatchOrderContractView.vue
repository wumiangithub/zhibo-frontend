<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { useToast } from "@/composables/useToast";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { backOrReplace } from "@/utils/navigation";
import {
  loadViewerPendingSignSession,
  type ViewerPendingSignSession,
} from "@/utils/viewerPendingSignSession";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const activityId = String(route.params.id ?? "").trim();
const orderId = String(route.query.orderId ?? "").trim();
const inMiniProgram = isLikelyMiniProgramWebView();

const session = ref<ViewerPendingSignSession | null>(null);
const ready = ref(false);

onMounted(() => {
  const row = loadViewerPendingSignSession(activityId, orderId);
  if (!row?.signUrl) {
    toast("请先完成实名认证");
    void router.replace({
      name: "watch-order-realname",
      params: { id: activityId },
      query: { orderId },
    });
    return;
  }
  session.value = row;
  ready.value = true;
});

function goBack() {
  backOrReplace(router, {
    name: "watch-order-realname",
    params: { id: activityId },
    query: { orderId },
  });
}

function goSign() {
  if (!session.value?.signUrl) {
    toast("签署链接无效，请重新实名认证");
    return;
  }
  void router.push({
    name: "watch-order-sign",
    params: { id: activityId },
    query: { orderId },
  });
}
</script>

<template>
  <div class="ct-root">
    <UiPageHeader
      v-if="!inMiniProgram"
      title="签署合同"
      back-text=""
      @back="goBack"
    />

    <div
      v-if="ready && session"
      class="ct-body"
    >
      <nav
        class="ct-steps"
        aria-label="办理进度"
      >
        <div class="ct-step done">
          <span class="ct-step-dot">✓</span>
          <span>支付</span>
        </div>
        <span class="ct-step-line on" />
        <div class="ct-step done">
          <span class="ct-step-dot">✓</span>
          <span>实名认证</span>
        </div>
        <span class="ct-step-line on" />
        <div class="ct-step active">
          <span class="ct-step-dot">3</span>
          <span>签署合同</span>
        </div>
      </nav>

      <section class="ct-section">
        <h2 class="ct-section-title">
          我的合同
        </h2>
        <div class="ct-card">
          <p class="ct-card-name">
            {{ session.contractTitle }}
          </p>
        </div>
      </section>
    </div>

    <div
      v-if="ready && session"
      class="ct-foot"
    >
      <button
        type="button"
        class="ct-primary"
        @click="goSign"
      >
        立即签署
      </button>
    </div>
  </div>
</template>

<style scoped>
.ct-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.ct-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 12px 24px;
  -webkit-overflow-scrolling: touch;
}

.ct-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #8a9199;
}

.ct-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ct-step.active,
.ct-step.done {
  color: #2f6bff;
}

.ct-step.active {
  font-weight: 600;
}

.ct-step-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #d5dbe6;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.ct-step.active .ct-step-dot,
.ct-step.done .ct-step-dot {
  background: #2f6bff;
}

.ct-step-line {
  width: 28px;
  height: 2px;
  background: #d5dbe6;
  border-radius: 1px;
}

.ct-step-line.on {
  background: #2f6bff;
}

.ct-section-title {
  margin: 0 4px 10px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.ct-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 14px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}

.ct-card-name {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2329;
  word-break: break-all;
}

.ct-foot {
  flex: none;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.04);
}

.ct-primary {
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

.ct-primary:active {
  background: #2558db;
}
</style>
