<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeNickname } from "@/api/watch";
import { ApiError } from "@/api/http";
import { devPhoneLogin } from "@/api/viewerAuth";
import { useToast } from "@/composables/useToast";
import { saveViewerSession } from "@/utils/viewerAuth";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

/** 对齐小程序：仅 Vite 开发构建可用明文手机号造号 */
const isDevLogin = import.meta.env.DEV;

const phone = ref("");
const loading = ref(false);
const error = ref("");

const canSubmit = computed(
  () => /^1\d{10}$/.test(phone.value) && !loading.value,
);

function onPhoneInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value || "";
  phone.value = raw.replace(/\D/g, "").slice(0, 11);
  error.value = "";
}

function safeRedirect(): string {
  const raw = String(route.query.redirect ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

async function onLogin() {
  if (!isDevLogin) {
    toast("请从微信小程序进入登录");
    return;
  }
  if (loading.value) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = "请输入正确的手机号";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const data = await devPhoneLogin(phone.value);
    saveViewerSession(data);
    const nick = data.user?.nickname?.trim();
    if (nick) storeNickname(nick);
    toast("登录成功");
    await router.replace(safeRedirect());
  } catch (e) {
    error.value =
      e instanceof ApiError || e instanceof Error
        ? e.message
        : "登录失败";
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/");
}
</script>

<template>
  <div class="login">
    <header class="login__nav">
      <button
        type="button"
        class="login__back"
        aria-label="返回"
        @click="goBack"
      >
        ‹
      </button>
      <h1 class="login__title">手机号登录</h1>
    </header>

    <template v-if="isDevLogin">
      <p class="login__hint">
        仅开发环境可用：输入合法手机号即可登录；未注册将自动注册。
      </p>

      <div class="login__field">
        <span class="login__label">手机号</span>
        <input
          class="login__input"
          type="tel"
          inputmode="numeric"
          maxlength="11"
          placeholder="请输入手机号"
          :value="phone"
          :disabled="loading"
          @input="onPhoneInput"
          @keyup.enter="onLogin"
        >
      </div>

      <p
        v-if="error"
        class="login__error"
      >
        {{ error }}
      </p>

      <button
        type="button"
        class="login__btn"
        :disabled="!canSubmit"
        @click="onLogin"
      >
        {{ loading ? "登录中…" : "登录" }}
      </button>
    </template>

    <template v-else>
      <p class="login__hint">
        观众登录请使用微信小程序。本页明文手机号登录仅本地开发可用。
      </p>
    </template>
  </div>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
  padding: 0 16px 24px;
}
.login__nav {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0 -16px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.login__back {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  color: #111;
  padding: 4px 10px;
  cursor: pointer;
}
.login__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.login__hint {
  margin: 0 0 20px;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8c;
}
.login__field {
  height: 48px;
  padding: 0 14px;
  box-sizing: border-box;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  display: flex;
  align-items: center;
  background: #ffffff;
}
.login__label {
  width: 60px;
  flex-shrink: 0;
  font-size: 15px;
  color: #111111;
}
.login__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  font-size: 15px;
  color: #111111;
  background: transparent;
}
.login__input::placeholder {
  color: #bfbfbf;
}
.login__error {
  margin: 10px 0 0;
  font-size: 13px;
  color: #ff4d4f;
}
.login__btn {
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
.login__btn:disabled {
  background: #91bfff;
  cursor: not-allowed;
}
</style>
