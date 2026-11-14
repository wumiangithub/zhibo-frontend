<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElInput, ElSwitch } from "element-plus";

const props = defineProps<{
  active?: boolean;
  canSend: boolean;
  sending?: boolean;
}>();

const emit = defineEmits<{
  send: [payload: { text: string; pin: boolean }];
  toast: [message: string];
}>();

const text = ref("");
const pin = ref(false);
const MAX = 200;

const countLabel = computed(() => `${[...text.value].length}/${MAX}`);

watch(
  () => props.active,
  (on) => {
    if (on) {
      // 每次打开不清空，便于改完再发；仅确保不超过上限
      if ([...text.value].length > MAX) {
        text.value = [...text.value].slice(0, MAX).join("");
      }
    }
  },
);

function onSend() {
  const body = text.value.trim();
  if (!body) {
    emit("toast", "请输入内容");
    return;
  }
  if ([...body].length > MAX) {
    emit("toast", `内容不能超过 ${MAX} 字`);
    return;
  }
  if (!props.canSend) {
    emit("toast", "请先进入直播后再发送");
    return;
  }
  emit("send", { text: body, pin: pin.value });
}

function clearAfterSuccess() {
  text.value = "";
  pin.value = false;
}

defineExpose({ clearAfterSuccess });
</script>

<template>
  <section
    class="system-msg-panel"
    aria-label="系统消息"
  >
    <div class="editor-wrap">
      <ElInput
        v-model="text"
        class="editor"
        type="textarea"
        :rows="5"
        :maxlength="MAX"
        resize="none"
        placeholder="请输入内容"
        :disabled="sending"
      />
      <span class="counter">{{ countLabel }}</span>
    </div>
    <div class="footer">
      <div class="pin-row">
        <span class="pin-label">消息置顶：</span>
        <ElSwitch
          v-model="pin"
          :disabled="sending"
        />
        <span class="pin-hint">开启后，该系统消息将在观众端置顶</span>
      </div>
      <button
        type="button"
        class="send-btn"
        :class="{ 'is-disabled': !canSend || sending }"
        :aria-disabled="!canSend || sending"
        @click="onSend"
      >
        {{ sending ? "发送中…" : "发送" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.system-msg-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  margin: 0 16px 16px;
  padding: 16px;
  border: 1px solid var(--color-border, #e8e8e8);
  border-radius: 8px;
  background: #fff;
}

.editor-wrap {
  position: relative;
  flex: 1;
  min-height: 120px;
}

.editor :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 120px;
  padding-bottom: 28px;
  box-shadow: none;
  border-color: var(--color-border, #e8e8e8);
}

.counter {
  position: absolute;
  right: 12px;
  bottom: 8px;
  color: var(--color-text-placeholder, #bfbfbf);
  font-size: 12px;
  pointer-events: none;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pin-label {
  flex-shrink: 0;
  color: var(--color-text-regular, #595959);
  font-size: 13px;
}

.pin-hint {
  color: var(--color-text-secondary, #8c8c8c);
  font-size: 12px;
}

.send-btn {
  flex-shrink: 0;
  min-width: 88px;
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 4px;
  background: var(--color-primary, #1677ff);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.send-btn.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
