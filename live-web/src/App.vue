<script setup lang="ts"></script>

<template>
  <!-- 移动优先：默认全屏铺满；md 断点(≥768px)起居中限宽，适配 PC -->
  <div class="min-h-dvh bg-black text-white md:flex md:items-center md:justify-center md:bg-gray-900">
    <div class="flex min-h-dvh flex-col items-center justify-center gap-2 md:min-h-0 md:aspect-video md:w-[800px] md:max-w-full md:rounded-lg">
      <h1 class="text-xl font-bold text-green-400">live-web 脚手架已就绪</h1>
      <p class="text-sm text-gray-400">移动端全屏 / PC 居中限宽，UnoCSS 生效则标题为绿色。</p>
    </div>
  </div>
</template>
