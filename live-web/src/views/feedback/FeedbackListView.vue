<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { listFeedback, type FeedbackListItem } from "@/api/feedback";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

/** 与小程序 pages/feedback/list 一致 */
const PAGE_SIZE = 20;

const router = useRouter();
const { toast } = useToast();

const scroller = ref<HTMLElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);
const list = ref<FeedbackListItem[]>([]);
const loading = ref(false);
const noMore = ref(false);
const page = ref(1);

let loadGen = 0;
let observer: IntersectionObserver | null = null;
let authRetried = false;

function reload() {
  authRetried = false;
  page.value = 1;
  noMore.value = false;
  list.value = [];
  void fetchPage(1, true);
}

function loadMore() {
  if (loading.value || noMore.value || !list.value.length) return;
  void fetchPage(page.value + 1, false);
}

async function fillIfShort() {
  await nextTick();
  const root = scroller.value;
  if (!root || loading.value || noMore.value || !list.value.length) return;
  if (root.scrollHeight <= root.clientHeight + 4) loadMore();
}

async function fetchPage(targetPage: number, replace: boolean) {
  if (!replace && loading.value) return;
  if (replace && loading.value) return;
  const gen = ++loadGen;
  loading.value = true;
  let ok = false;
  try {
    const data = await listFeedback(targetPage, PAGE_SIZE);
    if (gen !== loadGen) return;
    const rows = data.list || [];
    const total = data.total || 0;
    const next = replace ? rows : list.value.concat(rows);
    list.value = next;
    page.value = targetPage;
    noMore.value = next.length >= total || rows.length < PAGE_SIZE;
    ok = true;
  } catch (e) {
    if (gen !== loadGen) return;
    if (!authRetried && isViewerLoginRequiredError(e)) {
      authRetried = true;
      loading.value = false;
      const outcome = await recoverViewerAuth("/feedback/list");
      if (outcome === "refreshed") await fetchPage(targetPage, replace);
      return;
    }
    const msg = e instanceof Error && e.message ? e.message : "加载失败";
    toast(String(msg).slice(0, 40) || "加载失败");
  } finally {
    if (gen === loadGen) {
      loading.value = false;
      if (ok) void fillIfShort();
    }
  }
}

function onTap(item: FeedbackListItem) {
  if (item.id == null || !item.id) return;
  void router.push({ name: "feedback-detail", params: { id: String(item.id) } });
}

function bindObserver() {
  observer?.disconnect();
  const root = scroller.value;
  const el = sentinel.value;
  if (!root || !el) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root, rootMargin: "80px" },
  );
  observer.observe(el);
}

watch(sentinel, () => {
  bindObserver();
}, { flush: "post" });

onMounted(() => {
  bindObserver();
  reload();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <AudienceFrame title="历史提交记录">
    <div
      ref="scroller"
      class="page"
    >
      <p
        v-if="loading && !list.length"
        class="empty"
      >
        加载中…
      </p>
      <p
        v-else-if="!list.length"
        class="empty"
      >
        <span class="empty-text">暂无提交记录</span>
      </p>
      <div
        v-else
        class="list"
      >
        <button
          v-for="item in list"
          :key="item.id"
          type="button"
          class="card"
          @click="onTap(item)"
        >
          <span class="card-top">
            <span class="tag">{{ item.categoryLabel }}</span>
            <span class="time">{{ item.createdTime }}</span>
          </span>
          <span class="content">{{ item.content }}</span>
          <span class="card-foot">
            <span
              v-if="item.imageCount"
              class="meta"
            >截图 {{ item.imageCount }} 张</span>
            <span class="chev">详情 ›</span>
          </span>
        </button>
        <p
          v-if="noMore && list.length"
          class="end"
        >
          没有更多了
        </p>
        <div
          v-else
          ref="sentinel"
          class="sentinel"
        />
      </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
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
  padding: 80px 20px;
  text-align: center;
  color: #999999;
  font-size: 14px;
}
.empty-text {
  color: #999999;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  display: block;
  width: 100%;
  border: 0;
  background: #ffffff;
  border-radius: 8px;
  padding: 14px 14px 12px;
  text-align: left;
  cursor: pointer;
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tag {
  font-size: 12px;
  color: #1677ff;
  background: #e8f3ff;
  padding: 3px 8px;
  border-radius: 3px;
}
.time {
  font-size: 12px;
  color: #bfbfbf;
}
.content {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 14px;
  color: #111111;
  line-height: 1.55;
  word-break: break-word;
}
.card-foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.meta {
  font-size: 12px;
  color: #999999;
}
.chev {
  margin-left: auto;
  font-size: 12px;
  color: #bfbfbf;
}
.end {
  margin: 0;
  text-align: center;
  padding: 12px 0 4px;
  font-size: 12px;
  color: #bfbfbf;
}
.sentinel {
  height: 1px;
}
</style>
