<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import {
  ElMessage,
  ElMessageBox,
  ElRadio,
  ElRadioGroup,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElInputNumber,
} from "element-plus";
import {
  getActivityRecordDownload,
  listActivityRecords,
  updateActivityPlayback,
  type ActivityDetail,
  type ActivityId,
  type ActivityRecordItem,
  type PlaybackValidityType,
} from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { resolveCreatedTime } from "@/utils/createdTime";
import FormRow from "../components/FormRow.vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const form = reactive({
  playbackEnabled: true,
  playbackValidityType: "forever" as PlaybackValidityType,
  playbackValidityDays: 7,
  playbackSpeedAllow: true,
  playbackFastForwardAllow: true,
});
const submitting = ref(false);

const leave = useLeaveConfirm({ routeLeave: false });

const records = ref<ActivityRecordItem[]>([]);
const recordsLoading = ref(false);
const recordsError = ref("");
const downloadingId = ref<number | null>(null);

function applyDetail(d: ActivityDetail) {
  form.playbackEnabled = d.playbackEnabled ?? true;
  form.playbackValidityType = d.playbackValidityType === "days" ? "days" : "forever";
  form.playbackValidityDays =
    d.playbackValidityDays && d.playbackValidityDays > 0 ? d.playbackValidityDays : 7;
  form.playbackSpeedAllow = d.playbackSpeedAllow ?? true;
  form.playbackFastForwardAllow = d.playbackFastForwardAllow ?? true;
}

async function loadRecords() {
  recordsLoading.value = true;
  recordsError.value = "";
  try {
    const data = await listActivityRecords(props.activityId);
    records.value = data.list ?? [];
  } catch (e) {
    recordsError.value = e instanceof Error ? e.message : "加载回放列表失败";
    records.value = [];
  } finally {
    recordsLoading.value = false;
  }
}

async function onToggleEnabled(val: boolean | string | number) {
  const enabled = !!val;
  if (!enabled) {
    try {
      await ElMessageBox.confirm(
        "关闭后学员将无法查看回放，确认关闭？",
        "关闭回放",
        {
          type: "warning",
          confirmButtonText: "确认关闭",
          cancelButtonText: "取消",
        },
      );
      form.playbackEnabled = false;
      leave.markDirty();
    } catch {
      form.playbackEnabled = true;
    }
  } else {
    form.playbackEnabled = true;
    leave.markDirty();
  }
}

/** 微吼 storage 单位为 KB */
function formatStorageKb(raw?: string | null): string {
  if (raw == null || String(raw).trim() === "") return "";
  const s = String(raw).trim();
  if (/kb$/i.test(s)) return s;
  return `${s} KB`;
}

async function onDownload(row: ActivityRecordItem) {
  if (!row.id) {
    ElMessage.warning("回放 id 无效");
    return;
  }
  if (downloadingId.value === row.id) return;
  downloadingId.value = row.id;
  try {
    const data = await getActivityRecordDownload(props.activityId, row.id);
    const status = data.status;
    if (status === 1 && data.downloadUrl) {
      window.open(data.downloadUrl, "_blank", "noopener");
      return;
    }
    if (status === 2) {
      ElMessage.info(`回放打包中（${data.progress ?? 0}%），请稍后重试`);
      return;
    }
    if (status === 0) {
      ElMessage.info("已提交回放打包任务，请稍后再次点击下载");
      return;
    }
    if (status === 3) {
      ElMessage.error("回放打包失败，请稍后重试");
      return;
    }
    ElMessage.info("暂无下载地址");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取下载地址失败");
  } finally {
    downloadingId.value = null;
  }
}

async function onSave() {
  if (form.playbackEnabled && form.playbackValidityType === "days") {
    const n = Number(form.playbackValidityDays);
    if (!Number.isInteger(n) || n < 1) {
      ElMessage.warning("请填写有效的回放天数（正整数）");
      return;
    }
  }
  submitting.value = true;
  try {
    await updateActivityPlayback(props.activityId, {
      playbackEnabled: form.playbackEnabled,
      playbackValidityType: form.playbackValidityType,
      playbackValidityDays:
        form.playbackValidityType === "days" ? Number(form.playbackValidityDays) : undefined,
      playbackSpeedAllow: form.playbackSpeedAllow,
      playbackFastForwardAllow: form.playbackFastForwardAllow,
    });
    ElMessage.success("保存成功");
    leave.markClean();
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}

watch(
  () => props.detail,
  (d) => {
    applyDetail(d);
    leave.markClean();
  },
  { immediate: true },
);

onMounted(() => {
  void loadRecords();
});

defineExpose({
  isDirty: () => leave.dirty.value,
  confirmLeave: leave.confirmLeave,
});
</script>

<template>
  <div class="tab-panel">
    <FormRow label="直播回放:">
      <div class="flex items-center gap-3">
        <ElSwitch
          :model-value="form.playbackEnabled"
          @change="onToggleEnabled"
        />
        <span class="hint">开启回放，直播结束后学员可查看回放视频</span>
      </div>
    </FormRow>

    <template v-if="form.playbackEnabled">
      <FormRow label="回放有效期:">
        <ElRadioGroup
          v-model="form.playbackValidityType"
          @change="leave.markDirty"
        >
          <ElRadio value="forever">永久有效</ElRadio>
          <ElRadio value="days">
            直播结束后
            <ElInputNumber
              v-model="form.playbackValidityDays"
              :min="1"
              :max="9999"
              :controls="false"
              class="days-input"
              :disabled="form.playbackValidityType !== 'days'"
              @change="leave.markDirty"
            />
            天有效
          </ElRadio>
        </ElRadioGroup>
      </FormRow>

      <FormRow label="倍速播放:">
        <ElRadioGroup
          v-model="form.playbackSpeedAllow"
          @change="leave.markDirty"
        >
          <ElRadio :value="true">允许</ElRadio>
          <ElRadio :value="false">禁止</ElRadio>
        </ElRadioGroup>
      </FormRow>

      <FormRow label="快进播放:">
        <ElRadioGroup
          v-model="form.playbackFastForwardAllow"
          @change="leave.markDirty"
        >
          <ElRadio :value="true">允许</ElRadio>
          <ElRadio :value="false">禁止</ElRadio>
        </ElRadioGroup>
      </FormRow>

      <div class="records">
        <div class="records-title">回放内容</div>
        <p
          v-if="recordsError"
          class="err"
        >
          {{ recordsError }}
        </p>
        <ElTable
          v-loading="recordsLoading"
          :data="records"
          empty-text="暂无回放记录"
        >
          <ElTableColumn
            label="直播名称"
            min-width="240"
          >
            <template #default="{ row }">
              <div class="rec-name">
                <img
                  v-if="row.coverUrl"
                  :src="row.coverUrl"
                  alt=""
                  class="rec-cover"
                >
                <span>{{ row.title || detail.title }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="duration"
            label="时长"
            width="100"
          />
          <ElTableColumn
            label="体积"
            width="110"
          >
            <template #default="{ row }">
              {{ formatStorageKb(row.storage) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="生成时间"
            width="180"
          >
            <template #default="{ row }">
              {{ resolveCreatedTime(row) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="saveTime"
            label="到期时间"
            width="180"
          />
          <ElTableColumn
            label="操作"
            width="100"
          >
            <template #default="{ row }">
              <a
                class="dl-link"
                :class="{ 'is-busy': downloadingId === row.id }"
                @click.prevent="onDownload(row)"
              >{{ downloadingId === row.id ? "获取中…" : "下载" }}</a>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </template>

    <div class="save-bar">
      <UiButton
        variant="primary"
        :disabled="submitting"
        @click="onSave"
      >
        {{ submitting ? "保存中…" : "保存" }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  padding-bottom: 24px;
}
.hint {
  font-size: 12px;
  color: #999;
}
.days-input {
  width: 72px;
  margin: 0 6px;
}
.records {
  margin-top: 16px;
}
.records-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.rec-name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rec-cover {
  width: 64px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
  background: #f0f0f0;
}
.dl-link {
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
}
.dl-link.is-busy {
  opacity: 0.6;
  pointer-events: none;
}
.err {
  color: #cf1322;
  font-size: 13px;
}
.save-bar {
  display: flex;
  justify-content: center;
  padding: 24px 0 8px;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
