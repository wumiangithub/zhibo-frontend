<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getViewerOrderPaidInfo,
  type ViewerOrderPaidInfo,
} from "@/api/orderCenter";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

const DEFAULT_COVER = "/audience/cover-course-1.png";

const route = useRoute();
const { toast } = useToast();

const detail = ref<ViewerOrderPaidInfo | null>(null);
const loading = ref(true);
const errorText = ref("");

const orderId = computed(() => String(route.params.orderId ?? "").trim());

const coverSrc = computed(
  () => detail.value?.productImg?.trim() || DEFAULT_COVER,
);

const validityText = computed(() => {
  const days = detail.value?.totalDays;
  if (days == null || days <= 0) return "";
  return `有效期：${days}天`;
});

const moneyText = computed(() => {
  const raw = detail.value?.orderMoney?.trim() || "";
  if (!raw) return "¥0.00";
  if (raw.startsWith("¥")) return raw;
  return `¥${raw}`;
});

function errText(e: unknown): string {
  const msg = e instanceof Error && e.message ? e.message : "加载失败";
  return String(msg).slice(0, 40) || "加载失败";
}

async function load() {
  const id = orderId.value;
  if (!id) {
    detail.value = null;
    errorText.value = "订单无效";
    loading.value = false;
    return;
  }
  loading.value = true;
  errorText.value = "";
  try {
    detail.value = await getViewerOrderPaidInfo(id);
  } catch (e) {
    if (isViewerLoginRequiredError(e)) {
      const outcome = await recoverViewerAuth(route.fullPath);
      if (outcome !== "refreshed") return;
      try {
        detail.value = await getViewerOrderPaidInfo(id);
        return;
      } catch (again) {
        detail.value = null;
        errorText.value = errText(again);
        toast(errorText.value);
        return;
      }
    }
    detail.value = null;
    errorText.value = errText(e);
    toast(errorText.value);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <AudienceFrame title="订单详情">
    <div class="page">
      <p
        v-if="loading"
        class="state"
      >
        加载中…
      </p>
      <div
        v-else-if="errorText || !detail"
        class="state"
      >
        <p class="state-text">
          {{ errorText || "订单不存在" }}
        </p>
        <button
          type="button"
          class="retry"
          @click="load"
        >
          重试
        </button>
      </div>
      <template v-else>
        <section class="product">
          <img
            class="cover"
            :src="coverSrc"
            alt=""
          >
          <div class="info">
            <h2 class="name">
              {{ detail.productName || "商品" }}
            </h2>
            <p
              v-if="validityText"
              class="meta"
            >
              {{ validityText }}
            </p>
            <p class="price">
              {{ moneyText }}
            </p>
          </div>
        </section>

        <section class="rows">
          <div class="row">
            <span class="label">订单编号</span>
            <span class="value">{{ detail.orderNo || "--" }}</span>
          </div>
          <div class="row">
            <span class="label">支付方式</span>
            <span class="value">{{ detail.payWayText || "--" }}</span>
          </div>
          <div class="row">
            <span class="label">支付时间</span>
            <span class="value">{{ detail.payTime || "--" }}</span>
          </div>
          <div class="row">
            <span class="label">支付流水号</span>
            <span class="value">{{ detail.paySerialNo || "--" }}</span>
          </div>
        </section>
      </template>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  box-sizing: border-box;
  background: #ffffff;
}
.state {
  padding: 80px 20px;
  text-align: center;
  color: #999999;
  font-size: 14px;
}
.state-text {
  margin: 0;
}
.retry {
  margin-top: 16px;
  height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #f5f5f5;
  color: #1677ff;
  font-size: 14px;
  cursor: pointer;
}
.product {
  display: flex;
  align-items: flex-start;
  padding: 16px 16px 20px;
}
.cover {
  width: 88px;
  height: 88px;
  border-radius: 6px;
  background: #eef3f9;
  flex-shrink: 0;
  margin-right: 12px;
  object-fit: cover;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111111;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}
.meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999999;
  line-height: 1.3;
}
.price {
  margin: 10px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: #111111;
  line-height: 1.3;
}
.rows {
  padding: 0 16px 24px;
}
.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid #f0f0f0;
  font-size: 14px;
  line-height: 1.45;
}
.label {
  flex-shrink: 0;
  color: #999999;
}
.value {
  flex: 1;
  min-width: 0;
  text-align: right;
  color: #111111;
  word-break: break-all;
}
</style>
