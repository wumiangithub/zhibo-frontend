<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";

const route = useRoute();
const title = computed(() => (route.name === "course-data" ? "数据分析" : "课程设置"));
const tip = computed(() =>
  route.name === "course-data"
    ? "数据分析下一期再做。"
    : "内容、章节和定价下一期再做。新建课程已经可以提交审核。",
);
const crumbs = computed<AppBreadcrumbItem[]>(() => [
  { label: "课程管理", to: "/course" },
  { label: title.value },
]);
</script>

<template>
  <div class="course-placeholder">
    <AppBreadcrumb :items="crumbs" />
    <div class="card">
      <h2>{{ title }}</h2>
      <p>{{ tip }}</p>
    </div>
  </div>
</template>

<style scoped>
.card {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border-radius: 8px;
}
.card h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
.card p {
  margin: 0;
  color: #999;
  font-size: 14px;
}
</style>
