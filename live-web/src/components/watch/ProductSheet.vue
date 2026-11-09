<script setup lang="ts">
import UiBottomSheet from "@/components/UiBottomSheet.vue";

/** 弹层展示项：订单中心优先，缺字段回退本站快照名 */
export interface CartProductDisplay {
  spuId: string;
  productName: string;
  coverImg?: string;
  priceText?: string;
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
    <div class="px-4 py-2">
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-3 py-14 text-[var(--lw-text-muted)]"
      >
        <span class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--lw-border-strong)] border-t-[var(--lw-text-secondary)]" />
        <p class="text-sm">
          加载中…
        </p>
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center gap-2 py-14"
      >
        <p class="text-sm text-[var(--lw-color-danger)]">
          {{ error }}
        </p>
      </div>

      <div
        v-else-if="products.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-14 text-[var(--lw-text-secondary)]"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lw-bg-elevated)] text-[var(--lw-text-muted)]"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </span>
        <p class="text-sm">
          本场暂无关联商品
        </p>
      </div>

      <ul
        v-else
        class="m-0 list-none divide-y divide-[var(--lw-border)] p-0"
      >
        <li
          v-for="(item, idx) in products"
          :key="item.spuId"
          class="flex items-stretch gap-3 py-3"
        >
          <!-- 封面居左 -->
          <div class="relative h-[76px] w-[76px] flex-none overflow-hidden rounded-xl bg-[var(--lw-bg-elevated)]">
            <img
              v-if="item.coverImg"
              :src="item.coverImg"
              :alt="item.productName"
              class="h-full w-full object-cover"
              loading="lazy"
            >
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--lw-bg-elevated)] text-[var(--lw-text-muted)]"
              aria-hidden="true"
            >
              <svg class="h-7 w-7 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span class="text-[10px] tracking-wide">暂无封面</span>
            </div>
            <span
              class="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded bg-black/55 px-1 text-[10px] font-medium tabular-nums text-white/90"
            >
              {{ idx + 1 }}
            </span>
          </div>

          <!-- 中间：标题 + 价格 -->
          <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <p class="line-clamp-2 text-[15px] font-medium leading-5 text-[var(--lw-text-primary)]">
              {{ item.productName || '未命名商品' }}
            </p>
            <p
              v-if="item.priceText"
              class="mt-auto truncate text-[17px] font-semibold tabular-nums tracking-tight text-[var(--lw-color-brand)]"
            >
              {{ item.priceText }}
            </p>
            <p
              v-else
              class="mt-auto text-sm text-[var(--lw-text-muted)]"
            >
              价格待定
            </p>
          </div>

          <!-- 右侧：购买 -->
          <div class="flex flex-none items-end pb-0.5">
            <button
              type="button"
              class="h-8 rounded-full bg-[var(--lw-color-brand)] px-3.5 text-[13px] font-medium text-[var(--lw-text-on-brand)] shadow-sm active:bg-[var(--lw-color-brand-hover)]"
              @click="emit('buy', item)"
            >
              购买
            </button>
          </div>
        </li>
      </ul>
    </div>
  </UiBottomSheet>
</template>
