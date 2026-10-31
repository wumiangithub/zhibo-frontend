<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  submitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  submit: [password: string];
}>();

const password = ref("");

watch(
  () => props.open,
  (v) => {
    if (v) password.value = "";
  },
);

function onSubmit() {
  const p = password.value.trim();
  if (!/^\d{6}$/.test(p) || props.submitting) return;
  emit("submit", p);
}
</script>

<template>
  <div
    v-if="open"
    class="verify-mask"
  >
    <div class="verify-card">
      <h3>请输入观看密码</h3>
      <p>本场为加密直播，输入 6 位数字密码后继续</p>
      <input
        v-model="password"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="6 位数字密码"
        autocomplete="one-time-code"
        @keyup.enter="onSubmit"
      >
      <p
        v-if="error"
        class="err"
      >
        {{ error }}
      </p>
      <div class="verify-actions">
        <button
          type="button"
          class="send"
          :disabled="submitting || !/^\d{6}$/.test(password.trim())"
          @click="onSubmit"
        >
          {{ submitting ? "验证中…" : "确定" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verify-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}
.verify-card {
  width: 100%;
  max-width: 360px;
  border-radius: 12px;
  background: #fff;
  padding: 20px 18px 16px;
  color: #1a1a1a;
}
.verify-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.verify-card p {
  margin: 0 0 14px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
.verify-card input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 16px;
  letter-spacing: 0.2em;
}
.err {
  margin: 10px 0 0 !important;
  color: #cf1322 !important;
  font-size: 12px !important;
}
.verify-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.send {
  min-width: 88px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
