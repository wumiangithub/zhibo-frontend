<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  updateActivity,
  endActivity,
  deleteActivity,
  type ActivityDetail,
  type ActivityId,
} from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import { buildAudienceWatchUrl, buildLiveStudioPath } from "@/utils/liveLinks";
import { ActivityMemberRole } from "@/views/live/detail/role/roleTypes";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const router = useRouter();
const copied = ref("");
const error = ref("");

const editing = ref(false);
const editTitle = ref("");
const editStartTime = ref("");
const saving = ref(false);

const confirmAction = ref<"end" | "delete" | null>(null);
const actionLoading = ref(false);

const canEnd = computed(() => props.detail.state === 1 || props.detail.state === 2);
const canBroadcast = computed(() => !!props.detail.canBroadcast);

function toDateTimeLocal(s: string): string {
  if (!s) return "";
  return s.replace(" ", "T").slice(0, 16);
}

function toApiTime(s: string): string {
  return s.replace("T", " ") + ":00";
}

async function copy(text: string, label: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = label;
    setTimeout(() => (copied.value = ""), 1500);
  } catch {
    copied.value = "";
  }
}

function openHost() {
  if (!canBroadcast.value) return;
  void router.push(buildLiveStudioPath(props.activityId, ActivityMemberRole.HOST));
}

async function copyHost() {
  if (!canBroadcast.value) return;
  const path = buildLiveStudioPath(props.activityId, ActivityMemberRole.HOST);
  const url = `${window.location.origin.replace(/\/$/, "")}${path}`;
  await copy(url, "开播页链接已复制");
}

function copyWatchLink() {
  void copy(buildAudienceWatchUrl(props.activityId), "观看链接已复制");
}

function startEdit() {
  editTitle.value = props.detail.title;
  editStartTime.value = toDateTimeLocal(props.detail.startTime);
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

async function saveEdit() {
  saving.value = true;
  error.value = "";
  try {
    const payload: Record<string, string> = {};
    if (editTitle.value.trim() && editTitle.value !== props.detail.title) {
      payload.title = editTitle.value.trim();
    }
    const newTime = toApiTime(editStartTime.value);
    if (newTime !== props.detail.startTime) {
      payload.startTime = newTime;
    }
    if (Object.keys(payload).length > 0) {
      await updateActivity(props.activityId, payload);
      emit("refreshed");
    }
    editing.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    saving.value = false;
  }
}

async function confirmEnd() {
  actionLoading.value = true;
  error.value = "";
  try {
    await endActivity(props.activityId);
    emit("refreshed");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "结束直播失败";
  } finally {
    actionLoading.value = false;
    confirmAction.value = null;
  }
}

async function confirmDelete() {
  actionLoading.value = true;
  error.value = "";
  try {
    await deleteActivity(props.activityId);
    void router.push("/live");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "删除失败";
    actionLoading.value = false;
    confirmAction.value = null;
  }
}
</script>

<template>
  <div class="ops-tab">
    <h3 class="ops-title">运营操作</h3>

    <div
      v-if="editing"
      class="edit-row"
    >
      <label class="edit-label">
        标题
        <input
          v-model="editTitle"
          type="text"
          class="edit-input"
        />
      </label>
      <label class="edit-label">
        开始时间
        <input
          v-model="editStartTime"
          type="datetime-local"
          class="edit-input"
        />
      </label>
    </div>

    <div class="ops-row">
      <template v-if="!editing">
        <UiButton
          variant="default"
          @click="startEdit"
        >
          编辑
        </UiButton>
      </template>
      <template v-else>
        <UiButton
          variant="primary"
          :disabled="saving"
          @click="saveEdit"
        >
          {{ saving ? "保存中…" : "保存" }}
        </UiButton>
        <UiButton
          variant="default"
          :disabled="saving"
          @click="cancelEdit"
        >
          取消
        </UiButton>
      </template>
      <button
        v-if="canEnd"
        type="button"
        class="btn-warn"
        @click="confirmAction = 'end'"
      >
        结束直播
      </button>
      <button
        type="button"
        class="btn-danger"
        @click="confirmAction = 'delete'"
      >
        删除活动
      </button>
    </div>

    <div class="ops-row is-bordered">
      <button
        type="button"
        class="btn-success"
        :disabled="!canBroadcast"
        @click="openHost"
      >
        主持人开播（新窗口）
      </button>
      <UiButton
        variant="default"
        :disabled="!canBroadcast"
        @click="copyHost"
      >
        复制开播链接
      </UiButton>
      <UiButton
        variant="default"
        @click="copyWatchLink"
      >
        复制观看链接
      </UiButton>
    </div>

    <p
      v-if="copied"
      class="tip is-ok"
    >
      {{ copied }}
    </p>
    <p
      v-if="error"
      class="tip is-err"
    >
      {{ error }}
    </p>

    <Teleport to="body">
      <div
        v-if="confirmAction"
        class="modal-mask"
        @click.self="!actionLoading && (confirmAction = null)"
      >
        <div class="modal">
          <h4 class="modal-title">
            {{ confirmAction === "end" ? "结束直播" : "删除活动" }}
          </h4>
          <p class="modal-desc">
            {{
              confirmAction === "end"
                ? "确定要结束这场直播吗？结束后若仍满足开播条件（风控已通过、已上架），仍可再次开播。"
                : "删除后不可恢复"
            }}
          </p>
          <p
            v-if="error"
            class="tip is-err"
          >
            {{ error }}
          </p>
          <div class="modal-actions">
            <UiButton
              variant="default"
              :disabled="actionLoading"
              @click="confirmAction = null"
            >
              取消
            </UiButton>
            <button
              v-if="confirmAction === 'end'"
              type="button"
              class="btn-warn"
              :disabled="actionLoading"
              @click="confirmEnd"
            >
              {{ actionLoading ? "处理中…" : "确定结束" }}
            </button>
            <button
              v-else
              type="button"
              class="btn-danger"
              :disabled="actionLoading"
              @click="confirmDelete"
            >
              {{ actionLoading ? "处理中…" : "确定删除" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ops-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.ops-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.ops-row.is-bordered {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
}
.edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.edit-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.edit-input {
  height: 32px;
  min-width: 220px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}
.edit-input:focus {
  border-color: var(--color-primary);
}
.btn-warn,
.btn-danger,
.btn-success {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  outline: none;
}
.btn-warn {
  background: #fa8c16;
}
.btn-warn:hover:not(:disabled) {
  background: #d46b08;
}
.btn-danger {
  background: var(--color-danger);
}
.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-success {
  background: var(--color-success);
}
.btn-success:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-warn:disabled,
.btn-danger:disabled,
.btn-success:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tip {
  margin: 12px 0 0;
  font-size: 13px;
}
.tip.is-ok {
  color: var(--color-success);
}
.tip.is-err {
  color: var(--color-danger);
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.modal {
  width: 320px;
  padding: 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.modal-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
