<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enrollCourse } from "@/api/courseEnroll";
import {
  getLearningLessonContent,
  reportLessonProgress,
  type LessonContent,
} from "@/api/learning";
import {
  getViewerAccessToken,
  syncViewerAccessTokenFromUrl,
  syncViewerIdFromUrl,
} from "@/utils/viewerAuth";
import { decodeCourseShareToken } from "@/utils/courseShareToken";
import { goViewerLogin } from "@/utils/viewerLogin";
import {
  buildDocumentPreview,
  type DocumentPreview,
} from "@/utils/documentPreview";
import { getMaterialFileIcon } from "@/utils/materialFileIcons";
import {
  ensureWxJsSdk,
  isLikelyMiniProgramWebView,
  navigateToOpenDocument,
} from "@/utils/miniProgram";
import { isTosCdnConfigured, rewriteTosUrlToCdn } from "@/utils/tosCdn";

const KIND_LIVE = 1;
const KIND_IMAGE = 2;
const KIND_VIDEO = 3;
const KIND_DOCUMENT = 4;
const KIND_ARTICLE = 5;

const route = useRoute();
const router = useRouter();

const courseId = String(route.params.courseId ?? "").trim().toLowerCase();
const lessonNodeId = Number(route.params.lessonNodeId);

syncViewerIdFromUrl(route.query as Record<string, unknown>);
syncViewerAccessTokenFromUrl(route.query as Record<string, unknown>);

const SHARE_STORAGE_PREFIX = "zhibo.courseShare.";

const loading = ref(true);
const errorText = ref("");
const lesson = ref<LessonContent | null>(null);
const articleBody = ref<HTMLElement | null>(null);
const docFrame = ref<HTMLIFrameElement | null>(null);
const scrolledBottom = ref(false);
/** 文档：默认不自动预览，点「预览」后再嵌 iframe */
const docPreviewOpen = ref(false);

let videoLastSec = 0;
let videoReportTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const isImage = computed(() => lesson.value?.contentKind === KIND_IMAGE);
const isVideo = computed(() => lesson.value?.contentKind === KIND_VIDEO);
const isDocument = computed(() => lesson.value?.contentKind === KIND_DOCUMENT);
const isArticle = computed(() => lesson.value?.contentKind === KIND_ARTICLE);

const docPreview = computed<DocumentPreview | null>(() => {
  if (!isDocument.value || !lesson.value?.materialUrl) return null;
  return buildDocumentPreview(
    lesson.value.materialUrl,
    lesson.value.materialName || lesson.value.title,
  );
});

const docFileName = computed(() => {
  const n = lesson.value?.materialName || lesson.value?.title || "文档";
  return String(n).trim() || "文档";
});

const docFileIcon = computed(() => getMaterialFileIcon(docFileName.value));

/** 小程序内优先 CDN（downloadFile 合法域名常配 CDN）；无 CDN 则原生桶。 */
function materialAccessUrl(): string {
  const raw = (lesson.value?.materialUrl || "").trim();
  if (!raw) return "";
  if (isTosCdnConfigured()) return rewriteTosUrlToCdn(raw);
  return raw;
}

async function openDocPreview() {
  const url = materialAccessUrl();
  if (!url) return;

  // 小程序 web-view：禁止 iframe；必须走小程序 downloadFile + openDocument
  if (isLikelyMiniProgramWebView()) {
    const ok = await navigateToOpenDocument({
      url,
      name: docFileName.value,
      mode: "preview",
    });
    if (ok) void report("scroll_bottom");
    return;
  }

  if (!docPreview.value?.cdnReady) return;
  docPreviewOpen.value = true;
  scrolledBottom.value = false;
  void nextTick(() => bindScroll());
}

function closeDocPreview() {
  docPreviewOpen.value = false;
}

function materialFileName(fallback: string) {
  const n = lesson.value?.materialName || lesson.value?.title || fallback;
  return String(n).trim() || fallback;
}

async function downloadMaterial(fallbackName: string) {
  const raw = (lesson.value?.materialUrl || "").trim();
  if (!raw) return;
  const name = materialFileName(fallbackName);

  // 小程序 web-view：禁止 a[download]；走小程序能力
  if (isLikelyMiniProgramWebView()) {
    await navigateToOpenDocument({
      url: materialAccessUrl() || raw,
      name,
      mode: "download",
    });
    return;
  }

  // 独立浏览器 H5：原生桶 attachment
  const a = document.createElement("a");
  a.href = raw;
  a.download = name;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadDocument() {
  void downloadMaterial("文档");
}

function downloadImage() {
  void downloadMaterial("图片");
}

const inMiniProgram = isLikelyMiniProgramWebView();
/** 小程序走原生打开，不依赖 CDN；H5 iframe 预览才需要 CDN */
const canPreviewDocument = computed(
  () => Boolean(lesson.value?.materialUrl) && (inMiniProgram || !!docPreview.value?.cdnReady),
);

async function report(
  event: "open" | "heartbeat" | "scroll_bottom" | "live_ended",
  extra?: { deltaLearnDurationSec?: number; progressBarSec?: number; progressPercent?: number },
) {
  if (!courseId || !Number.isFinite(lessonNodeId) || lessonNodeId <= 0) return;
  try {
    await reportLessonProgress(courseId, {
      lessonNodeId,
      event,
      ...extra,
    });
  } catch {
    /* 上报失败不打断阅读 */
  }
}

function forwardQuery(): string {
  const keep = ["viewerId", "nickname"] as const;
  const parts: string[] = [];
  for (const key of keep) {
    const raw = route.query[key];
    const v = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
    if (v) parts.push(`${key}=${encodeURIComponent(v)}`);
  }
  // token 已落 localStorage；跳转 watch 再带一次便于新开页
  const token = getViewerAccessToken();
  if (token) {
    parts.push(`viewerAccessToken=${encodeURIComponent(token)}`);
  }
  parts.push(`courseId=${encodeURIComponent(courseId)}`);
  parts.push(`lessonNodeId=${encodeURIComponent(String(lessonNodeId))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** 只信 query `c`；hint 可乱改，禁止当邀请人来源。 */
function captureShareFromQuery() {
  const raw = String(route.query.c ?? "").trim();
  const decoded = decodeCourseShareToken(raw);
  if (!decoded || !courseId) return null;
  try {
    sessionStorage.setItem(
      `${SHARE_STORAGE_PREFIX}${courseId}`,
      JSON.stringify(decoded),
    );
  } catch {
    /* ignore */
  }
  return decoded;
}

function readStoredShare(): { inviterId: number } | null {
  if (!courseId) return null;
  try {
    const raw = sessionStorage.getItem(`${SHARE_STORAGE_PREFIX}${courseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { inviterId?: number };
    if (!parsed?.inviterId || parsed.inviterId <= 0) return null;
    return { inviterId: parsed.inviterId };
  } catch {
    return null;
  }
}

/** 分享链先进学员表（带邀请人），再打开小节内容。 */
async function ensureEnrolled() {
  captureShareFromQuery();
  const stored = readStoredShare();
  await enrollCourse(
    courseId,
    stored?.inviterId ? { inviterId: stored.inviterId } : undefined,
  );
}

async function load() {
  loading.value = true;
  errorText.value = "";
  docPreviewOpen.value = false;
  if (!getViewerAccessToken()) {
    errorText.value = "请先登录";
    loading.value = false;
    await goViewerLogin();
    return;
  }
  if (!courseId || !Number.isFinite(lessonNodeId) || lessonNodeId <= 0) {
    errorText.value = "小节链接无效";
    loading.value = false;
    return;
  }
  try {
    await ensureEnrolled();
    const data = await getLearningLessonContent(courseId, lessonNodeId);
    lesson.value = data;
    if (data.contentKind === KIND_LIVE) {
      const activityId = (data.activityId || data.contentId || "").trim();
      if (!activityId) {
        errorText.value = "直播未绑定";
        loading.value = false;
        return;
      }
      await report("open");
      await router.replace(`/watch/${encodeURIComponent(activityId)}${forwardQuery()}`);
      return;
    }
    await report("open");
    if (data.contentKind === KIND_VIDEO) {
      heartbeatTimer = setInterval(() => {
        void report("heartbeat", { deltaLearnDurationSec: 15 });
      }, 15000);
    }
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
    await nextTick();
    bindScroll();
  }
}

function onScrollCheck(el: HTMLElement | null) {
  if (!el || scrolledBottom.value) return;
  const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (remain <= 48) {
    scrolledBottom.value = true;
    void report("scroll_bottom");
  }
}

function bindScroll() {
  if (isArticle.value) {
    onScrollCheck(articleBody.value);
  }
}

function onArticleScroll(e: Event) {
  onScrollCheck(e.target as HTMLElement);
}

function onDocScroll() {
  try {
    const doc = docFrame.value?.contentDocument?.documentElement;
    if (!doc) return;
    const remain = doc.scrollHeight - doc.scrollTop - doc.clientHeight;
    if (remain <= 48 && !scrolledBottom.value) {
      scrolledBottom.value = true;
      void report("scroll_bottom");
    }
  } catch {
    /* 跨域 iframe 读不到滚动，文档仅靠 open 记参与 */
  }
}

function onVideoTimeUpdate(e: Event) {
  const video = e.target as HTMLVideoElement;
  if (!video.duration || !Number.isFinite(video.duration)) return;
  const sec = Math.floor(video.currentTime);
  const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
  const delta = Math.max(0, sec - videoLastSec);
  videoLastSec = sec;
  if (videoReportTimer) return;
  videoReportTimer = setTimeout(() => {
    videoReportTimer = null;
    void report("heartbeat", {
      deltaLearnDurationSec: delta || undefined,
      progressBarSec: sec,
      progressPercent: pct,
    });
  }, 2000);
}

function onVideoEnded(e: Event) {
  const video = e.target as HTMLVideoElement;
  const sec = Math.floor(video.duration || video.currentTime || 0);
  void report("heartbeat", {
    progressBarSec: sec,
    progressPercent: 100,
  });
}

onMounted(() => {
  // web-view 内尽早注入 jweixin，便于文档/图片跳转小程序页
  if (isLikelyMiniProgramWebView()) {
    void ensureWxJsSdk().catch(() => undefined);
  }
  void load();
});

onBeforeUnmount(() => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (videoReportTimer) clearTimeout(videoReportTimer);
});
</script>

<template>
  <div class="lesson-page">
    <p v-if="loading" class="lesson-state">加载中…</p>
    <p v-else-if="errorText" class="lesson-state">{{ errorText }}</p>

    <template v-else-if="lesson">
      <header v-if="!isArticle" class="lesson-head">
        <h1 class="lesson-title">{{ lesson.title || "小节" }}</h1>
      </header>

      <div v-if="isImage" class="lesson-body lesson-body--center">
        <template v-if="lesson.materialUrl">
          <el-image
            class="lesson-image"
            :src="lesson.materialUrl"
            :preview-src-list="[lesson.materialUrl]"
            :initial-index="0"
            fit="contain"
            hide-on-click-modal
            :alt="lesson.materialName || lesson.title"
          />
          <p class="lesson-hint-muted">点击图片可放大查看</p>
          <div class="doc-actions doc-actions--single">
            <button type="button" class="doc-btn" @click="downloadImage">
              下载
            </button>
          </div>
        </template>
        <p v-else class="lesson-state">暂无图片</p>
      </div>

      <div v-else-if="isVideo" class="lesson-body lesson-body--center">
        <video
          v-if="lesson.materialUrl"
          class="lesson-video"
          :src="lesson.materialUrl"
          controls
          playsinline
          @timeupdate="onVideoTimeUpdate"
          @ended="onVideoEnded"
        />
        <p v-else class="lesson-state">暂无视频</p>
      </div>

      <div v-else-if="isDocument" class="lesson-body lesson-body--fill">
        <p v-if="!lesson.materialUrl" class="lesson-state">暂无文档</p>

        <template v-else-if="!docPreviewOpen">
          <div class="doc-card">
            <div class="doc-icon">
              <img class="doc-icon-img" :src="docFileIcon" :alt="docFileName" />
            </div>
            <div class="doc-meta">
              <p class="doc-name">{{ docFileName }}</p>
              <p class="doc-type">{{ docPreview?.extLabel || "文档" }} 文件</p>
            </div>
          </div>
          <p
            v-if="docPreview && !docPreview.cdnReady && !inMiniProgram"
            class="lesson-hint"
          >
            未配置 TOS CDN，仅可下载，无法在线预览
          </p>
          <div class="doc-actions">
            <button
              type="button"
              class="doc-btn doc-btn--primary"
              :disabled="!canPreviewDocument"
              @click="openDocPreview"
            >
              预览
            </button>
            <button type="button" class="doc-btn" @click="downloadDocument">
              下载
            </button>
          </div>
        </template>

        <template v-else>
          <div class="doc-preview-bar">
            <button type="button" class="doc-btn doc-btn--ghost" @click="closeDocPreview">
              返回
            </button>
            <a
              v-if="docPreview"
              class="lesson-open-link"
              :href="docPreview.openUrl"
              target="_blank"
              rel="noopener"
            >新窗口打开</a>
          </div>
          <iframe
            v-if="docPreview"
            ref="docFrame"
            class="lesson-frame"
            :src="docPreview.embedUrl"
            title="文档预览"
            @load="onDocScroll"
          />
        </template>
      </div>

      <div
        v-else-if="isArticle"
        ref="articleBody"
        class="lesson-body lesson-body--scroll lesson-body--article"
        @scroll="onArticleScroll"
      >
        <header class="article-meta">
          <h1 class="article-title">
            {{ lesson.materialName || lesson.title || "文章" }}
          </h1>
          <p v-if="lesson.author" class="article-author">
            作者：{{ lesson.author }}
          </p>
        </header>
        <div
          v-if="lesson.articleHtml"
          class="lesson-article"
          v-html="lesson.articleHtml"
        />
        <p v-else class="lesson-state">暂无正文</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lesson-page {
  min-height: 100dvh;
  background: #ffffff;
  color: #111111;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.lesson-state {
  padding: 48px 20px;
  text-align: center;
  color: #8c8c8c;
  font-size: 14px;
}

.lesson-head {
  padding: 16px 20px 8px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.lesson-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.lesson-body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 32px;
  box-sizing: border-box;
}

.lesson-body--article {
  padding-top: 20px;
}

.article-meta {
  margin: 0 0 20px;
  padding: 0 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.article-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.45;
  color: #111111;
}

.article-author {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: #8c8c8c;
}

.lesson-body--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.lesson-body--fill {
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
}

.lesson-body--scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.lesson-image {
  max-width: 100%;
  width: 100%;
  border-radius: 8px;
  cursor: zoom-in;
}

.lesson-image :deep(.el-image__inner) {
  max-height: 70dvh;
  width: auto;
  max-width: 100%;
  margin: 0 auto;
  border-radius: 8px;
}

.lesson-hint-muted {
  margin: 12px 0 0;
  font-size: 13px;
  color: #8c8c8c;
  text-align: center;
}

.lesson-video {
  width: 100%;
  max-height: 70dvh;
  background: #000;
  border-radius: 8px;
}

.lesson-frame {
  width: 100%;
  flex: 1;
  min-height: 60dvh;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.lesson-open-link {
  font-size: 14px;
  color: #1677ff;
  text-decoration: none;
}

.lesson-hint {
  margin: 16px 0 0;
  font-size: 13px;
  color: #fa8c16;
  text-align: center;
}

.doc-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  background: #f7f8fa;
  border: 1px solid #f0f0f0;
}

.doc-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.doc-icon-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.doc-meta {
  min-width: 0;
  flex: 1;
}

.doc-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111111;
  line-height: 1.4;
  word-break: break-all;
}

.doc-type {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8c8c8c;
}

.doc-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  width: 100%;
  max-width: 360px;
}

.doc-actions--single {
  max-width: 200px;
}

.doc-btn {
  flex: 1;
  height: 44px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  background: #ffffff;
  color: #262626;
  font-size: 15px;
  cursor: pointer;
}

.doc-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.doc-btn--primary {
  border-color: #1677ff;
  background: #1677ff;
  color: #ffffff;
}

.doc-btn--ghost {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 14px;
  border: none;
  background: transparent;
  color: #1677ff;
}

.doc-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.lesson-article {
  margin: 0;
  padding: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
}

.lesson-article :deep(p) {
  margin: 0 0 1em;
}

.lesson-article :deep(p:last-child) {
  margin-bottom: 0;
}

.lesson-article :deep(h1),
.lesson-article :deep(h2),
.lesson-article :deep(h3) {
  margin: 1.2em 0 0.6em;
  line-height: 1.4;
  font-weight: 600;
}

.lesson-article :deep(h1:first-child),
.lesson-article :deep(h2:first-child),
.lesson-article :deep(h3:first-child) {
  margin-top: 0;
}

.lesson-article :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px 0;
}
</style>
