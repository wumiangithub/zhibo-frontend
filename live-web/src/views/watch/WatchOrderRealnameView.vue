<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiPageHeader from "@/components/UiPageHeader.vue";
import { useToast } from "@/composables/useToast";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { backOrReplace } from "@/utils/navigation";

/** 写死 fdd_id_card_type（字典项编码 → 备注文案） */
const CARD_TYPES = [
  { value: 1, key: "id_card", label: "中国居民身份证" },
  { value: 2, key: "hk_mac_rp", label: "港澳居民居住证" },
  { value: 3, key: "taiwan_rp", label: "台湾居民居住证" },
  { value: 4, key: "foreign_prc", label: "外国人永久居留身份证" },
  { value: 5, key: "passport", label: "护照" },
  { value: 6, key: "hk_macao", label: "港澳居民来往内地通行证" },
  { value: 7, key: "taiwan", label: "台湾居民来往大陆通行证" },
  { value: 8, key: "hk_macao_foreigner", label: "港澳居民来往内地通行证(非中国籍)" },
] as const;

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const activityId = String(route.params.id ?? "").trim();
const orderId = String(route.query.orderId ?? "").trim();
const inMiniProgram = isLikelyMiniProgramWebView();

const realname = ref("");
const cardType = ref(1);
const idCard = ref("");
const pickerOpen = ref(false);

const cardTypeLabel = computed(
  () => CARD_TYPES.find((c) => c.value === cardType.value)?.label ?? "",
);

const canSubmit = computed(
  () =>
    Boolean(realname.value.trim()) &&
    Boolean(idCard.value.trim()) &&
    Number.isInteger(cardType.value),
);

function goBack() {
  backOrReplace(router, {
    name: "watch-order-pay-success",
    params: { id: activityId },
    query: { orderId },
  });
}

function selectCardType(value: number) {
  cardType.value = value;
  pickerOpen.value = false;
}

function onSubmit() {
  if (!canSubmit.value) {
    toast("请填写完整实名信息");
    return;
  }
  toast("待开发");
}
</script>

<template>
  <div class="rn-root">
    <UiPageHeader
      v-if="!inMiniProgram"
      title="实名认证"
      back-text=""
      @back="goBack"
    />

    <div class="rn-body">
      <nav
        class="rn-steps"
        aria-label="办理进度"
      >
        <div class="rn-step done">
          <span class="rn-step-dot">✓</span>
          <span>支付</span>
        </div>
        <span class="rn-step-line on" />
        <div class="rn-step active">
          <span class="rn-step-dot">2</span>
          <span>实名认证</span>
        </div>
        <span class="rn-step-line" />
        <div class="rn-step">
          <span class="rn-step-dot">3</span>
          <span>签署合同</span>
        </div>
      </nav>

      <section class="rn-form">
        <label class="rn-field">
          <span class="rn-label">姓名</span>
          <input
            v-model="realname"
            class="rn-input"
            type="text"
            maxlength="32"
            placeholder="请输入真实姓名"
            autocomplete="name"
          >
        </label>

        <button
          type="button"
          class="rn-field rn-field-btn"
          @click="pickerOpen = true"
        >
          <span class="rn-label">证件类型</span>
          <span class="rn-value">
            {{ cardTypeLabel }}
            <span
              class="rn-chevron"
              aria-hidden="true"
            >›</span>
          </span>
        </button>

        <label class="rn-field">
          <span class="rn-label">证件号码</span>
          <input
            v-model="idCard"
            class="rn-input"
            type="text"
            maxlength="64"
            placeholder="请输入完整证件号码"
            autocomplete="off"
          >
        </label>
      </section>

      <p class="rn-hint">
        根据监管要求，购买投资咨询服务需完成实名认证，用于合同签署与投资者保护。信息仅用于合规核验，将会加密保存。
      </p>
    </div>

    <div class="rn-foot">
      <button
        type="button"
        class="rn-primary"
        :disabled="!canSubmit"
        @click="onSubmit"
      >
        提交实名认证
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="rn-sheet-mask"
        @click.self="pickerOpen = false"
      >
        <div
          class="rn-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="选择证件类型"
        >
          <header class="rn-sheet-head">
            <span>选择证件类型</span>
            <button
              type="button"
              class="rn-sheet-close"
              aria-label="关闭"
              @click="pickerOpen = false"
            >
              ×
            </button>
          </header>
          <ul class="rn-sheet-list">
            <li
              v-for="item in CARD_TYPES"
              :key="item.value"
            >
              <button
                type="button"
                class="rn-sheet-item"
                :class="{ on: cardType === item.value }"
                @click="selectCardType(item.value)"
              >
                {{ item.label }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rn-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.rn-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 12px 24px;
  -webkit-overflow-scrolling: touch;
}

.rn-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #8a9199;
}

.rn-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.rn-step.active {
  color: #2f6bff;
  font-weight: 600;
}

.rn-step.done {
  color: #2f6bff;
}

.rn-step-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #d5dbe6;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.rn-step.active .rn-step-dot,
.rn-step.done .rn-step-dot {
  background: #2f6bff;
}

.rn-step-line {
  width: 28px;
  height: 2px;
  background: #d5dbe6;
  border-radius: 1px;
}

.rn-step-line.on {
  background: #2f6bff;
}

.rn-form {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}

.rn-field {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 14px;
  border-bottom: 1px solid #f0f2f5;
  box-sizing: border-box;
}

.rn-field:last-child {
  border-bottom: 0;
}

.rn-field-btn {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.rn-label {
  flex: none;
  width: 72px;
  font-size: 14px;
  color: #1f2329;
}

.rn-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: #1f2329;
}

.rn-input::placeholder {
  color: #b0b7c0;
}

.rn-value {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 14px;
  color: #1f2329;
  text-align: right;
}

.rn-chevron {
  color: #b0b7c0;
  font-size: 18px;
  line-height: 1;
}

.rn-hint {
  margin: 14px 4px 0;
  font-size: 12px;
  line-height: 1.55;
  color: #1a9f4b;
}

.rn-foot {
  flex: none;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.04);
}

.rn-primary {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #2f6bff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.rn-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.rn-primary:not(:disabled):active {
  background: #2558db;
}

.rn-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.rn-sheet {
  width: 100%;
  max-width: 560px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}

.rn-sheet-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 15px;
  font-weight: 600;
}

.rn-sheet-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #8a9199;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.rn-sheet-list {
  margin: 0;
  padding: 0 0 env(safe-area-inset-bottom, 0);
  list-style: none;
  overflow-y: auto;
}

.rn-sheet-item {
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid #f0f2f5;
  background: transparent;
  color: #1f2329;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.rn-sheet-item.on {
  color: #2f6bff;
  font-weight: 600;
}
</style>
