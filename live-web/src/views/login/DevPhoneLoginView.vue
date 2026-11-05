<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeNickname } from "@/api/watch";
import { ApiError } from "@/api/http";
import { devPhoneLogin } from "@/api/viewerAuth";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import { saveViewerSession } from "@/utils/viewerAuth";
import { safeViewerRedirect } from "@/utils/viewerLogin";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

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
    await router.replace(safeViewerRedirect(route.query.redirect));
  } catch (e) {
    error.value =
      e instanceof ApiError || e instanceof Error
        ? e.message
        : "登录失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!isDevLogin) {
    void router.replace({ name: "viewer-login", query: route.query });
  }
});
</script>

<template>
  <AudienceFrame title="手机号登录">
    <div class="body">
      <template v-if="isDevLogin">
        <p class="hint">
          仅开发环境可用：输入合法手机号即可登录；未注册将自动注册。
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
            :disabled="loading"
            @input="onPhoneInput"
            @keyup.enter="onLogin"
          >
        </div>

        <p
          v-if="error"
          class="error"
        >
          {{ error }}
        </p>

        <button
          type="button"
          class="btn"
          :disabled="!canSubmit"
          @click="onLogin"
        >
          {{ loading ? "登录中…" : "登录" }}
        </button>
      </template>

      <p
        v-else
        class="hint"
      >
        观众登录请使用微信小程序。本页明文手机号登录仅本地开发可用。
      </p>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.body {
  padding: 16px 16px 24px;
}
.hint {
  margin: 0 0 20px;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8c;
}
.field {
  height: 48px;
  padding: 0 14px;
  box-sizing: border-box;
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
.error {
  margin: 10px 0 0;
  font-size: 13px;
  color: #ff4d4f;
}
.btn {
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
.btn:disabled {
  background: #91bfff;
  cursor: not-allowed;
}
</style>
