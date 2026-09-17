<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const id = ref("");

function go() {
  const n = Number(id.value);
  if (Number.isInteger(n) && n > 0) {
    router.push(`/watch/${n}`);
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-900 p-6 text-white">
    <h1 class="text-xl font-bold text-green-400">直播观看端</h1>
    <p class="text-sm text-gray-400">输入活动 ID 进入观看页</p>
    <div class="flex items-center gap-2">
      <input
        v-model="id"
        type="number"
        min="1"
        placeholder="活动 ID"
        class="w-40 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        @keyup.enter="go"
      />
      <button
        class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700"
        @click="go"
      >
        进入
      </button>
    </div>
  </div>
</template>
