<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ElCheckbox,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElRadio,
  ElRadioGroup,
} from "element-plus";
import {
  updateCourseSales,
  type CourseAccessValidityType,
  type CourseDetail,
  type CourseSellType,
  type UpdateCourseSalesPayload,
} from "@/api/course";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import FormRow from "@/views/live/components/FormRow.vue";
import UiButton from "@/components/ui/UiButton.vue";

const SELECTABLE_SELL_TYPES: CourseSellType[] = ["free", "encrypted", "specified"];

const props = defineProps<{
  courseId: string;
  detail: CourseDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const form = reactive({
  sellAlone: true,
  sellType: "free" as CourseSellType,
  password: "",
  accessValidityType: "long" as CourseAccessValidityType,
  accessValidityDays: 7,
  accessValidityFixedTime: "" as string,
});
const submitting = ref(false);

const leave = useLeaveConfirm({ routeLeave: false });

/** 不可选今天之前的日期；当天仍可选（时间点由用户确认）。 */
function disabledFixedDate(date: Date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return date.getTime() < start.getTime();
}

/** 与「此刻」同栏快捷（关闭面板底部默认此刻以免重复） */
const fixedTimeShortcuts = [
  {
    text: "此刻",
    value: () => new Date(),
  },
  {
    text: "一周后",
    value: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    },
  },
  {
    text: "一月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  {
    text: "三月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d;
    },
  },
  {
    text: "六月后",
    value: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      return d;
    },
  },
];

function normalizeAccessType(raw?: string): CourseAccessValidityType {
  if (raw === "days" || raw === "fixed") return raw;
  return "long";
}

function applyDetail(d: CourseDetail) {
  form.sellAlone = d.sellAlone ?? true;
  form.sellType = (d.sellType as CourseSellType) || "free";
  form.password = d.password ?? "";
  form.accessValidityType = normalizeAccessType(d.accessValidityType);
  form.accessValidityDays =
    d.accessValidityDays && d.accessValidityDays > 0 ? d.accessValidityDays : 7;
  form.accessValidityFixedTime = d.accessValidityFixedTime ?? "";
}

const hasEdits = computed(() => {
  const d = props.detail;
  const baselineType = (d.sellType as CourseSellType) || "free";
  const baselineAccess = normalizeAccessType(d.accessValidityType);
  const baselineDays =
    d.accessValidityDays && d.accessValidityDays > 0 ? d.accessValidityDays : 7;
  const baselineFixed = d.accessValidityFixedTime ?? "";
  const baselinePwd = d.password ?? "";

  if (form.sellAlone !== (d.sellAlone ?? true)) return true;
  if (form.sellType !== baselineType) return true;
  if (form.sellType === "encrypted") {
    if (form.password.trim() !== baselinePwd.trim()) return true;
  }
  if (form.sellType !== "free") {
    if (form.accessValidityType !== baselineAccess) return true;
    if (
      form.accessValidityType === "days"
      && Number(form.accessValidityDays) !== baselineDays
    ) {
      return true;
    }
    if (
      form.accessValidityType === "fixed"
      && (form.accessValidityFixedTime || "") !== baselineFixed
    ) {
      return true;
    }
  }
  return false;
});

const canSave = computed(() => hasEdits.value);

watch(
  hasEdits,
  (v) => {
    if (v) leave.markDirty();
    else leave.markClean();
  },
  { flush: "sync" },
);

function validateSales(): string | null {
  if (!form.sellAlone) return null;
  if (!SELECTABLE_SELL_TYPES.includes(form.sellType)) {
    return "请选择售卖类型";
  }
  if (form.sellType === "encrypted") {
    if (!/^\d{6}$/.test(form.password.trim())) return "请设置 6 位数字密码";
  }
  if (form.sellType !== "free" && form.accessValidityType === "days") {
    const n = Number(form.accessValidityDays);
    if (!Number.isInteger(n) || n < 1) return "请填写有效天数（正整数）";
  }
  if (form.sellType !== "free" && form.accessValidityType === "fixed") {
    const raw = form.accessValidityFixedTime?.trim();
    if (!raw) return "请选择固定到期时间";
    const picked = new Date(raw.replace(/-/g, "/"));
    if (Number.isNaN(picked.getTime()) || picked.getTime() <= Date.now()) {
      return "固定到期时间须晚于当前时间";
    }
  }
  return null;
}

async function onSave() {
  if (!hasEdits.value) {
    ElMessage.info("没有修改");
    return;
  }
  const err = validateSales();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const payload: UpdateCourseSalesPayload = {
      sellAlone: form.sellAlone,
      sellType: form.sellType,
    };
    if (form.sellType === "encrypted") {
      payload.password = form.password.trim();
    }
    if (form.sellType === "free") {
      payload.accessValidityType = "long";
    } else {
      payload.accessValidityType = form.accessValidityType;
      if (form.accessValidityType === "days") {
        payload.accessValidityDays = Number(form.accessValidityDays);
      }
      if (form.accessValidityType === "fixed") {
        payload.accessValidityFixedTime = form.accessValidityFixedTime.trim();
      }
    }
    await updateCourseSales(props.courseId, payload);
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

defineExpose({
  isDirty: () => hasEdits.value,
  confirmLeave: leave.confirmLeave,
});
</script>

<template>
  <div
    class="tab-panel"
    :class="{ 'is-disabled-block': !form.sellAlone }"
  >
    <FormRow label="售卖方式:">
      <div>
        <div class="flex items-center gap-3">
          <ElCheckbox
            v-model="form.sellAlone"
            @change="leave.markDirty"
          >
            单独售卖
          </ElCheckbox>
          <span class="hint">用户可以通过链接的方式单独购买该商品</span>
        </div>
      </div>
    </FormRow>

    <fieldset
      class="sell-block"
      :disabled="!form.sellAlone"
    >
      <FormRow label="售卖类型:">
        <ElRadioGroup
          v-model="form.sellType"
          @change="leave.markDirty"
        >
          <ElRadio value="free">免费</ElRadio>
          <ElRadio value="encrypted">加密</ElRadio>
          <ElRadio value="specified">指定用户</ElRadio>
        </ElRadioGroup>
      </FormRow>

      <template v-if="form.sellType === 'free'">
        <FormRow label="有效期:">
          <span class="locked">长期有效，暂不支持修改</span>
        </FormRow>
      </template>

      <template v-else-if="form.sellType === 'encrypted'">
        <FormRow label="密码:">
          <ElInput
            v-model="form.password"
            maxlength="6"
            placeholder="请设置6位数字"
            style="width: 200px"
            @input="leave.markDirty"
          />
        </FormRow>
        <FormRow label="有效期:">
          <ElRadioGroup
            v-model="form.accessValidityType"
            class="validity-group"
            @change="leave.markDirty"
          >
            <ElRadio value="long">长期有效</ElRadio>
            <ElRadio value="days">
              自定义时长&nbsp;&nbsp;权益生效后
              <ElInputNumber
                v-model="form.accessValidityDays"
                :min="1"
                :max="9999"
                :controls="false"
                class="days-input"
                :disabled="form.accessValidityType !== 'days'"
                @change="leave.markDirty"
              />
              天有效
            </ElRadio>
            <ElRadio value="fixed">
              固定时间到期
              <ElDatePicker
                v-model="form.accessValidityFixedTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择日期和时间"
                class="fixed-picker"
                :disabled="form.accessValidityType !== 'fixed'"
                :disabled-date="disabledFixedDate"
                :shortcuts="fixedTimeShortcuts"
                :show-now="false"
                @change="leave.markDirty"
              />
            </ElRadio>
          </ElRadioGroup>
        </FormRow>
      </template>

      <template v-else-if="form.sellType === 'specified'">
        <p class="spec-tip">
          仅被指定用户可免费学习课程，添加指定用户请前往【课程-用户列表】手动操作
        </p>
        <FormRow label="有效期:">
          <ElRadioGroup
            v-model="form.accessValidityType"
            class="validity-group"
            @change="leave.markDirty"
          >
            <ElRadio value="long">长期有效</ElRadio>
            <ElRadio value="days">
              自定义时长&nbsp;&nbsp;权益生效后
              <ElInputNumber
                v-model="form.accessValidityDays"
                :min="1"
                :max="9999"
                :controls="false"
                class="days-input"
                :disabled="form.accessValidityType !== 'days'"
                @change="leave.markDirty"
              />
              天有效
            </ElRadio>
            <ElRadio value="fixed">
              固定时间到期
              <ElDatePicker
                v-model="form.accessValidityFixedTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择日期和时间"
                class="fixed-picker"
                :disabled="form.accessValidityType !== 'fixed'"
                :disabled-date="disabledFixedDate"
                :shortcuts="fixedTimeShortcuts"
                :show-now="false"
                @change="leave.markDirty"
              />
            </ElRadio>
          </ElRadioGroup>
        </FormRow>
      </template>
    </fieldset>

    <div class="save-bar">
      <UiButton
        :variant="canSave ? 'primary' : 'default'"
        :disabled="!canSave || submitting"
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
  overflow: auto;
}
.hint {
  font-size: 12px;
  color: #999;
}
.sell-block {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.sell-block:disabled {
  opacity: 0.55;
  pointer-events: none;
}
.locked {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  font-size: 13px;
  line-height: 32px;
  color: #999;
}
.validity-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.days-input {
  width: 72px;
  margin: 0 6px;
}
.fixed-picker {
  width: 210px;
  margin-left: 8px;
  vertical-align: middle;
}
.spec-tip {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
  line-height: 1.6;
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
