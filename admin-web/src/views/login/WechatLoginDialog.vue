<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { queryLoginState } from "@/api/auth";
import {
  mountWxLogin,
  resolveWechatSelfRedirect,
  type MountWxLoginResult,
} from "@/utils/wxLogin";
import {
  clearWxLoginPending,
  saveWxLoginPending,
} from "@/utils/wxLoginPending";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    state: string;
    /** 登录接口返回的秒数；超时提示重新登录 */
    expiresIn?: number;
    /**
     * 仅本地顶层跳后带回 `/login?wx_done=1`：只续轮询、不再挂二维码
     */
    resumeOnly?: boolean;
  }>(),
  { expiresIn: 180, resumeOnly: false },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  success: [
    payload: {
      accessToken: string;
      refreshToken: string | null;
      user: import("@/api/auth").AuthUser;
    },
  ];
  abandoned: [];
}>();

const containerId = "wx-login-qr-container";
const phase = ref<"scanning" | "waiting">("scanning");
const tip = ref("");
const polling = ref(false);

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let expireTimer: ReturnType<typeof setTimeout> | undefined;
let mountHandle: MountWxLoginResult | null = null;

function close() {
  emit("update:modelValue", false);
  if (polling.value) {
    emit("abandoned");
  }
}

function cleanupMount() {
  mountHandle?.dispose();
  mountHandle = null;
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = "";
}

function stopPoll(options?: { clearPending?: boolean }) {
  polling.value = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }
  if (expireTimer) {
    clearTimeout(expireTimer);
    expireTimer = undefined;
  }
  cleanupMount();
  if (options?.clearPending) {
    clearWxLoginPending();
  }
}

function enterWaiting(message: string) {
  if (phase.value === "waiting") return;
  phase.value = "waiting";
  tip.value = message;
  if (mountHandle?.iframe) {
    mountHandle.iframe.style.visibility = "hidden";
    mountHandle.iframe.style.position = "absolute";
    mountHandle.iframe.style.width = "0";
    mountHandle.iframe.style.height = "0";
  }
}

async function pollOnce() {
  if (!props.state || !polling.value) return;
  try {
    const data = await queryLoginState(props.state);
    if (!polling.value) return;
    if (data.status === 0) {
      pollTimer = setTimeout(() => void pollOnce(), 1500);
      return;
    }
    if (data.status === 1 && data.accessToken && data.user) {
      stopPoll({ clearPending: true });
      emit("success", {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        user: data.user,
      });
      emit("update:modelValue", false);
      return;
    }
    if (data.status === 2) {
      stopPoll({ clearPending: true });
      ElMessage.error(data.errorMsg || "微信验证失败");
      emit("update:modelValue", false);
      emit("abandoned");
      return;
    }
    if (data.status === 3) {
      stopPoll({ clearPending: true });
      ElMessage.warning("扫码已过期，请重新登录");
      emit("update:modelValue", false);
      emit("abandoned");
    }
  } catch (e) {
    if (!polling.value) return;
    pollTimer = setTimeout(() => void pollOnce(), 1500);
    console.warn(e);
  }
}

async function start() {
  stopPoll();
  if (!props.state) return;

  const selfRedirect = resolveWechatSelfRedirect();
  // 仅顶层跳路径需要 pending（回 /login?wx_done=1 续登）；iframe 路径同页 poll 即可
  if (!selfRedirect || props.resumeOnly) {
    saveWxLoginPending(props.state, props.expiresIn || 180);
  }

  if (props.resumeOnly) {
    phase.value = "waiting";
    tip.value = "正在完成微信登录，请稍候…";
  } else {
    phase.value = "scanning";
    tip.value = selfRedirect
      ? "请使用微信扫一扫，确认后本页自动登录"
      : "请使用微信扫一扫。确认后可能整页跳转；跳回登录页后将自动完成登录。";
    await nextTick();
    try {
      mountHandle = mountWxLogin({
        containerId,
        state: props.state,
        onLeaveWeixinDomain: () => {
          if (selfRedirect) {
            enterWaiting("正在等待微信确认，请稍候…");
          }
        },
      });
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "微信二维码加载失败");
      stopPoll({ clearPending: true });
      emit("update:modelValue", false);
      return;
    }
  }

  polling.value = true;
  const ttlMs = Math.max(30, props.expiresIn || 180) * 1000;
  expireTimer = setTimeout(() => {
    if (!polling.value) return;
    stopPoll({ clearPending: true });
    ElMessage.warning("扫码已超时，请重新登录");
    emit("update:modelValue", false);
    emit("abandoned");
  }, ttlMs);
  pollTimer = setTimeout(() => void pollOnce(), props.resumeOnly ? 300 : 1500);
}

watch(
  () => [props.modelValue, props.state, props.resumeOnly] as const,
  ([open, state]) => {
    if (open && state) {
      void start();
    } else {
      stopPoll();
    }
  },
);

onBeforeUnmount(() => stopPoll());
</script>

<template>
  <div
    v-if="modelValue"
    class="wx-mask"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wx-login-title"
  >
    <div class="wx-dialog">
      <button
        type="button"
        class="wx-close"
        aria-label="关闭"
        @click="close"
      >
        ×
      </button>
      <h2
        id="wx-login-title"
        class="wx-title"
      >
        微信登录
      </h2>
      <p class="wx-tip">
        {{ tip }}
      </p>
      <div class="wx-qr">
        <div
          v-show="phase === 'scanning'"
          :id="containerId"
          class="wx-qr-host"
        />
        <div
          v-if="phase === 'waiting'"
          class="wx-waiting"
        >
          <span class="wx-waiting-spin" />
          <p>正在完成微信登录…</p>
          <p class="wx-waiting-sub">
            确认后本页将自动登录
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wx-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.wx-dialog {
  position: relative;
  box-sizing: border-box;
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: 28px 24px 32px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 12px 40px rgba(47, 84, 235, 0.12);
}

.wx-close {
  position: absolute;
  top: 8px;
  right: 12px;
  border: 0;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: #999;
  cursor: pointer;
}

.wx-close:hover {
  color: #333;
}

.wx-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.wx-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.wx-qr {
  position: relative;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wx-qr-host {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wx-qr :deep(iframe) {
  max-width: 100%;
}

.wx-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: #333;
  font-size: 14px;
}

.wx-waiting p {
  margin: 0;
}

.wx-waiting-sub {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  max-width: 280px;
}

.wx-waiting-spin {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-primary-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: wx-spin 0.8s linear infinite;
}

@keyframes wx-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
