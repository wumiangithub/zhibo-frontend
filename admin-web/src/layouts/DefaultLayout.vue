<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <span class="text-base font-bold text-blue-600">直播管理端</span>
        <nav class="flex items-center gap-4 text-sm">
          <RouterLink
            to="/activities"
            class="text-gray-600 hover:text-blue-600"
            active-class="font-medium text-blue-600"
          >
            活动管理
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
