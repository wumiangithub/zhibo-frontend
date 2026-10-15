<script setup lang="ts">
import { reactive, ref, watch } from "vue";
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

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const form = reactive({
  sellAlone: true,
  sellType: "free" as SellType,
  price: "",
  linePrice: "",
  password: "",
  accessValidityType: "long" as "long" | "days",
  accessValidityDays: 7,
});
const submitting = ref(false);

const leave = useLeaveConfirm({ routeLeave: false });

function applyDetail(d: ActivityDetail) {
  form.sellAlone = d.sellAlone ?? true;
  form.sellType = (d.sellType as SellType) || "free";
  form.price = d.price != null ? String(d.price) : "";
  form.linePrice = d.linePrice != null ? String(d.linePrice) : "";
  form.password = d.password ?? "";
  form.accessValidityType = d.accessValidityType === "days" ? "days" : "long";
  form.accessValidityDays =
    d.accessValidityDays && d.accessValidityDays > 0 ? d.accessValidityDays : 7;
}

function validateSales(): string | null {
  if (!form.sellAlone) return null;
  if (form.sellType === "paid") {
    if (form.price === "" || form.price == null) return "请填写商品价格";
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) return "商品价格须为 ≥0 的数字";
    if (!/^\d+(\.\d{1,2})?$/.test(String(form.price).trim())) {
      return "商品价格最多两位小数";
    }
    if (form.linePrice !== "" && form.linePrice != null) {
      const line = Number(form.linePrice);
      if (Number.isNaN(line) || line <= price) return "划线价格须大于商品价格";
    }
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
    if (form.sellType === "paid") {
      payload.price = String(form.price).trim();
      if (form.linePrice !== "" && form.linePrice != null) {
        payload.linePrice = String(form.linePrice).trim();
      }
    }
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
  isDirty: () => leave.dirty.value,
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
          <ElRadio value="paid">付费</ElRadio>
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

      <!-- 付费 -->
      <template v-else-if="form.sellType === 'paid'">
        <FormRow
          label="商品价格:"
          required
        >
          <div class="flex items-center gap-2">
            <ElInput
              v-model="form.price"
              placeholder="请输入"
              style="width: 160px"
              @input="leave.markDirty"
            />
            <span>元</span>
          </div>
        </FormRow>
        <FormRow label="划线价格:">
          <div class="flex items-center gap-2">
            <ElInput
              v-model="form.linePrice"
              placeholder="选填，须大于商品价格"
              style="width: 160px"
              @input="leave.markDirty"
            />
            <span>元</span>
          </div>
        </FormRow>
        <FormRow label="有效期:">
          <ElRadioGroup
            v-model="form.accessValidityType"
            @change="leave.markDirty"
          >
            <ElRadio value="long">长期有效</ElRadio>
            <ElRadio value="days">
              自定义时长 购买后
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
              自定义时长 购买后
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
      <template v-else>
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
              自定义时长 购买后
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
    </fieldset>

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
  font-size: 13px;
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
