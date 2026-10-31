<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ElCheckbox,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElRadio,
  ElRadioGroup,
} from "element-plus";
import {
  updateActivitySales,
  type ActivityDetail,
  type ActivityId,
  type SellType,
  type UpdateSalesPayload,
} from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import UiButton from "@/components/ui/UiButton.vue";

/** 管理端可选售卖类型（不含已下线的 paid） */
const SELECTABLE_SELL_TYPES: SellType[] = ["free", "encrypted", "specified"];

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const form = reactive({
  sellAlone: true,
  sellType: "free" as SellType,
  password: "",
  accessValidityType: "long" as "long" | "days",
  accessValidityDays: 7,
});
const submitting = ref(false);

const leave = useLeaveConfirm({ routeLeave: false });

function applyDetail(d: ActivityDetail) {
  form.sellAlone = d.sellAlone ?? true;
  form.sellType = (d.sellType as SellType) || "free";
  form.password = d.password ?? "";
  form.accessValidityType = d.accessValidityType === "days" ? "days" : "long";
  form.accessValidityDays =
    d.accessValidityDays && d.accessValidityDays > 0 ? d.accessValidityDays : 7;
}

/** 当前值相对详情基线是否有差异（改完又改回不算脏） */
const hasEdits = computed(() => {
  const d = props.detail;
  const baselineType = (d.sellType as SellType) || "free";
  const baselineAccess = d.accessValidityType === "days" ? "days" : "long";
  const baselineDays =
    d.accessValidityDays && d.accessValidityDays > 0 ? d.accessValidityDays : 7;
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
    return "付费类型已下线，请改选其他售卖类型";
  }
  if (form.sellType === "encrypted") {
    if (!/^\d{6}$/.test(form.password.trim())) return "请设置 6 位数字密码";
  }
  if (form.sellType !== "free" && form.accessValidityType === "days") {
    const n = Number(form.accessValidityDays);
    if (!Number.isInteger(n) || n < 1) return "请填写有效天数（正整数）";
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
    const payload: UpdateSalesPayload = {
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
    }
    await updateActivitySales(props.activityId, payload);
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

      <!-- 免费 -->
      <template v-if="form.sellType === 'free'">
        <FormRow label="有效期:">
          <span class="locked">长期有效，暂不支持修改</span>
        </FormRow>
      </template>

      <!-- 加密 -->
      <template v-else-if="form.sellType === 'encrypted'">
        <FormRow
          label="密码:"
          required
        >
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
            @change="leave.markDirty"
          >
            <ElRadio value="long">长期有效</ElRadio>
            <ElRadio value="days">
              自定义时长&nbsp;&nbsp;直播结束后
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
          </ElRadioGroup>
        </FormRow>
      </template>

      <!-- 指定用户 -->
      <template v-else-if="form.sellType === 'specified'">
        <p class="spec-tip">
          仅被指定用户可免费学习课程，添加指定用户请前往【直播间-用户管理】手动操作
        </p>
        <FormRow label="有效期:">
          <ElRadioGroup
            v-model="form.accessValidityType"
            @change="leave.markDirty"
          >
            <ElRadio value="long">长期有效</ElRadio>
            <ElRadio value="days">
              自定义时长&nbsp;&nbsp;直播结束后
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
          </ElRadioGroup>
        </FormRow>
      </template>

      <!-- 存量 paid 等已下线类型 -->
      <template v-else>
        <p class="spec-tip">
          付费类型已下线，请改选免费 / 加密 / 指定用户后保存
        </p>
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
.days-input {
  width: 72px;
  margin: 0 6px;
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
