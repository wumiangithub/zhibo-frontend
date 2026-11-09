<script setup lang="ts">
import cartYellowUrl from "@/assets/images/cart-yellow.png";
import couponFloatUrl from "@/assets/images/coupon-float.png";

withDefaults(
  defineProps<{
    title: string;
    startTime?: string | null;
    endTime?: string | null;
    /** 回放：小屏底栏文案改为「查看聊天」 */
    readonlyChat?: boolean;
    /** 回放禁点赞 */
    showLike?: boolean;
    likeCount?: number;
    showCouponIcon?: boolean;
  }>(),
  {
    readonlyChat: false,
    showLike: true,
    likeCount: 0,
    showCouponIcon: false,
  },
);

const emit = defineEmits<{
  goChat: [];
  cart: [];
  coupon: [];
  like: [];
}>();
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <h3 class="mb-3 text-base font-semibold text-[var(--lw-text-primary)]">
        {{ title }}
      </h3>
      <div class="space-y-2 text-sm text-[var(--lw-text-secondary)]">
        <p v-if="startTime">
          <span class="text-[var(--lw-text-muted)]">开始时间：</span>
          <span>{{ startTime }}</span>
        </p>
        <p v-if="endTime">
          <span class="text-[var(--lw-text-muted)]">结束时间：</span>
          <span>{{ endTime }}</span>
        </p>
      </div>
    </div>

    <button
      v-if="showCouponIcon"
      type="button"
      class="absolute top-2 right-2 z-30 flex h-14 w-14 items-center justify-center active:scale-95 md:hidden"
      aria-label="优惠券"
      @click="emit('coupon')"
    >
      <img
        :src="couponFloatUrl"
        alt=""
        class="float-icon h-12 w-12 object-contain"
        draggable="false"
      >
    </button>

    <!-- 小黄车：悬浮右下角（与聊天页一致） -->
    <button
      type="button"
      class="absolute right-2 z-30 flex h-14 w-14 items-center justify-center active:scale-95 md:hidden"
      style="bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px))"
      aria-label="购物车"
      @click="emit('cart')"
    >
      <img
        :src="cartYellowUrl"
        alt=""
        class="float-icon h-12 w-12 object-contain"
        draggable="false"
      >
    </button>

    <div class="flex flex-none items-center gap-2 border-t border-[var(--lw-border)] bg-[var(--lw-bg-chrome)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <button
        type="button"
        class="min-w-0 flex-1 rounded-full bg-[var(--lw-bg-elevated)] px-3 py-2 text-left text-sm text-[var(--lw-text-muted)]"
        @click="emit('goChat')"
      >
        {{ readonlyChat ? "查看聊天" : "参与聊天" }}
      </button>
      <button
        v-if="showLike"
        type="button"
        class="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--lw-bg-elevated)] text-[var(--lw-color-like)]"
        title="点赞"
        @click="emit('like')"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        <span
          v-if="likeCount > 0"
          class="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-[var(--lw-color-like-badge)] px-1 text-center text-[10px] leading-[14px] text-[var(--lw-text-on-brand)]"
        >
          {{ likeCount > 99999 ? "99999+" : likeCount }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.float-icon {
  filter: var(--lw-float-icon-filter);
}
</style>
