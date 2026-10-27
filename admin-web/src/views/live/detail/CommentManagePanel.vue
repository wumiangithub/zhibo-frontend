<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { fetchActivityChatFilterPageUrl, type ActivityId } from "@/api/activity";
import { useAuthStore } from "@/stores/auth";

const props = defineProps<{ activityId: ActivityId }>();
const auth = useAuthStore();

const loading = ref(false);
const pageUrl = ref("");
const errorMsg = ref("");
let loadSeq = 0;

async function loadPageUrl() {
  const seq = ++loadSeq;
  loading.value = true;
  errorMsg.value = "";
  pageUrl.value = "";
  try {
    const res = await fetchActivityChatFilterPageUrl(props.activityId, {
      name: auth.displayName,
    });
    if (seq !== loadSeq) return;
    pageUrl.value = res.pageUrl?.trim() ?? "";
    if (!pageUrl.value) {
      errorMsg.value = "暂无审核页";
    }
  } catch (e) {
    if (seq !== loadSeq) return;
    errorMsg.value = e instanceof Error ? e.message : "加载失败";
    ElMessage.error(errorMsg.value);
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

onMounted(() => {
  void loadPageUrl();
});

watch(
  () => props.activityId,
  () => {
    void loadPageUrl();
  },
);
</script>

<template>
  <div class="comment-manage">
    <div class="iframe-wrap">
      <div
        v-if="loading && !pageUrl"
        class="state"
      >
        加载中…
      </div>
      <iframe
        v-else-if="pageUrl"
        :src="pageUrl"
        class="iframe"
        title="评论审核"
        allow="fullscreen"
      />
      <div
        v-else
        class="state"
      >
        {{ errorMsg || "暂无审核页" }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-manage {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.iframe-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
.state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
}
</style>
