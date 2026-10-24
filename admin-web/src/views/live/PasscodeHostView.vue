<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enterByPasscode } from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import {
  PASSCODE_DEFAULT_NICKNAME,
  PASSCODE_HOST_CODE_QUERY,
  PASSCODE_HOST_NAME_QUERY,
  PASSCODE_STUDIO_PATH,
  savePasscodeStudioSession,
} from "@/utils/liveLinks";

const route = useRoute();
const router = useRouter();

const passcode = ref(
  typeof route.query[PASSCODE_HOST_CODE_QUERY] === "string"
    ? route.query[PASSCODE_HOST_CODE_QUERY].trim()
    : "",
);
const nickname = ref(
  typeof route.query[PASSCODE_HOST_NAME_QUERY] === "string"
    && route.query[PASSCODE_HOST_NAME_QUERY].trim()
    ? route.query[PASSCODE_HOST_NAME_QUERY].trim()
    : PASSCODE_DEFAULT_NICKNAME,
);

const submitting = ref(false);
const error = ref("");

const canSubmit = computed(
  () => passcode.value.trim().length > 0 && !submitting.value,
);

async function onEnter() {
  if (!canSubmit.value) return;
  submitting.value = true;
  error.value = "";
  try {
    const data = await enterByPasscode(passcode.value, nickname.value);
    const hostUrl = (data.hostUrl ?? "").trim();
    const activityId = (data.activityId ?? "").trim();
    if (!hostUrl || !activityId) {
      error.value = "暂无参会地址";
      return;
    }
    savePasscodeStudioSession({
      activityId,
      hostUrl,
      nickname: data.nickname,
    });
    await router.replace(PASSCODE_STUDIO_PATH);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "进入直播失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="passcode-host">
    <div class="passcode-host__shell">
      <header class="passcode-host__bar">
        <h1 class="passcode-host__title">口令开播</h1>
      </header>

      <div class="passcode-host__body">
        <div class="passcode-host__card">
          <label class="passcode-host__field">
            <span class="passcode-host__label">
              开播口令<span class="passcode-host__req">*</span>
            </span>
            <input
              v-model="passcode"
              class="passcode-host__input"
              type="text"
              inputmode="numeric"
              maxlength="16"
              autocomplete="off"
              placeholder="请输入开播口令"
            >
          </label>
          <label class="passcode-host__field">
            <span class="passcode-host__label">讲师名称</span>
            <input
              v-model="nickname"
              class="passcode-host__input"
              type="text"
              maxlength="30"
              autocomplete="off"
              placeholder="讲师"
            >
          </label>
        </div>

        <p
          v-if="error"
          class="passcode-host__error"
        >
          {{ error }}
        </p>
      </div>

      <div class="passcode-host__footer">
        <UiButton
          variant="primary"
          class="passcode-host__submit"
          :disabled="!canSubmit"
          @click="onEnter"
        >
          {{ submitting ? "开播中…" : "立即开播" }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.passcode-host {
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: #f5f6f8;
}
.passcode-host__shell {
  box-sizing: border-box;
  width: 100%;
  max-width: 800px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.passcode-host__bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #eceef2;
}
.passcode-host__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  color: #1f2329;
}
.passcode-host__body {
  flex: 1;
  padding: 12px 0 24px;
}
.passcode-host__card {
  background: #fff;
}
.passcode-host__field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0 16px;
  min-height: 52px;
  border-bottom: 1px solid #f0f1f3;
}
.passcode-host__field:last-child {
  border-bottom: 0;
}
.passcode-host__label {
  flex: none;
  width: 88px;
  font-size: 15px;
  line-height: 22px;
  color: #1f2329;
}
.passcode-host__req {
  margin-left: 2px;
  color: #f53f3f;
}
.passcode-host__input {
  flex: 1;
  min-width: 0;
  height: 52px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 15px;
  line-height: 22px;
  color: #1f2329;
}
.passcode-host__input::placeholder {
  color: #c0c4cc;
}
.passcode-host__error {
  margin: 12px 16px 0;
  font-size: 13px;
  line-height: 20px;
  color: #f53f3f;
}
.passcode-host__footer {
  flex: none;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
}
.passcode-host__submit {
  width: 100%;
  height: 44px;
  border-radius: 22px;
}
</style>
