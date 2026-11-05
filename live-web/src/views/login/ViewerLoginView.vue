<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getViewerUserInfo } from "@/api/viewerAuth";
import { useToast } from "@/composables/useToast";
import {
  clearViewerSession,
  getViewerAccessToken,
  getViewerPhoneMasked,
  saveViewerSession,
} from "@/utils/viewerAuth";
import {
  isViewerLoginRequiredError,
  safeViewerRedirect,
  tryRefreshViewerSession,
} from "@/utils/viewerLogin";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

/** 对齐小程序：仅 Vite 开发构建展示明文手机号入口 */
const showDevLogin = import.meta.env.DEV;

const agreed = ref(false);
const phoneMasked = ref("");

function redirectTarget(): string {
  return safeViewerRedirect(route.query.redirect);
}

function needAgree() {
  toast("请先阅读并同意用户协议和隐私协议");
}

function onToggleAgree() {
  agreed.value = !agreed.value;
}

function onPhoneLogin() {
  if (!agreed.value) {
    needAgree();
    return;
  }
  toast("请在微信小程序内完成手机号授权登录");
}

function onWechatLogin() {
  if (!agreed.value) {
    needAgree();
    return;
  }
  toast("请在微信小程序内完成微信授权登录");
}

function onOtherLogin() {
  if (!showDevLogin) return;
  if (!agreed.value) {
    needAgree();
    return;
  }
  void router.push({
    name: "viewer-dev-login",
    query: route.query.redirect ? { redirect: String(route.query.redirect) } : {},
  });
}

function openAgreement(kind: "user" | "privacy") {
  void router.push({ name: kind === "privacy" ? "agreement-privacy" : "agreement-user" });
}

async function bounceIfLoggedIn() {
  phoneMasked.value = getViewerPhoneMasked();
  if (!getViewerAccessToken()) return;

  async function enter() {
    const user = await getViewerUserInfo();
    saveViewerSession({ user });
    phoneMasked.value = user.phoneMasked?.trim() || "";
    await router.replace(redirectTarget());
  }

  try {
    await enter();
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) return;
    const refreshed = await tryRefreshViewerSession();
    if (!refreshed) {
      clearViewerSession();
      phoneMasked.value = "";
      return;
    }
    try {
      await enter();
    } catch {
      clearViewerSession();
      phoneMasked.value = "";
    }
  }
}

onMounted(() => {
  void bounceIfLoggedIn();
});
</script>

<template>
  <div class="stage">
    <div class="sheet">
      <div class="hero">
        <span class="geo geo-a" />
        <span class="geo geo-b" />
        <span class="geo geo-c" />
        <p
          v-if="phoneMasked"
          class="phone"
        >
          {{ phoneMasked }}
        </p>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn btn-phone"
          @click="onPhoneLogin"
        >
          <img
            class="icon"
            src="/audience/phone.png"
            alt=""
          >
          <span>授权手机号快捷登录</span>
        </button>

        <button
          type="button"
          class="btn btn-wechat"
          @click="onWechatLogin"
        >
          <img
            class="icon"
            src="/audience/wechat.png"
            alt=""
          >
          <span>微信一键授权登录</span>
        </button>

        <div class="agree">
          <button
            type="button"
            class="check"
            :class="{ on: agreed }"
            aria-label="同意协议"
            @click="onToggleAgree"
          >
            <span
              v-if="agreed"
              class="mark"
            />
          </button>
          <p class="agree-text">
            <button
              type="button"
              class="muted"
              @click="onToggleAgree"
            >
              我已阅读并同意：
            </button>
            <button
              type="button"
              class="link"
              @click="openAgreement('user')"
            >
              《用户协议》
            </button>
            <span class="muted">和</span>
            <button
              type="button"
              class="link"
              @click="openAgreement('privacy')"
            >
              《隐私协议》
            </button>
          </p>
        </div>

        <button
          v-if="showDevLogin"
          type="button"
          class="other"
          @click="onOtherLogin"
        >
          其他登录方式
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  min-height: 100dvh;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}
.hero {
  position: relative;
  height: 210px;
  overflow: hidden;
  background: linear-gradient(180deg, #cfe8ff 0%, #e8f3ff 55%, #ffffff 100%);
}
.geo {
  position: absolute;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.geo-a {
  width: 80px;
  height: 80px;
  left: 24px;
  top: 36px;
  transform: rotate(18deg);
}
.geo-b {
  width: 60px;
  height: 60px;
  right: 40px;
  top: 24px;
  transform: rotate(-12deg);
}
.geo-c {
  width: 45px;
  height: 45px;
  right: 80px;
  top: 90px;
  transform: rotate(28deg);
  opacity: 0.7;
}
.phone {
  position: relative;
  z-index: 1;
  margin: 100px 0 0;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: #111111;
  letter-spacing: 1px;
}
.actions {
  flex: 1;
  padding: 24px 18% 40px;
  display: flex;
  flex-direction: column;
}
.btn {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 999px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn + .btn {
  margin-top: 22px;
}
.btn-phone {
  background: #1677ff;
}
.btn-wechat {
  background: #07c160;
}
.icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
  object-fit: contain;
}
.agree {
  margin-top: 20px;
  margin-left: -12%;
  margin-right: -12%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.check {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  border-radius: 50%;
  border: 1px solid #c0c4cc;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  cursor: pointer;
}
.check.on {
  border-color: #1677ff;
  background: #1677ff;
}
.mark {
  width: 7px;
  height: 4px;
  border-left: 1.5px solid #ffffff;
  border-bottom: 1.5px solid #ffffff;
  transform: rotate(-45deg);
  margin-top: -1px;
}
.agree-text {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
}
.muted,
.link {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
}
.muted {
  color: #8c8c8c;
}
.link {
  color: #1677ff;
}
.other {
  margin-top: 24px;
  border: 0;
  background: transparent;
  color: #8c8c8c;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
}
</style>
