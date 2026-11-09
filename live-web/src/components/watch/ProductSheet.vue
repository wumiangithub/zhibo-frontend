<script setup lang="ts">
import UiBottomSheet from "@/components/UiBottomSheet.vue";

/** 弹层展示项：订单中心优先，缺字段回退本站快照名 */
export interface CartProductDisplay {
  spuId: string;
  productName: string;
  coverImg?: string;
  priceText?: string;
  /** 如 `有效期:180天` */
  validityText?: string;
  /** 封面角标，缺省「课程」 */
  typeLabel?: string;
  /**
   * by-ids 未返回该绑定 spu（下架/不存在）时为 true：仍展示行，不可去抢购。
   */
  offShelf?: boolean;
}

defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  products: CartProductDisplay[];
}>();

const emit = defineEmits<{
  close: [];
  /** 点击购买；后续接订单中心下单链路 */
  buy: [item: CartProductDisplay];
}>();
</script>

<template>
  <UiBottomSheet
    :open="open"
    title="本场商品"
    @close="emit('close')"
  >
    <div class="cart-sheet">
      <div
        v-if="loading"
        class="cart-state"
      >
        <span class="cart-spinner" />
        <p>加载中…</p>
      </div>

      <div
        v-else-if="error"
        class="cart-state"
      >
        <p class="cart-error">
          {{ error }}
        </p>
      </div>

      <div
        v-else-if="products.length === 0"
        class="cart-state"
      >
        <p>本场暂无关联商品</p>
      </div>

      <template v-else>
        <ul class="cart-list">
          <li
            v-for="(item, idx) in products"
            :key="item.spuId"
            class="cart-item"
            :class="{ 'is-off-shelf': item.offShelf }"
          >
            <div class="cart-cover">
              <img
                v-if="item.coverImg"
                :src="item.coverImg"
                :alt="item.productName"
                class="cart-cover-img"
                loading="lazy"
              >
              <div
                v-else
                class="cart-cover-empty"
                aria-hidden="true"
              >
                暂无封面
              </div>
              <span class="cart-idx">{{ idx + 1 }}</span>
              <span class="cart-type">{{ item.typeLabel || "课程" }}</span>
            </div>

            <div class="cart-body">
              <p class="cart-title">
                {{ item.productName || "未命名商品" }}
              </p>
              <p
                v-if="item.validityText"
                class="cart-validity"
              >
                {{ item.validityText }}
              </p>
              <div class="cart-foot">
                <p
                  v-if="item.priceText"
                  class="cart-price"
                >
                  {{ item.priceText }}
                </p>
                <p
                  v-else
                  class="cart-price cart-price--muted"
                >
                  价格待定
                </p>
                <button
                  v-if="item.offShelf"
                  type="button"
                  class="cart-buy cart-buy--off"
                  disabled
                >
                  已下架
                </button>
                <button
                  v-else
                  type="button"
                  class="cart-buy"
                  @click="emit('buy', item)"
                >
                  去抢购
                </button>
              </div>
            </div>
          </li>
        </ul>
        <p class="cart-end">
          没有更多了
        </p>
      </template>
    </div>
  </UiBottomSheet>
</template>

<style scoped>
.cart-sheet {
  padding: 8px 16px 16px;
}

.cart-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 0;
  color: var(--lw-text-secondary);
  font-size: 14px;
}

.cart-error {
  margin: 0;
  color: var(--lw-color-danger);
}

.cart-spinner {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid var(--lw-border-strong);
  border-top-color: var(--lw-text-secondary);
  animation: cart-spin 0.8s linear infinite;
}

@keyframes cart-spin {
  to {
    transform: rotate(360deg);
  }
}

.cart-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cart-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}

.cart-cover {
  position: relative;
  flex: none;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--lw-bg-elevated);
}

.cart-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cart-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 11px;
  color: var(--lw-text-muted);
}

.cart-idx {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  /* 与 .cart-cover 左上圆角重合；右下略收，贴角不悬空 */
  border-radius: 8px 0 6px 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.cart-type {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  line-height: 14px;
}

.cart-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cart-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--lw-text-primary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}

.cart-validity {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--lw-text-secondary);
}

.cart-foot {
  margin-top: auto;
  padding-top: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.cart-price {
  margin: 0;
  min-width: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--lw-color-danger);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.cart-price--muted {
  font-size: 13px;
  font-weight: 400;
  color: var(--lw-text-muted);
}

.cart-buy {
  flex: none;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--lw-color-brand);
  color: var(--lw-text-on-brand);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cart-buy:active {
  background: var(--lw-color-brand-hover);
}

.cart-buy--off,
.cart-buy--off:disabled {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-muted);
  cursor: not-allowed;
}

.cart-item.is-off-shelf .cart-title,
.cart-item.is-off-shelf .cart-validity,
.cart-item.is-off-shelf .cart-price {
  color: var(--lw-text-muted);
}

.cart-item.is-off-shelf .cart-cover {
  opacity: 0.72;
}

.cart-end {
  margin: 4px 0 0;
  padding: 12px 0 4px;
  text-align: center;
  font-size: 12px;
  color: var(--lw-text-muted);
}
</style>
