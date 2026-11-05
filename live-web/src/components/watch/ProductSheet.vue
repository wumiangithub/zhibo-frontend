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

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <UiBottomSheet
    :open="open"
    title="本场商品"
    @close="emit('close')"
  >
    <div class="px-4 py-3">
      <p
        v-if="loading"
        class="py-10 text-center text-sm text-gray-400"
      >
        加载中…
      </p>
      <p
        v-else-if="error"
        class="py-10 text-center text-sm text-red-400"
      >
        {{ error }}
      </p>
      <p
        v-else-if="products.length === 0"
        class="py-10 text-center text-sm text-gray-500"
      >
        本场暂无关联商品
      </p>
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="item in products"
          :key="item.spuId"
          class="flex items-start gap-3 rounded-lg bg-gray-800/80 px-3 py-3"
        >
          <img
            v-if="item.coverImg"
            :src="item.coverImg"
            :alt="item.productName"
            class="h-14 w-14 flex-none rounded-md object-cover bg-gray-700"
          >
          <span
            v-else
            class="mt-0.5 flex h-14 w-14 flex-none items-center justify-center rounded-md bg-yellow-500/20 text-yellow-400"
            aria-hidden="true"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-sm font-medium text-gray-100">
              {{ item.productName || '未命名商品' }}
            </p>
            <p
              v-if="item.priceText"
              class="mt-1 text-sm font-medium text-yellow-400"
            >
              {{ item.priceText }}
            </p>
            <p class="mt-1 truncate text-xs text-gray-500">
              ID {{ item.spuId }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </UiBottomSheet>
</template>
