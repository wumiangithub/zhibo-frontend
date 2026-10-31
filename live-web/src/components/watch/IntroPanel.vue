<script setup lang="ts">
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
  }>(),
  {
    readonlyChat: false,
    showLike: true,
    likeCount: 0,
  },
);

const emit = defineEmits<{
  goChat: [];
  cart: [];
  like: [];
}>();
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <h3 class="mb-3 text-base font-semibold text-white">
        {{ title }}
      </h3>
      <div class="space-y-2 text-sm text-gray-400">
        <p v-if="startTime">
          <span class="text-gray-500">开始时间：</span>
          <span>{{ startTime }}</span>
        </p>
        <p v-if="endTime">
          <span class="text-gray-500">结束时间：</span>
          <span>{{ endTime }}</span>
        </p>
      </div>
    </div>
    <div class="flex flex-none items-center gap-2 border-t border-gray-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <button
        type="button"
        class="min-w-0 flex-1 rounded-full bg-gray-800 px-3 py-2 text-left text-sm text-gray-500"
        @click="emit('goChat')"
      >
        {{ readonlyChat ? "查看聊天" : "参与聊天" }}
      </button>
      <button
        type="button"
        class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-yellow-400"
        title="购物车"
        @click="emit('cart')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2.3 2.3c-.4.4-.1 1.1.5 1.1H17M10 20a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      </button>
      <button
        v-if="showLike"
        type="button"
        class="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-800 text-red-400"
        title="点赞"
        @click="emit('like')"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        <span
          v-if="likeCount > 0"
          class="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-red-500 px-1 text-center text-[10px] leading-[14px] text-white"
        >
          {{ likeCount > 99999 ? "99999+" : likeCount }}
        </span>
      </button>
    </div>
  </div>
</template>
