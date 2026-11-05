<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  isPaidOrder,
  listMyOrders,
  orderStatusLabel,
  ORDER_STATUS_PAID,
  type ViewerOrderItem,
} from "@/api/orderCenter";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

/** 与小程序 pages/orders/list 一致 */
const PAGE_SIZE = 20;
const MAX_SKIP_EMPTY = 5;
const DEFAULT_COVER = "/audience/cover-course-1.png";

interface OrderCard {
  orderNo: string;
  productName: string;
  orderMoney: string;
  coverImg: string;
  statusLabel: string;
  paid: boolean;
  validityText: string;
}

const { toast } = useToast();

const scroller = ref<HTMLElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);
const list = ref<OrderCard[]>([]);
const loading = ref(false);
const noMore = ref(false);
const page = ref(1);
const errorText = ref("");
const moreError = ref("");

let loadGen = 0;
let observer: IntersectionObserver | null = null;
let authRetried = false;

function toCard(item: ViewerOrderItem): OrderCard {
  let validityText = "";
  if (item.validityLabel) {
    validityText = item.validityLabel;
  } else if (item.serviceDay != null && item.serviceDay !== "") {
    validityText = `有效期：${item.serviceDay}天`;
  } else if (item.createTime) {
    validityText = item.createTime;
  }
  return {
    orderNo: item.orderNo,
    productName: item.productName,
    orderMoney: item.orderMoney || "0.00",
    coverImg: item.coverImg,
    statusLabel: orderStatusLabel(item.orderStatus) || "已付款",
    paid: item.orderStatus === ORDER_STATUS_PAID,
    validityText,
  };
}

function reload() {
  authRetried = false;
  page.value = 1;
  noMore.value = false;
  list.value = [];
  errorText.value = "";
  moreError.value = "";
  void fetchPage(1, true, 0);
}

function loadMore() {
  if (loading.value || noMore.value || !list.value.length || moreError.value) return;
  void fetchPage(page.value + 1, false, 0);
}

function retryMore() {
  moreError.value = "";
  loadMore();
}

function needsRelogin(e: unknown): boolean {
  if (isViewerLoginRequiredError(e)) return true;
  const msg = e instanceof Error ? e.message : "";
  return msg.includes("登录已过期");
}

async function fillIfShort() {
  await nextTick();
  const root = scroller.value;
  if (!root || loading.value || noMore.value || moreError.value || !list.value.length) return;
  if (root.scrollHeight <= root.clientHeight + 4) loadMore();
}

async function fetchPage(targetPage: number, replace: boolean, emptySkips: number) {
  const top = emptySkips === 0;
  if (top && loading.value) return;
  const gen = top ? ++loadGen : loadGen;
  if (top) loading.value = true;
  let ok = false;
  try {
    const data = await listMyOrders({ page: targetPage, pageSize: PAGE_SIZE });
    if (gen !== loadGen) return;
    const rawList = data.list;
    const rows = rawList.filter((item) => isPaidOrder(item.orderStatus)).map(toCard);
    const remoteNoMore = rawList.length < PAGE_SIZE;
    if (rows.length === 0 && !remoteNoMore && emptySkips < MAX_SKIP_EMPTY) {
      page.value = targetPage;
      await fetchPage(targetPage + 1, replace, emptySkips + 1);
      ok = true;
      return;
    }
    list.value = replace ? rows : list.value.concat(rows);
    page.value = targetPage;
    noMore.value = remoteNoMore || emptySkips >= MAX_SKIP_EMPTY;
    errorText.value = "";
    moreError.value = "";
    ok = true;
  } catch (e) {
    if (gen !== loadGen) return;
    if (!top) throw e;
    if (!authRetried && needsRelogin(e)) {
      authRetried = true;
      loading.value = false;
      const outcome = await recoverViewerAuth("/orders");
      if (outcome === "refreshed") {
        await fetchPage(targetPage, replace, 0);
      }
      return;
    }
    const msg = e instanceof Error && e.message ? e.message : "网络异常";
    toast(msg.slice(0, 40));
    if (list.value.length === 0) errorText.value = msg;
    else moreError.value = msg;
  } finally {
    if (top && gen === loadGen) {
      loading.value = false;
      if (ok) void fillIfShort();
    }
  }
}

function onTap(item: OrderCard) {
  if (!item.paid) {
    toast("仅已付款订单可查看详情");
    return;
  }
  if (!item.orderNo) return;
  toast("订单详情待接入");
}

function bindObserver() {
  observer?.disconnect();
  const root = scroller.value;
  const el = sentinel.value;
  if (!root || !el) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root, rootMargin: "80px" },
  );
  observer.observe(el);
}

watch(sentinel, () => {
  bindObserver();
}, { flush: "post" });

onMounted(() => {
  bindObserver();
  reload();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <AudienceFrame title="全部订单">
    <div
      ref="scroller"
      class="page"
    >
      <p
        v-if="loading && !list.length"
        class="empty"
      >
        加载中…
      </p>
      <div
        v-else-if="errorText && !list.length"
        class="empty"
      >
        <p class="empty-text">
          {{ errorText }}
        </p>
        <button
          type="button"
          class="retry"
          @click="reload"
        >
          重试
        </button>
      </div>
      <p
        v-else-if="!list.length"
        class="empty"
      >
        暂无已付款订单
      </p>
      <div
        v-else
        class="list"
      >
        <button
          v-for="(item, index) in list"
          :key="`${item.orderNo}-${index}`"
          type="button"
          class="card"
          @click="onTap(item)"
        >
          <span class="card-head">
            <span class="order-no">订单编号: {{ item.orderNo }}</span>
            <span class="status">{{ item.statusLabel }}</span>
          </span>
          <span class="card-body">
            <img
              class="cover"
              :src="item.coverImg || DEFAULT_COVER"
              alt=""
            >
            <span class="info">
              <span class="title">{{ item.productName || "商品" }}</span>
              <span
                v-if="item.validityText"
                class="meta"
              >{{ item.validityText }}</span>
              <span class="price">¥{{ item.orderMoney }}</span>
            </span>
          </span>
        </button>
        <button
          v-if="moreError"
          type="button"
          class="end end-btn"
          @click="retryMore"
        >
          加载失败，点击重试
        </button>
        <p
          v-else-if="loading"
          class="end"
        >
          加载中…
        </p>
        <p
          v-else-if="noMore"
          class="end"
        >
          没有更多了
        </p>
        <div
          ref="sentinel"
          class="sentinel"
        />
      </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  box-sizing: border-box;
  padding: 12px 16px 24px;
  background: #f5f5f5;
}
.empty {
  padding: 80px 20px;
  text-align: center;
  color: #999999;
  font-size: 14px;
}
.empty-text {
  margin: 0;
}
.retry {
  margin-top: 16px;
  height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #ffffff;
  color: #1677ff;
  font-size: 14px;
  cursor: pointer;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  display: block;
  width: 100%;
  background: #ffffff;
  border: 0;
  border-radius: 8px;
  padding: 12px 14px 14px;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.order-no {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}
.status {
  flex-shrink: 0;
  font-size: 13px;
  color: #1677ff;
}
.card-body {
  display: flex;
  align-items: stretch;
}
.cover {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  background: #eef3f9;
  flex-shrink: 0;
  margin-right: 10px;
  object-fit: cover;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.title {
  font-size: 15px;
  color: #111111;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}
.meta {
  margin-top: 6px;
  font-size: 12px;
  color: #999999;
}
.price {
  margin-top: auto;
  padding-top: 6px;
  font-size: 16px;
  color: #111111;
  font-weight: 600;
}
.end {
  text-align: center;
  padding: 12px 0 4px;
  font-size: 12px;
  color: #bfbfbf;
  margin: 0;
}
.end-btn {
  border: 0;
  background: transparent;
  width: 100%;
  cursor: pointer;
  color: #1677ff;
}
.sentinel {
  height: 1px;
}
</style>
