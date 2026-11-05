<script setup lang="ts">
import { useRouter } from "vue-router";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";

const router = useRouter();

const items = [
  { id: "user", title: "服务协议", name: "agreement-user" },
  { id: "privacy", title: "个人信息保护政策", name: "agreement-privacy" },
  { id: "privacy-summary", title: "隐私政策摘要", stub: true },
  { id: "collect", title: "个人信息收集清单", stub: true },
  { id: "share", title: "个人信息共享清单", stub: true },
] as const;

function open(item: (typeof items)[number]) {
  if ("stub" in item && item.stub) {
    void router.push({
      name: "agreement-stub",
      query: { title: item.title },
    });
    return;
  }
  if ("name" in item) {
    void router.push({ name: item.name });
  }
}
</script>

<template>
  <AudienceFrame title="服务协议">
    <div class="page">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="row"
        :class="{ last: index === items.length - 1 }"
        @click="open(item)"
      >
        <span>{{ item.title }}</span>
        <span class="chev">›</span>
      </button>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  background: #ffffff;
}
.row {
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid #f0f0f0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  color: #111111;
  cursor: pointer;
}
.row.last {
  border-bottom: 0;
}
.chev {
  font-size: 22px;
  color: #bfbfbf;
  line-height: 1;
}
</style>
