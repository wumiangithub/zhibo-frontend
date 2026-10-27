<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

/** 弹层展示项：订单中心优先，缺字段回退本站快照名 */
export interface CartProductDisplay {
  spuId: string;
  productName: string;
  coverImg?: string;
  priceText?: string;
}

const props = defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  products: CartProductDisplay[];
}>();

const emit = defineEmits<{ close: [] }>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      document.addEventListener("keydown", onKeydown);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", onKeydown);
      document.body.style.overflow = "";
    }
  },
);

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[90] flex flex-col justify-end"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/60"
        aria-label="关闭"
        @click="emit('close')"
      />
      <div
        class="relative flex max-h-[70dvh] w-full flex-col rounded-t-2xl bg-gray-900 text-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="本场商品"
      >
        <div class="flex flex-none items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 class="text-base font-semibold">本场商品</h2>
          <button
            type="button"
            class="rounded-md bg-transparent px-2 py-1 text-sm text-gray-400 hover:text-white"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
      </div>
    </div>
  </Teleport>
</template>
