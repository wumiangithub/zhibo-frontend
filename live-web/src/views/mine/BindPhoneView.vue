<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import { setViewerPhoneMasked } from "@/utils/viewerAuth";

const router = useRouter();
const { toast } = useToast();

const phone = ref("");
const code = ref("");
const countdown = ref(0);
const loading = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

function digits(raw: string, max: number) {
  return raw.replace(/\D/g, "").slice(0, max);
}

function onPhoneInput(e: Event) {
  phone.value = digits((e.target as HTMLInputElement).value || "", 11);
}

function onCodeInput(e: Event) {
  code.value = digits((e.target as HTMLInputElement).value || "", 6);
}

function onGetCode() {
  if (countdown.value > 0) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    toast("请输入正确手机号");
    return;
  }
  toast("验证码已发送");
  countdown.value = 60;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      countdown.value = 0;
      if (timer) clearInterval(timer);
      timer = undefined;
    }
  }, 1000);
}

function onBind() {
  if (loading.value) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    toast("请输入正确手机号");
    return;
  }
  if (!/^\d{4,6}$/.test(code.value)) {
    toast("请输入验证码");
    return;
  }
  loading.value = true;
  const masked = `${phone.value.slice(0, 3)}****${phone.value.slice(7)}`;
  setViewerPhoneMasked(masked);
  window.setTimeout(() => {
    loading.value = false;
    toast("绑定成功");
    window.setTimeout(() => {
      if (window.history.length > 1) router.back();
      else void router.replace({ name: "mine" });
    }, 400);
  }, 300);
}

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <AudienceFrame title="绑定手机号">
    <div class="page">
      <p class="hint">
        绑定后可用于登录、观看您拥有权益的直播/课程
      </p>
      <p class="note">
        当前只做页面。验证码不会真正发送，绑定结果只记在本机。
      </p>

      <div class="field">
        <span class="label">手机号</span>
        <input
          class="input"
          type="tel"
          inputmode="numeric"
          maxlength="11"
          placeholder="请输入手机号"
          :value="phone"
          @input="onPhoneInput"
        >
      </div>
      <div class="field">
        <span class="label">验证码</span>
        <input
          class="input"
          type="tel"
          inputmode="numeric"
          maxlength="6"
          placeholder="请输入验证码"
          :value="code"
          @input="onCodeInput"
        >
        <button
          type="button"
          class="code"
          :class="{ off: countdown > 0 }"
          @click="onGetCode"
        >
          {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
        </button>
      </div>

      <button
        type="button"
        class="bind"
        :disabled="loading"
        @click="onBind"
      >
        {{ loading ? "绑定中…" : "绑定" }}
      </button>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  padding: 16px 16px 24px;
  background: #ffffff;
}
.hint,
.note {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 18px;
  color: #8c8c8c;
}
.note {
  margin-bottom: 20px;
}
.field {
  height: 48px;
  padding: 0 14px;
  margin-bottom: 12px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  display: flex;
  align-items: center;
  background: #ffffff;
}
.label {
  width: 60px;
  flex-shrink: 0;
  font-size: 15px;
  color: #111111;
}
.input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  font-size: 15px;
  color: #111111;
  background: transparent;
}
.input::placeholder {
  color: #bfbfbf;
}
.code {
  flex-shrink: 0;
  margin-left: 8px;
  padding-left: 8px;
  border: 0;
  border-left: 1px solid #eeeeee;
  background: transparent;
  color: #8c8c8c;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}
.code.off {
  color: #bfbfbf;
  cursor: default;
}
.bind {
  display: block;
  width: 100%;
  margin-top: 32px;
  height: 44px;
  border: 0;
  border-radius: 6px;
  background: #1677ff;
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}
.bind:disabled {
  background: #91bfff;
  cursor: not-allowed;
}
</style>
