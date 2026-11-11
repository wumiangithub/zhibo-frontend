<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { dictLabelValueMap, getDictData } from "@/api/dict";
import {
  getViewerOrderPaidDetail,
  prepayViewerOrder,
  type ViewerOrderPaidDetail,
  type ViewerPrepayResult,
} from "@/api/orderCenter";
import { useToast } from "@/composables/useToast";
import { isLikelyMiniProgramWebView } from "@/utils/miniProgram";
import { isWeChatInAppBrowser } from "@/utils/viewerPendingPaySession";
import { invokeViewerPayCredential } from "@/utils/viewerPayInvoke";
import payWechatIcon from "@/assets/images/pay-wechat.png";
import payAlipayIcon from "@/assets/images/pay-alipay.png";

type PayChannel = "wechat" | "alipay";

const props = defineProps<{
  open: boolean;
  orderId: string;
  /** 商品封面（paid-detail 无图，用确认单快照） */
  coverImg?: string;
  riskGrade?: string;
  riskGradeName?: string;
}>();

const emit = defineEmits<{
  close: [];
  pay: [
    payload: {
      orderId: string;
      payChannel: PayChannel;
      detail: ViewerOrderPaidDetail;
      prepay: ViewerPrepayResult;
      /** 微信内支付宝：已复制链接，未跳转 */
      deferredAlipayCopy?: boolean;
    },
  ];
}>();

const { toast } = useToast();
/** 小程序 web-view 已有原生导航栏，勿再叠 H5 返回头（对齐 WatchView / WatchReplayView） */
const inMiniProgram = isLikelyMiniProgramWebView();

const loading = ref(false);
const error = ref("");
const detail = ref<ViewerOrderPaidDetail | null>(null);
/** 本站 /dicts/data/pay_channel 的 label→value；进页拉取 */
const payChannelDict = ref<Record<string, number> | null>(null);
/** 本站 /dicts/data/pay_way 的 label→value；进页拉取 */
const payWayDict = ref<Record<string, number> | null>(null);
const payChannel = ref<PayChannel>("wechat");
const agreed = ref(false);
const prepaying = ref(false);
const alipayCopyOpen = ref(false);
const alipayCopyUrl = ref("");
const alipayCopyPending = ref<{
  orderId: string;
  detail: ViewerOrderPaidDetail;
  prepay: ViewerPrepayResult;
} | null>(null);

const riskBannerText = computed(() => {
  const grade = (props.riskGrade || detail.value?.customerRiskLevel || "").trim();
  const name = (props.riskGradeName || "").trim();
  const label = `${grade}${name}`;
  if (label) return `已完成风险测评，测评结果为${label}`;
  return "已完成风险测评";
});

const moneyText = computed(() => {
  const raw = detail.value?.orderMoney?.trim() || "";
  if (!raw) return "¥0.00";
  if (raw.startsWith("¥")) return raw;
  const n = Number(raw);
  if (Number.isFinite(n)) return `¥${n.toFixed(2)}`;
  return `¥${raw}`;
});

const moneyParts = computed(() => {
  const t = moneyText.value.replace(/^¥\s*/, "");
  const [intPart, decPart] = t.split(".");
  return {
    intPart: intPart || "0",
    decPart: decPart != null ? decPart.padEnd(2, "0").slice(0, 2) : "00",
  };
});

watch(
  () => [props.open, props.orderId] as const,
  ([open, orderId]) => {
    if (!open) return;
    payChannel.value = "wechat";
    agreed.value = false;
    error.value = "";
    detail.value = null;
    payChannelDict.value = null;
    payWayDict.value = null;
    if (!orderId) {
      error.value = "订单无效";
      return;
    }
    void loadPayPage(orderId);
  },
  { immediate: true },
);

async function loadPayChannelDict() {
  try {
    const data = await getDictData("pay_channel");
    payChannelDict.value = dictLabelValueMap(data);
  } catch (e) {
    payChannelDict.value = null;
    console.warn("拉支付渠道字典失败，将用本地兜底", e);
  }
}

async function loadPayWayDict() {
  try {
    const data = await getDictData("pay_way");
    payWayDict.value = dictLabelValueMap(data);
  } catch (e) {
    payWayDict.value = null;
    console.warn("拉支付方式字典失败，将用本地兜底", e);
  }
}

async function loadPayPage(orderId: string) {
  loading.value = true;
  error.value = "";
  try {
    const [, , paid] = await Promise.all([
      loadPayChannelDict(),
      loadPayWayDict(),
      getViewerOrderPaidDetail(orderId),
    ]);
    detail.value = paid;
  } catch (e) {
    detail.value = null;
    error.value = e instanceof Error ? e.message : "加载订单失败";
  } finally {
    loading.value = false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function onCopyAlipayLink() {
  const url = alipayCopyUrl.value.trim();
  const pending = alipayCopyPending.value;
  if (!url || !pending) {
    toast("支付链接无效");
    return;
  }
  const ok = await copyText(url);
  if (!ok) {
    toast("复制失败，请长按链接手动复制");
    return;
  }
  alipayCopyOpen.value = false;
  emit("pay", {
    orderId: pending.orderId,
    payChannel: "alipay",
    detail: pending.detail,
    prepay: pending.prepay,
    deferredAlipayCopy: true,
  });
  alipayCopyPending.value = null;
  alipayCopyUrl.value = "";
}

function onCloseAlipayCopy() {
  alipayCopyOpen.value = false;
  alipayCopyUrl.value = "";
  alipayCopyPending.value = null;
}

async function onConfirmPay() {
  if (!detail.value || !props.orderId || prepaying.value) return;
  if (!agreed.value) {
    error.value = "请先阅读并同意相关协议";
    return;
  }
  error.value = "";
  prepaying.value = true;
  try {
    const reload: Promise<void>[] = [];
    if (!payChannelDict.value) reload.push(loadPayChannelDict());
    if (!payWayDict.value) reload.push(loadPayWayDict());
    if (reload.length) await Promise.all(reload);
    const prepay = await prepayViewerOrder({
      orderId: props.orderId,
      uiChannel: payChannel.value,
      payChannelDict: payChannelDict.value,
      payWayDict: payWayDict.value,
      payMoney: detail.value.orderMoney,
    });

    // 先解析凭证（WAP 不立刻跳转），成功后再 emit pending / 跳转或复制链接
    const deferAlipay =
      payChannel.value === "alipay" && isWeChatInAppBrowser();
    const parsed = await invokeViewerPayCredential(prepay, {
      deferRedirect: true,
    });
    error.value = "";

    if (deferAlipay) {
      if (!parsed.redirectUrl) {
        throw new Error("支付凭证缺少支付宝跳转链接");
      }
      alipayCopyUrl.value = parsed.redirectUrl;
      alipayCopyPending.value = {
        orderId: props.orderId,
        detail: detail.value,
        prepay,
      };
      alipayCopyOpen.value = true;
      return;
    }

    if (parsed.redirectUrl) {
      emit("pay", {
        orderId: props.orderId,
        payChannel: payChannel.value,
        detail: detail.value,
        prepay,
      });
      window.location.href = parsed.redirectUrl;
      return;
    }

    // wx_lite / wx_pub stub 等：再走一遍非 defer 唤起
    emit("pay", {
      orderId: props.orderId,
      payChannel: payChannel.value,
      detail: detail.value,
      prepay,
    });
    const invoke = await invokeViewerPayCredential(prepay);
    if (invoke.stub) {
      toast(invoke.stub);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "拉起支付失败";
  } finally {
    prepaying.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pay-fade">
      <div
        v-if="open"
        class="pay-root"
        role="dialog"
        aria-modal="true"
        aria-label="订单支付"
      >
        <header
          v-if="!inMiniProgram"
          class="pay-nav"
        >
          <button
            type="button"
            class="pay-nav-back"
            aria-label="返回"
            @click="emit('close')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 class="pay-nav-title">
            订单支付
          </h1>
          <span class="pay-nav-spacer" />
        </header>

        <div class="pay-risk-banner">
          <span class="pay-risk-check" aria-hidden="true">✓</span>
          <span>{{ riskBannerText }}</span>
        </div>

        <div class="pay-body">
          <div
            v-if="loading"
            class="pay-state"
          >
            <span class="pay-spinner" />
            <p>加载订单中…</p>
          </div>

          <div
            v-else-if="error && !detail"
            class="pay-state"
          >
            <p class="pay-error">
              {{ error }}
            </p>
            <button
              type="button"
              class="pay-retry"
              @click="loadPayPage(orderId)"
            >
              重试
            </button>
          </div>

          <template v-else-if="detail">
            <section class="pay-card">
              <div class="pay-product">
                <div class="pay-cover">
                  <img
                    v-if="coverImg"
                    :src="coverImg"
                    alt=""
                    class="pay-cover-img"
                  >
                  <div
                    v-else
                    class="pay-cover-empty"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                        stroke-width="1.5"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M21 16l-5.5-5.5L7 19"
                      />
                    </svg>
                  </div>
                </div>
                <p class="pay-product-name">
                  {{ detail.productName || "商品" }}
                </p>
              </div>

              <div class="pay-kv">
                <div class="pay-kv-row">
                  <span class="pay-kv-label">订单编号</span>
                  <span class="pay-kv-value">{{ detail.orderNo || "—" }}</span>
                </div>
                <div class="pay-kv-row">
                  <span class="pay-kv-label">下单时间</span>
                  <span class="pay-kv-value">{{ detail.createTime || "—" }}</span>
                </div>
                <div class="pay-kv-row">
                  <span class="pay-kv-label">应付金额</span>
                  <span class="pay-kv-money">
                    <span class="pay-yen">¥</span>
                    <span class="pay-int">{{ moneyParts.intPart }}</span>
                    <span class="pay-dec">.{{ moneyParts.decPart }}</span>
                  </span>
                </div>
              </div>
            </section>

            <p class="pay-section-label">
              选择支付方式
            </p>
            <section class="pay-card pay-methods">
              <button
                type="button"
                class="pay-method"
                :class="{ active: payChannel === 'wechat' }"
                @click="payChannel = 'wechat'"
              >
                <span class="pay-method-left">
                  <img
                    class="pay-method-logo"
                    :src="payWechatIcon"
                    alt=""
                    width="28"
                    height="28"
                    aria-hidden="true"
                  >
                  <span>微信支付</span>
                </span>
                <span
                  class="pay-radio"
                  :class="{ on: payChannel === 'wechat' }"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="pay-method"
                :class="{ active: payChannel === 'alipay' }"
                @click="payChannel = 'alipay'"
              >
                <span class="pay-method-left">
                  <img
                    class="pay-method-logo"
                    :src="payAlipayIcon"
                    alt=""
                    width="28"
                    height="28"
                    aria-hidden="true"
                  >
                  <span>支付宝</span>
                </span>
                <span
                  class="pay-radio"
                  :class="{ on: payChannel === 'alipay' }"
                  aria-hidden="true"
                />
              </button>
            </section>

            <button
              type="button"
              class="pay-agree"
              @click="agreed = !agreed"
            >
              <span
                class="pay-agree-box"
                :class="{ on: agreed }"
                aria-hidden="true"
              />
              <span class="pay-agree-text">
                我已阅读并同意：
                <a
                  href="/agreement/user"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                >《用户服务协议》</a>、
                <a
                  href="/agreement/privacy"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                >《隐私政策》</a>
                和
                <a
                  href="/agreement/stub"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                >《风险揭示书》</a>
              </span>
            </button>

            <p
              v-if="error"
              class="pay-error inline"
            >
              {{ error }}
            </p>
          </template>
        </div>

        <div
          v-if="detail && !loading"
          class="pay-foot"
        >
          <button
            type="button"
            class="pay-primary"
            :disabled="!agreed || prepaying"
            @click="onConfirmPay"
          >
            {{ prepaying ? "发起支付中…" : "确认支付" }}
          </button>
        </div>

        <div
          v-if="alipayCopyOpen"
          class="pay-alipay-mask"
          role="dialog"
          aria-modal="true"
          aria-label="支付宝支付"
        >
          <div class="pay-alipay-card">
            <h3>请复制链接完成支付</h3>
            <p>微信内无法直接打开支付宝，请复制链接后在系统浏览器中打开。</p>
            <p class="pay-alipay-url">
              {{ alipayCopyUrl }}
            </p>
            <div class="pay-alipay-actions">
              <button
                type="button"
                class="pay-alipay-cancel"
                @click="onCloseAlipayCopy"
              >
                取消
              </button>
              <button
                type="button"
                class="pay-alipay-ok"
                @click="onCopyAlipayLink"
              >
                复制链接
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pay-root {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei",
    sans-serif;
}

.pay-nav {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 8px;
  padding-top: env(safe-area-inset-top, 0);
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.pay-nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #1f2329;
  cursor: pointer;
}

.pay-nav-back svg {
  width: 22px;
  height: 22px;
}

.pay-nav-title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
}

.pay-nav-spacer {
  width: 40px;
}

.pay-risk-banner {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #e8f8ef;
  color: #1a9f4b;
  font-size: 13px;
  font-weight: 500;
}

.pay-risk-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #22c55e;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.pay-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 12px 20px;
  -webkit-overflow-scrolling: touch;
}

.pay-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 16px;
  color: #8a9199;
  font-size: 14px;
}

.pay-spinner {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid #d5dbe6;
  border-top-color: #8a9199;
  animation: pay-spin 0.8s linear infinite;
}

@keyframes pay-spin {
  to {
    transform: rotate(360deg);
  }
}

.pay-error {
  margin: 0;
  color: #f5222d;
  text-align: center;
  font-size: 13px;
}

.pay-error.inline {
  margin-top: 12px;
}

.pay-retry {
  height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #2f6bff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.pay-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.pay-product {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 14px 12px;
}

.pay-cover {
  flex: none;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 8px;
  background: #eef1f6;
}

.pay-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pay-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #b0b7c0;
}

.pay-cover-empty svg {
  width: 22px;
  height: 22px;
}

.pay-product-name {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding-top: 2px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
  color: #1f2329;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.pay-kv {
  border-top: 1px solid #f0f2f5;
  padding: 2px 14px 6px;
}

.pay-kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  border-bottom: 1px solid #f0f2f5;
}

.pay-kv-row:last-child {
  border-bottom: 0;
}

.pay-kv-label {
  flex: none;
  font-size: 13px;
  color: #8a9199;
}

.pay-kv-value {
  min-width: 0;
  font-size: 13px;
  color: #1f2329;
  text-align: right;
  word-break: break-all;
}

.pay-kv-money {
  display: inline-flex;
  align-items: baseline;
  color: #1f2329;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pay-yen {
  font-size: 13px;
  margin-right: 1px;
}

.pay-int {
  font-size: 18px;
  letter-spacing: -0.02em;
}

.pay-dec {
  font-size: 13px;
}

.pay-section-label {
  margin: 16px 4px 8px;
  font-size: 13px;
  color: #8a9199;
}

.pay-methods {
  padding: 0 14px;
}

.pay-method {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #f0f2f5;
  background: transparent;
  color: #1f2329;
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.pay-method:last-child {
  border-bottom: 0;
}

.pay-method-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pay-method-logo {
  display: block;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
}

.pay-radio {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1.5px solid #c9cdd6;
  box-sizing: border-box;
  position: relative;
}

.pay-radio.on {
  border-color: #2f6bff;
  background: #2f6bff;
}

.pay-radio.on::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #fff;
}

.pay-agree {
  margin-top: 14px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #8a9199;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pay-agree-box {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border-radius: 999px;
  border: 1.5px solid #c9cdd6;
  box-sizing: border-box;
  position: relative;
}

.pay-agree-box.on {
  border-color: #2f6bff;
  background: #2f6bff;
}

.pay-agree-box.on::after {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: 999px;
  background: #fff;
}

.pay-agree-text {
  font-size: 12px;
  line-height: 1.55;
}

.pay-agree-text a {
  color: #2f6bff;
  text-decoration: none;
}

.pay-foot {
  flex: none;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.04);
}

.pay-primary {
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

.pay-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.pay-primary:not(:disabled):active {
  background: #2558db;
}

.pay-fade-enter-active,
.pay-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pay-fade-enter-from,
.pay-fade-leave-to {
  opacity: 0;
}

.pay-alipay-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
}

.pay-alipay-card {
  width: 100%;
  max-width: 360px;
  padding: 20px 18px 16px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}

.pay-alipay-card h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  text-align: center;
}

.pay-alipay-card > p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #5c6570;
  text-align: center;
}

.pay-alipay-url {
  word-break: break-all;
  font-size: 12px !important;
  color: #8a9199 !important;
  max-height: 72px;
  overflow: auto;
  text-align: left !important;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7fb;
}

.pay-alipay-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

.pay-alipay-cancel,
.pay-alipay-ok {
  flex: 1;
  height: 42px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.pay-alipay-cancel {
  border: 1px solid #d5dbe6;
  background: #fff;
  color: #5c6570;
}

.pay-alipay-ok {
  border: 0;
  background: #2f6bff;
  color: #fff;
}
</style>
