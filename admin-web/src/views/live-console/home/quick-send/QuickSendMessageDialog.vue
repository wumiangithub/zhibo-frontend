<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ElButton, ElDialog, ElMessage } from "element-plus";
import EmojiPanel from "@/views/live-console/room/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/views/live-console/room/composables/useEmojiInsert";

const CONTENT_MAX = 100;

const props = defineProps<{
  visible: boolean;
  title: string;
  initialContent?: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
  save: [content: string];
}>();

const content = ref("");
const showEmoji = ref(false);
const inputEl = ref<HTMLTextAreaElement | null>(null);

const charCount = computed(() => content.value.length);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      content.value = props.initialContent ?? "";
      showEmoji.value = false;
      nextTick(() => inputEl.value?.focus());
    }
  },
);

function close() {
  emit("update:visible", false);
}

function onSave() {
  const text = content.value.trim();
  if (!text) {
    ElMessage.warning("请输入消息内容");
    return;
  }
  if (text.length > CONTENT_MAX) {
    ElMessage.warning(`消息内容不能超过 ${CONTENT_MAX} 字`);
    return;
  }
  emit("save", text);
}

function insertEmoji(name: string) {
  const next = insertEmojiAtCursor(inputEl.value, content.value, name, CONTENT_MAX);
  if (next == null) {
    ElMessage.warning(`消息内容不能超过 ${CONTENT_MAX} 字`);
    return;
  }
  content.value = next;
  showEmoji.value = false;
}

function toggleEmoji() {
  showEmoji.value = !showEmoji.value;
}

</script>

<template>
  <ElDialog
    :model-value="visible"
    :title="title"
    width="560px"
    append-to-body
    destroy-on-close
    class="quick-send-msg-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <div
      v-if="showEmoji"
      class="emoji-mask"
      @click="showEmoji = false"
    />
    <div class="form-row">
      <label class="form-label">消息内容：</label>
      <div class="composer">
        <textarea
          ref="inputEl"
          v-model="content"
          class="composer-input"
          rows="6"
          :maxlength="CONTENT_MAX"
          placeholder="请输入"
        />
        <div class="composer-foot">
          <div class="emoji-wrap">
            <button
              type="button"
              class="emoji-btn"
              title="表情"
              @click.stop="toggleEmoji"
            >
              <svg
                class="emoji-ico"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <EmojiPanel
              v-if="showEmoji"
              @insert="insertEmoji"
            />
          </div>
          <span class="char-count">{{ charCount }}/{{ CONTENT_MAX }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <ElButton @click="close">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="saving"
        @click="onSave"
      >
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.form-label {
  flex: none;
  padding-top: 8px;
  font-size: 14px;
  color: var(--color-text);
  white-space: nowrap;
}

.emoji-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.composer {
  position: relative;
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  /* 勿 overflow:hidden，否则向上弹出的表情面板会被裁切 */
  overflow: visible;
}

.composer-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 140px;
  padding: 10px 12px 4px;
  border: 0;
  border-radius: 6px 6px 0 0;
  outline: none;
  resize: vertical;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  background: transparent;
}

.composer-foot {
  position: relative;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px 8px;
}

.emoji-wrap {
  position: relative;
  z-index: 51;
}

/* 弹窗内改为向下展开，避免被 Dialog body 裁切 */
.emoji-wrap :deep(.emoji-panel) {
  bottom: auto;
  top: 100%;
  margin-bottom: 0;
  margin-top: 8px;
  z-index: 52;
}

.emoji-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary, #8c8c8c);
  cursor: pointer;
}

.emoji-btn:hover {
  background: #f5f5f5;
  color: var(--color-primary);
}

.emoji-ico {
  width: 20px;
  height: 20px;
}

.char-count {
  font-size: 12px;
  color: var(--color-text-placeholder);
}
</style>

<style>
/* ElDialog teleported；body 默认 overflow 会裁切向下展开的表情层 */
.quick-send-msg-dialog .el-dialog__body {
  overflow: visible;
}
</style>
