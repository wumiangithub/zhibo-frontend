<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();
const title = computed(() => (route.name === "course-data" ? "数据分析" : "课程设置"));
const tip = computed(() =>
  route.name === "course-data"
    ? "数据分析下一期再做。"
    : "内容、章节和定价下一期再做。新建课程已经可以提交审核。",
);
</script>

<template>
  <div class="course-placeholder">
    <div class="crumb">
      <RouterLink
        to="/course"
        class="crumb-link"
      >
        课程管理
      </RouterLink>
      <span class="crumb-sep">/</span>
      <span>{{ title }}</span>
    </div>
    <div class="card">
      <h2>{{ title }}</h2>
      <p>{{ tip }}</p>
    </div>
  </div>
</template>

<style scoped>
.crumb {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}
.crumb-link {
  color: var(--color-primary);
  text-decoration: none;
}
.crumb-sep {
  margin: 0 6px;
  color: #ccc;
}
.card {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border-radius: 8px;
}
.card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}
.card p {
  margin: 0;
  font-size: 13px;
  color: #999;
}
</style>
