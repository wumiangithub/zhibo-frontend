<script setup lang="ts">
/**
 * 通用面包屑：样式与交互对齐直播报备审核页
 * （LiveReportAuditView 原 `.crumb`：主色可点链接 + 灰分隔 + 末级不可点）
 */
import type { RouteLocationRaw } from "vue-router";
import { RouterLink } from "vue-router";

export type AppBreadcrumbItem = {
  label: string;
  /** 有 to 则可点击跳转；末级通常不传 */
  to?: RouteLocationRaw;
};

defineProps<{
  items: AppBreadcrumbItem[];
}>();
</script>

<template>
  <nav
    class="app-breadcrumb"
    aria-label="面包屑"
  >
    <template
      v-for="(item, i) in items"
      :key="`${i}-${item.label}`"
    >
      <RouterLink
        v-if="item.to"
        :to="item.to"
      >
        {{ item.label }}
      </RouterLink>
      <span v-else>{{ item.label }}</span>
      <span v-if="i < items.length - 1">/</span>
    </template>
  </nav>
</template>

<style scoped>
/* 对齐 LiveReportAuditView 原 .crumb */
.app-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #999;
}
.app-breadcrumb a {
  color: var(--color-primary);
  text-decoration: none;
}
.app-breadcrumb a:hover {
  text-decoration: underline;
}
.app-breadcrumb span:not(:last-child) {
  color: #d9d9d9;
}
</style>
