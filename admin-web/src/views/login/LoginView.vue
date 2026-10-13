<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { UserFilled, Unlock, View, Hide } from "@element-plus/icons-vue";
import { fetchCaptcha, postLogin } from "@/api/auth";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/stores/auth";
import { encryptLoginPassword } from "@/utils/passwordAes";
import {
  clearRememberedCredentials,
  hasRememberedAccount,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from "@/utils/authSession";
import loginBg from "@/assets/images/logo.png";
import {
  clearWxLoginPending,
  loadWxLoginPending,
  remainingExpiresInSec,
} from "@/utils/wxLoginPending";
import WechatLoginDialog from "./WechatLoginDialog.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const form = reactive({
  userAccount: "",
  password: "",
  captchaCode: "",
  remember: false,
});

const captchaId = ref("");
const captchaImage = ref("");
const showPassword = ref(false);
const accountError = ref("");
const passwordError = ref("");
const submitting = ref(false);

const wechatOpen = ref(false);
const wechatState = ref("");
const wechatExpiresIn = ref(180);
/** 顶层跳转 callback 后再回 /login：只续轮询 */
const wechatResumeOnly = ref(false);

/** 本地「记住」缓存：选中/输入匹配账号时补填密码（浏览器下拉往往只带用户名） */
const rememberedCache = ref<{ userAccount: string; password: string } | null>(
  null,
);

async function refreshCaptcha() {
  try {
    const data = await fetchCaptcha();
    captchaId.value = data.captchaId;
    captchaImage.value = data.imageBase64;
    form.captchaCode = "";
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : "验证码加载失败");
  }
}

async function refreshRememberedCache() {
  if (!hasRememberedAccount()) {
    rememberedCache.value = null;
    return;
  }
  rememberedCache.value = await loadRememberedCredentials();
}

/** 账号与本地记住项一致且密码为空时，补上密码 */
async function fillPasswordIfRememberedAccount() {
  const account = form.userAccount.trim();
  if (!account) return;
  if (!rememberedCache.value && hasRememberedAccount()) {
    await refreshRememberedCache();
  }
  const remembered = rememberedCache.value;
  if (!remembered) return;
  if (remembered.userAccount === account && !form.password) {
    form.password = remembered.password;
    passwordError.value = "";
  }
}

function onAccountBlur() {
  accountError.value = form.userAccount.trim() ? "" : "请输入账号";
  void fillPasswordIfRememberedAccount();
}

function onPasswordBlur() {
  passwordError.value = form.password ? "" : "请输入密码";
}

async function onRememberChange(checked: boolean) {
  form.remember = checked;
  if (!checked) {
    clearRememberedCredentials();
    rememberedCache.value = null;
  }
}

watch(
  () => form.userAccount,
  () => {
    void fillPasswordIfRememberedAccount();
  },
);

async function submit() {
  onAccountBlur();
  onPasswordBlur();
  if (accountError.value || passwordError.value) return;
  if (!form.captchaCode.trim()) {
    ElMessage.warning("请输入验证码");
    return;
  }
  if (!captchaId.value) {
    ElMessage.warning("请先获取验证码");
    await refreshCaptcha();
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    let encrypted: string;
    try {
      encrypted = await encryptLoginPassword(form.password);
    } catch (encErr) {
      const tip =
        encErr instanceof Error && encErr.message
          ? encErr.message
          : "密码加密失败，请检查本地登录密钥配置";
      ElMessage.error(tip);
      return;
    }
    const data = await postLogin({
      userAccount: form.userAccount.trim(),
      password: encrypted,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    });
    // 账号密码登录成功即写入/清除「记住」；不等微信二次验证
    if (form.remember) {
      try {
        await saveRememberedCredentials(form.userAccount.trim(), form.password);
        rememberedCache.value = {
          userAccount: form.userAccount.trim(),
          password: form.password,
        };
      } catch (e) {
        console.warn("记住密码写入失败", e);
      }
    } else {
      clearRememberedCredentials();
      rememberedCache.value = null;
    }
    wechatResumeOnly.value = false;
    wechatState.value = data.state;
    wechatExpiresIn.value = data.expiresIn > 0 ? data.expiresIn : 180;
    wechatOpen.value = true;
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "登录失败";
    ElMessage.error(msg);
    await refreshCaptcha();
  } finally {
    submitting.value = false;
  }
}

/** 去掉续登约定参数，避免普通刷新再次 poll */
function clearWxDoneQuery() {
  if (route.query.wx_done == null && route.query.state == null) return;
  const nextQuery = { ...route.query };
  delete nextQuery.wx_done;
  delete nextQuery.state;
  void router.replace({ path: "/login", query: nextQuery });
}

async function onWechatSuccess(payload: {
  accessToken: string;
  user: import("@/api/auth").AuthUser;
}) {
  clearWxLoginPending();
  wechatResumeOnly.value = false;
  clearWxDoneQuery();
  // 勾选记住 → localStorage 下次免登；不勾 → sessionStorage，关浏览器需重登
  auth.applySession(payload.accessToken, payload.user, {
    persist: form.remember,
  });
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
  void router.replace(redirect || "/");
}

function onWechatAbandoned() {
  clearWxLoginPending();
  wechatResumeOnly.value = false;
  clearWxDoneQuery();
}

/**
 * 仅当 URL 带 `wx_done=1`（后端 callback HTML 跳回约定）时，
 * 才用 sessionStorage 的 state 做 resumeOnly 轮询；普通打开 /login 绝不自动 poll。
 */
function resumeWxLoginIfPending() {
  if (String(route.query.wx_done) !== "1") return;
  const pending = loadWxLoginPending();
  if (!pending) {
    clearWxDoneQuery();
    return;
  }
  wechatState.value = pending.state;
  wechatExpiresIn.value = remainingExpiresInSec(pending);
  wechatResumeOnly.value = true;
  wechatOpen.value = true;
}

onMounted(() => {
  void (async () => {
    await refreshCaptcha();
    await refreshRememberedCache();
    if (rememberedCache.value) {
      form.remember = true;
      form.userAccount = rememberedCache.value.userAccount;
      form.password = rememberedCache.value.password;
    } else if (hasRememberedAccount()) {
      form.remember = true;
    }
    resumeWxLoginIfPending();
  })();
});
</script>

<template>
  <div
    class="login-page"
    :style="{ backgroundImage: `url(${loginBg})` }"
  >
    <div class="login-panel">
      <form
        class="login-card"
        autocomplete="on"
        @submit.prevent="submit"
      >
        <h1 class="login-title">
          钱坤云直播平台登录
        </h1>

        <div class="field-wrap">
          <div
            class="field-input-box"
            :class="{ 'is-error': accountError }"
          >
            <el-icon class="field-icon">
              <UserFilled />
            </el-icon>
            <input
              v-model="form.userAccount"
              class="field-input"
              type="text"
              name="username"
              autocomplete="username"
              placeholder="请输入账号"
              @blur="onAccountBlur"
            >
          </div>
          <p
            v-if="accountError"
            class="field-error"
          >
            {{ accountError }}
          </p>
        </div>

        <div class="field-wrap">
          <div
            class="field-input-box"
            :class="{ 'is-error': passwordError }"
          >
            <el-icon class="field-icon">
              <Unlock />
            </el-icon>
            <input
              v-model="form.password"
              class="field-input"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              @blur="onPasswordBlur"
            >
            <button
              type="button"
              class="eye-btn"
              tabindex="-1"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <el-icon>
                <View v-if="showPassword" />
                <Hide v-else />
              </el-icon>
            </button>
          </div>
          <p
            v-if="passwordError"
            class="field-error"
          >
            {{ passwordError }}
          </p>
        </div>

        <div class="field-wrap captcha-row">
          <div class="field-input-box captcha-box">
            <input
              v-model="form.captchaCode"
              class="field-input captcha-input"
              type="text"
              name="captcha"
              autocomplete="off"
              placeholder="请输入图形验证码"
            >
          </div>
          <button
            type="button"
            class="captcha-img-btn"
            title="点击刷新"
            @click="refreshCaptcha"
          >
            <img
              v-if="captchaImage"
              :src="captchaImage"
              alt="验证码"
              class="captcha-img"
            >
            <span
              v-else
              class="captcha-placeholder"
            >加载中</span>
          </button>
        </div>

        <button
          type="submit"
          class="submit-btn"
          :disabled="submitting"
        >
          {{ submitting ? "登录中…" : "登录" }}
        </button>

        <div class="login-footer">
          <label class="remember">
            <input
              type="checkbox"
              class="remember-check"
              :checked="form.remember"
              @change="onRememberChange(($event.target as HTMLInputElement).checked)"
            >
            <span>记住用户名和密码</span>
          </label>
          <span class="login-help">若登录异常，请联系管理员</span>
        </div>
      </form>
    </div>

    <WechatLoginDialog
      v-model="wechatOpen"
      :state="wechatState"
      :expires-in="wechatExpiresIn"
      :resume-only="wechatResumeOnly"
      @success="onWechatSuccess"
      @abandoned="onWechatAbandoned"
    />
  </div>
</template>

<style scoped>
.login-page {
  box-sizing: border-box;
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 40px 8% 40px 24px;
  background-color: #e8f2fc;
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.login-panel {
  flex: none;
  width: 420px;
  max-width: 100%;
}

.login-card {
  box-sizing: border-box;
  width: 100%;
  padding: 40px 36px 28px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(47, 84, 235, 0.08);
}

.login-title {
  margin: 0 0 32px;
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  letter-spacing: 0.02em;
}

.field-wrap {
  margin-bottom: 18px;
}

.field-input-box {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 24px;
  background: #f5f6f8;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}

.field-input-box:focus-within {
  border-color: var(--color-primary);
  background: #fff;
  box-shadow: 0 0 0 2px var(--color-primary-shadow);
}

.field-input-box.is-error {
  border-color: var(--color-danger);
}

.field-icon {
  flex: none;
  font-size: 18px;
  color: #bfbfbf;
}

.field-input {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  font-size: 14px;
  color: #333;
  outline: none;
}

.field-input::placeholder {
  color: #bfbfbf;
}

.eye-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #bfbfbf;
  cursor: pointer;
  font-size: 18px;
}

.eye-btn:hover {
  color: var(--color-text-secondary);
}

.field-error {
  margin: 6px 0 0 16px;
  font-size: 12px;
  color: var(--color-danger);
}

.captcha-row {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.captcha-box {
  flex: 1;
  min-width: 0;
}

.captcha-input {
  padding-left: 4px;
}

.captcha-img-btn {
  flex: none;
  box-sizing: border-box;
  width: 120px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #f5f6f8;
  cursor: pointer;
  overflow: hidden;
}

.captcha-img-btn:hover {
  opacity: 0.9;
}

.captcha-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-placeholder {
  font-size: 12px;
  color: #999;
}

.submit-btn {
  display: block;
  width: 100%;
  height: 48px;
  margin-top: 8px;
  border: 0;
  border-radius: 24px;
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.login-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  font-size: 13px;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.remember-check {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.login-help {
  flex: none;
  color: var(--color-text-placeholder);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .login-page {
    justify-content: center;
    padding: 24px 16px;
    background-position: left center;
  }

  .login-panel {
    width: 100%;
    max-width: 420px;
  }

  .login-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
