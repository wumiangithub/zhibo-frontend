<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getFeedbackDetail, type FeedbackDetail } from "@/api/feedback";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

const route = useRoute();
const { toast } = useToast();

const detail = ref<FeedbackDetail | null>(null);
const loading = ref(true);
const previewUrl = ref("");

function errText(e: unknown): string {
  const msg = e instanceof Error && e.message ? e.message : "加载失败";
  return String(msg).slice(0, 40) || "加载失败";
}

async function load() {
  const id = String(route.params.id ?? "").trim();
  if (!id) {
    detail.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    detail.value = await getFeedbackDetail(id);
  } catch (e) {
    if (isViewerLoginRequiredError(e)) {
      const outcome = await recoverViewerAuth(route.fullPath);
      if (outcome !== "refreshed") return;
      try {
        detail.value = await getFeedbackDetail(id);
        return;
      } catch (again) {
        detail.value = null;
        toast(errText(again));
        return;
      }
    }
    detail.value = null;
    toast(errText(e));
  } finally {
    loading.value = false;
  }
}

function onPreview(url: string) {
  const urls = (detail.value?.images || []).map((item) => item.url).filter(Boolean);
  if (!url || !urls.length) return;
  previewUrl.value = url;
}

onMounted(() => {
  void load();
});
</script>

<template>
  <AudienceFrame title="反馈详情">
    <div class="wrap">
    <div
      v-if="detail"
      class="page"
    >
      <section class="card">
        <div class="row">
          <span class="label">意见类型</span>
          <span class="value">{{ detail.categoryLabel }}</span>
        </div>
        <div class="row">
          <span class="label">提交时间</span>
          <span class="value muted">{{ detail.createdTime }}</span>
        </div>
      </section>

      <section class="card">
        <div class="block-label">
          意见描述
        </div>
        <div class="body">
          {{ detail.content }}
        </div>
      </section>

      <section
        v-if="detail.images.length"
        class="card"
      >
        <div class="block-label">
          相关截图
        </div>
        <div class="shots">
          <button
            v-for="(item, index) in detail.images"
            :key="item.objectKey || index"
            type="button"
            class="shot"
            @click="onPreview(item.url)"
          >
            <img
              :src="item.url"
              alt=""
            >
          </button>
        </div>
      </section>

      <section
        v-if="detail.contactPhone"
        class="card"
      >
        <div class="row">
          <span class="label">联系方式</span>
          <span class="value">{{ detail.contactPhone }}</span>
        </div>
      </section>
    </div>
    <p
      v-else-if="loading"
      class="page empty"
    >
      加载中…
    </p>
    <p
      v-else
      class="page empty"
    >
      反馈不存在或已删除
    </p>

    <div
      v-if="previewUrl"
      class="preview"
      @click="previewUrl = ''"
    >
      <img
        :src="previewUrl"
        alt=""
      >
    </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  box-sizing: border-box;
  padding: 12px 16px 24px;
  background: #f5f5f5;
}
.empty {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  font-size: 14px;
}
.card {
  background: #ffffff;
  border-radius: 8px;
  padding: 4px 14px;
  margin-bottom: 10px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  border-bottom: 1px solid #f0f0f0;
}
.card .row:last-child {
  border-bottom: none;
}
.label {
  font-size: 14px;
  color: #666666;
  flex-shrink: 0;
}
.value {
  font-size: 14px;
  color: #111111;
  text-align: right;
  margin-left: 12px;
  word-break: break-all;
}
.value.muted {
  color: #999999;
}
.block-label {
  padding-top: 12px;
  font-size: 14px;
  color: #666666;
  margin-bottom: 8px;
}
.body {
  padding-bottom: 14px;
  font-size: 15px;
  color: #111111;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
.shots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 14px;
}
.shot {
  width: 80px;
  height: 80px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: #f0f0f0;
  overflow: hidden;
  cursor: pointer;
}
.shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(0, 0, 0, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
