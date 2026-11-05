<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import { getNewsDetail, type NewsCard } from "@/data/mockNews";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const detail = ref<NewsCard | null>(null);

const id = computed(() => String(route.params.id ?? ""));

onMounted(() => {
  const found = getNewsDetail(id.value);
  if (!found) {
    toast("内容不存在");
    void router.replace({ name: "news-home" });
    return;
  }
  detail.value = found;
});
</script>

<template>
  <AudienceFrame title="详情">
    <article
      v-if="detail"
      class="page"
    >
      <h2 class="title">
        {{ detail.title }}
      </h2>
      <p class="meta">
        <span>{{ detail.source }}</span>
        <span class="gap">{{ detail.time }}</span>
      </p>
      <p class="body">
        {{ detail.body }}
      </p>
    </article>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  overflow: auto;
  padding: 16px 20px 40px;
  background: #ffffff;
}
.title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: #111111;
  line-height: 1.45;
}
.meta {
  margin: 0 0 20px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 17px;
}
.gap {
  margin-left: 8px;
}
.body {
  margin: 0;
  font-size: 15px;
  line-height: 1.85;
  color: #262626;
  word-break: break-word;
}
</style>
