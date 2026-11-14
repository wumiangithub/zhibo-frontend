<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, ElOption, ElSelect } from "element-plus";
import {
  listQuickSendGroups,
  listQuickSendMessages,
  type QuickSendGroup,
  type QuickSendMessage,
} from "@/api/quickSend";
import { ApiError } from "@/api/http";
import { copyText } from "@/utils/copyText";
import { splitEmojiText } from "./constants/emoji";
import type { ChatController } from "./composables/useChat";

const props = defineProps<{
  activityId: string;
  /** 父级是否展示本面板（再次打开须重新拉分组/话术） */
  active?: boolean;
  /** 直播中且 SDK 就绪时可真正发出；未就绪时按钮置灰但仍可点出 toast */
  canSend: boolean;
  chat: ChatController;
}>();

const emit = defineEmits<{
  toast: [message: string];
}>();

const groups = ref<QuickSendGroup[]>([]);
const groupId = ref("");
const list = ref<QuickSendMessage[]>([]);
const loadingGroups = ref(false);
const loadingList = ref(false);
const sendingId = ref<string | null>(null);
const error = ref("");
let loadSeq = 0;

const empty = computed(
  () => !loadingList.value && !error.value && !!groupId.value && list.value.length === 0,
);

function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

async function loadGroups() {
  loadingGroups.value = true;
  try {
    groups.value = await listQuickSendGroups();
    const prefer =
      groupId.value && groups.value.some((g) => g.id === groupId.value)
        ? groupId.value
        : groups.value.find((g) => g.isDefault)?.id ?? groups.value[0]?.id ?? "";
    groupId.value = prefer;
    if (!prefer) {
      list.value = [];
      error.value = "";
    }
  } catch (err: unknown) {
    groups.value = [];
    groupId.value = "";
    list.value = [];
    error.value = errMsg(err, "加载分组失败");
  } finally {
    loadingGroups.value = false;
  }
}

async function loadList() {
  const gid = groupId.value.trim();
  if (!gid) {
    list.value = [];
    return;
  }
  const seq = ++loadSeq;
  loadingList.value = true;
  error.value = "";
  try {
    /** 中控台快捷发送一次拉满组内话术（库单条 ≤100，组规模通常不大） */
    const data = await listQuickSendMessages({
      groupId: gid,
      page: 1,
      pageSize: 100,
    });
    if (seq !== loadSeq) return;
    list.value = data.list ?? [];
  } catch (err: unknown) {
    if (seq !== loadSeq) return;
    list.value = [];
    error.value = errMsg(err, "加载消息失败");
  } finally {
    if (seq === loadSeq) loadingList.value = false;
  }
}

async function reload() {
  await loadGroups();
  if (groupId.value) await loadList();
}

/** 每次展示面板时拉最新分组与当前组话术（v-show 复用挂载，不能只靠首次 mount） */
watch(
  () => props.active,
  (shown) => {
    if (shown) void reload();
  },
  { immediate: true },
);

watch(
  () => props.activityId,
  () => {
    if (props.active) void reload();
  },
);

async function onCopy(row: QuickSendMessage) {
  const text = row.content?.trim() ?? "";
  if (!text) {
    ElMessage.warning("暂无内容可复制");
    return;
  }
  await copyText(text, "已复制到剪贴板");
}

function onSend(row: QuickSendMessage) {
  if (sendingId.value != null) return;
  const text = row.content?.trim() ?? "";
  if (!text) {
    emit("toast", "消息为空");
    return;
  }
  if (!props.canSend) {
    emit("toast", "请先进入直播后再发送");
    return;
  }
  sendingId.value = row.id;
  try {
    const result = props.chat.sendChatText(text);
    if (result === "ok") {
      emit("toast", "已发送");
      return;
    }
    const tips: Record<string, string> = {
      muted: "当前禁言，无法发送",
      too_long: "消息过长",
      no_sdk: "未进房，无法发送",
      empty: "消息为空",
      fail: "发送失败",
    };
    emit("toast", tips[result] ?? "发送失败");
  } finally {
    sendingId.value = null;
  }
}

defineExpose({ reload });
</script>

<template>
  <section
    class="quick-send-panel"
    aria-label="快捷发送"
  >
    <div class="group-row">
      <span class="group-label">选择消息库分组</span>
      <ElSelect
        v-model="groupId"
        class="group-select"
        placeholder="请选择分组"
        filterable
        :loading="loadingGroups"
        :disabled="loadingGroups || !groups.length"
        @change="() => void loadList()"
      >
        <ElOption
          v-for="g in groups"
          :key="g.id"
          :label="g.name"
          :value="g.id"
        />
      </ElSelect>
    </div>

    <div
      v-if="(loadingList || loadingGroups) && !list.length && !error"
      class="panel-state"
    >
      加载中…
    </div>
    <div
      v-else-if="error"
      class="panel-state is-err"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="retry"
        @click="reload"
      >
        重试
      </button>
    </div>
    <div
      v-else-if="!groups.length"
      class="panel-state"
    >
      暂无消息库分组，请先在中控台首页「快捷发送」维护
    </div>
    <div
      v-else-if="empty"
      class="panel-state"
    >
      该分组暂无消息
    </div>
    <div
      v-else
      class="table-wrap hover-scrollbar"
      v-loading="loadingList"
    >
      <table class="msg-table">
        <thead>
          <tr>
            <th class="col-content">
              消息内容
            </th>
            <th class="col-ops">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in list"
            :key="row.id"
          >
            <td class="col-content">
              <span class="content-text">
                <template
                  v-for="(seg, i) in splitEmojiText(row.content)"
                  :key="i"
                >
                  <img
                    v-if="seg.kind === 'emoji'"
                    class="emoji"
                    :src="seg.src"
                    :alt="seg.name"
                  >
                  <span v-else>{{ seg.value }}</span>
                </template>
              </span>
            </td>
            <td class="col-ops">
              <button
                type="button"
                class="op-link"
                @click="onCopy(row)"
              >
                复制
              </button>
              <button
                type="button"
                class="op-link"
                :class="{ 'is-disabled': !canSend || sendingId != null }"
                :aria-disabled="!canSend || sendingId != null"
                @click="onSend(row)"
              >
                {{ sendingId === row.id ? "发送中…" : "发送" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.quick-send-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 0 16px 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
}

.group-row {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.group-label {
  flex: none;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
}

.group-select {
  width: 220px;
}

.panel-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 24px;
  color: #999;
  font-size: 13px;
}

.panel-state.is-err {
  color: #f56c6c;
}

.retry {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  background: #fff;
  color: var(--color-primary);
  cursor: pointer;
}

.table-wrap {
  flex: 1;
  min-height: 160px;
  max-height: 360px;
  overflow: auto;
}

.msg-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
  color: #333;
}

.msg-table th,
.msg-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
  vertical-align: middle;
}

.msg-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fafafa;
  color: #666;
  font-weight: 500;
}

.col-content {
  width: auto;
}

.col-ops {
  width: 120px;
  white-space: nowrap;
  text-align: right;
}

.content-text {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  line-height: 1.5;
  word-break: break-word;
}

.emoji {
  width: 20px;
  height: 20px;
  vertical-align: middle;
}

.op-link {
  margin-left: 12px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.op-link:first-child {
  margin-left: 0;
}

.op-link.is-disabled {
  color: var(--color-text-placeholder, #bfbfbf);
  cursor: not-allowed;
}
</style>
