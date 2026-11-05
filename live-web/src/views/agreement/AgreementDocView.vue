<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";

const route = useRoute();

const title = computed(() => {
  if (route.name === "agreement-stub") {
    const raw = String(route.query.title ?? "").trim();
    return raw || "协议";
  }
  return route.name === "agreement-privacy" ? "隐私协议" : "用户协议";
});

const body = computed(() =>
  route.name === "agreement-stub"
    ? "协议正文待运营提供"
    : "协议正文待法务提供",
);
</script>

<template>
  <AudienceFrame :title="title">
    <p class="body">
      {{ body }}
    </p>
  </AudienceFrame>
</template>

<style scoped>
.body {
  margin: 0;
  padding: 20px 16px;
  font-size: 14px;
  line-height: 22px;
  color: #8c8c8c;
}
</style>
