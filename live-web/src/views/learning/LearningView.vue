<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  listLearningCourses,
  listLearningLives,
  type LearningCourseItem,
  type LearningLiveItem,
} from "@/api/learning";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

/** 与小程序 pages/learning 一致 */
const PAGE_SIZE = 20;
const DEFAULT_COVER = "/audience/cover-live-1.png";
const STATE_LABEL: Record<number, string> = {
  1: "直播中",
  2: "预告",
  3: "已结束",
  4: "点播",
  5: "回放",
};

type Tab = "live" | "course";

interface LiveRow {
  id: string;
  kind: "live";
  title: string;
  cover: string;
  coverTag: string;
  status: "living" | "ended";
  statusText: string;
  time: string;
}

interface CourseRow {
  id: string;
  kind: "course";
  title: string;
  cover: string;
  coverTag: string;
  subTitle: string;
  time: string;
}

type Row = LiveRow | CourseRow;

const router = useRouter();
const { toast } = useToast();

const scroller = ref<HTMLElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);
const activeTab = ref<Tab>("live");
const keyword = ref("");
const list = ref<Row[]>([]);
const loading = ref(false);
const noMore = ref(false);
const page = ref(1);
const errorText = ref("");
const moreError = ref("");

let loadGen = 0;
let observer: IntersectionObserver | null = null;
let authRetried = false;

function watchStateLabel(state: number): string {
  return STATE_LABEL[state] || (state ? `状态${state}` : "");
}

function shortTime(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function toLiveRow(item: LearningLiveItem): LiveRow {
  const living = item.state === 1;
  return {
    id: item.id,
    kind: "live",
    title: item.title || "直播",
    cover: item.coverUrl || DEFAULT_COVER,
    coverTag: "直播",
    status: living ? "living" : "ended",
    statusText: watchStateLabel(item.state) || "已结束",
    time: item.startTime || "",
  };
}

function toCourseRow(item: LearningCourseItem): CourseRow {
  const sub = item.subCourseCount != null ? Number(item.subCourseCount) : 0;
  const lessons = item.lessonCount != null ? Number(item.lessonCount) : 0;
  return {
    id: item.id,
    kind: "course",
    title: item.title || "课程",
    cover: item.coverUrl || DEFAULT_COVER,
    coverTag: "课程",
    subTitle: `${sub}个子课程 ${lessons}小节`,
    time: shortTime(item.acquiredTime),
  };
}

function needsRelogin(e: unknown): boolean {
  if (isViewerLoginRequiredError(e)) return true;
  const msg = e instanceof Error ? e.message : "";
  return msg.includes("登录已过期");
}

function reload() {
  authRetried = false;
  page.value = 1;
  noMore.value = false;
  list.value = [];
  errorText.value = "";
  moreError.value = "";
  void fetchPage(1, true);
}

function loadMore() {
  if (loading.value || noMore.value || !list.value.length || moreError.value) return;
  void fetchPage(page.value + 1, false);
}

function retryMore() {
  moreError.value = "";
  loadMore();
}

function switchTab(tab: Tab) {
  if (tab === activeTab.value) return;
  activeTab.value = tab;
  reload();
}

function onSearch() {
  reload();
}

function onCoverError(row: Row) {
  if (row.cover !== DEFAULT_COVER) row.cover = DEFAULT_COVER;
}

function onTap(row: Row) {
  if (!row.id) {
    toast(row.kind === "course" ? "缺少课程 id" : "缺少直播 id");
    return;
  }
  if (row.kind === "course") {
    void router.push({ name: "learning-course", params: { id: row.id } });
    return;
  }
  void router.push({ name: "watch", params: { id: row.id } });
}

async function fillIfShort() {
  await nextTick();
  const root = scroller.value;
  if (!root || loading.value || noMore.value || moreError.value || !list.value.length) return;
  if (root.scrollHeight <= root.clientHeight + 4) loadMore();
}

async function fetchPage(targetPage: number, replace: boolean) {
  const gen = replace ? ++loadGen : loadGen;
  loading.value = true;
  const tab = activeTab.value;
  const kw = keyword.value.trim();
  let ok = false;
  let settle = true;
  try {
    const data = tab === "live"
      ? await listLearningLives({ page: targetPage, pageSize: PAGE_SIZE })
      : await listLearningCourses({ page: targetPage, pageSize: PAGE_SIZE });
    if (gen !== loadGen || tab !== activeTab.value) return;
    let rows: Row[] = tab === "live"
      ? data.list.map((item) => toLiveRow(item as LearningLiveItem))
      : data.list.map((item) => toCourseRow(item as LearningCourseItem));
    if (kw) rows = rows.filter((item) => item.title.includes(kw));
    list.value = replace ? rows : list.value.concat(rows);
    page.value = targetPage;
    noMore.value = data.list.length < PAGE_SIZE;
    errorText.value = "";
    moreError.value = "";
    ok = true;
  } catch (e) {
    if (gen !== loadGen || tab !== activeTab.value) return;
    if (!authRetried && needsRelogin(e)) {
      authRetried = true;
      const outcome = await recoverViewerAuth("/learning");
      settle = false;
      if (outcome === "refreshed" && gen === loadGen && tab === activeTab.value) {
        await fetchPage(targetPage, replace);
      }
      return;
    }
    const msg = e instanceof Error && e.message ? e.message : "网络异常";
    toast(msg.slice(0, 40));
    if (list.value.length === 0) errorText.value = msg;
    else moreError.value = msg;
  } finally {
    if (settle && gen === loadGen && tab === activeTab.value) {
      loading.value = false;
      if (ok) void fillIfShort();
    }
  }
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
  <AudienceFrame title="我的学习">
    <div class="page">
      <div class="search-wrap">
        <div class="search-box">
          <button
            type="button"
            class="search-btn"
            aria-label="搜索"
            @click="onSearch"
          >
            <img
              src="/audience/icon-search.png"
              alt=""
            >
          </button>
          <input
            v-model="keyword"
            class="search-input"
            type="search"
            placeholder="请输入直播/课程名称"
            enterkeyhint="search"
            @keydown.enter.prevent="onSearch"
          >
        </div>
      </div>

      <div class="tabs">
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'live' }"
          @click="switchTab('live')"
        >
          直播
          <span
            v-if="activeTab === 'live'"
            class="tab-line"
          />
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'course' }"
          @click="switchTab('course')"
        >
          课程
          <span
            v-if="activeTab === 'course'"
            class="tab-line"
          />
        </button>
      </div>

      <div
        ref="scroller"
        class="scroll"
      >
        <p
          v-if="loading && !list.length"
          class="empty"
        >
          加载中…
        </p>
        <div
          v-else-if="errorText && !list.length"
          class="empty"
        >
          <p class="empty-text">
            {{ errorText }}
          </p>
          <button
            type="button"
            class="retry"
            @click="reload"
          >
            重试
          </button>
        </div>
        <p
          v-else-if="!list.length"
          class="empty"
        >
          暂无相关内容
        </p>
        <div v-else>
          <button
            v-for="item in list"
            :key="`${item.kind}-${item.id}`"
            type="button"
            class="item"
            @click="onTap(item)"
          >
            <span class="cover-wrap">
              <img
                class="cover"
                :src="item.cover"
                alt=""
                @error="onCoverError(item)"
              >
              <span class="cover-tag">{{ item.coverTag }}</span>
            </span>
            <span class="item-main">
              <span class="item-title">{{ item.title }}</span>
              <span
                v-if="activeTab === 'live' && item.kind === 'live'"
                class="item-meta"
              >
                <span
                  class="dot"
                  :class="item.status"
                />
                <span
                  class="status"
                  :class="{ 'living-text': item.status === 'living' }"
                >{{ item.statusText }}</span>
                <span
                  v-if="item.time"
                  class="time"
                >{{ item.time }}</span>
              </span>
              <span
                v-else-if="item.kind === 'course'"
                class="item-meta course-meta"
              >
                <span class="sub-title">{{ item.subTitle }}</span>
                <span class="time">{{ item.time }}</span>
              </span>
            </span>
          </button>
          <button
            v-if="moreError"
            type="button"
            class="hint hint-btn"
            @click="retryMore"
          >
            加载失败，点击重试
          </button>
          <p
            v-else-if="loading"
            class="hint"
          >
            加载中…
          </p>
          <p
            v-else-if="noMore"
            class="hint"
          >
            没有更多了
          </p>
          <div
            ref="sentinel"
            class="sentinel"
          />
        </div>
      </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #ffffff; }
.search-wrap { padding: 8px 16px 4px; flex-shrink: 0; }
.search-box { height: 36px; border-radius: 18px; background: #f5f5f5; display: flex; align-items: center; padding: 0 14px; box-sizing: border-box; }
.search-btn { width: 20px; height: 20px; margin-right: 6px; padding: 0; border: 0; background: transparent; flex-shrink: 0; cursor: pointer; }
.search-btn img { width: 20px; height: 20px; display: block; }
.search-input { flex: 1; min-width: 0; height: 36px; border: 0; background: transparent; font-size: 14px; color: #111111; outline: none; }
.search-input::placeholder { color: #bfbfbf; }
.tabs { display: flex; height: 44px; padding: 0 24px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
.tab { position: relative; margin-right: 32px; display: flex; align-items: center; justify-content: center; height: 44px; border: 0; background: transparent; font-size: 15px; color: #595959; cursor: pointer; padding: 0; }
.tab.active { color: #1677ff; font-weight: 600; }
.tab-line { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 24px; height: 3px; border-radius: 3px; background: #1677ff; }
.scroll { flex: 1; min-height: 0; overflow: auto; }
.empty { padding: 60px 16px; text-align: center; color: #bfbfbf; font-size: 14px; }
.empty-text { margin: 0; color: #8c8c8c; }
.retry { margin-top: 16px; height: 36px; padding: 0 18px; border: 0; border-radius: 8px; background: #f5f5f5; color: #1677ff; font-size: 14px; cursor: pointer; }
.item { width: 100%; display: flex; padding: 14px 16px; border: 0; border-bottom: 1px solid #f0f0f0; background: #ffffff; text-align: left; cursor: pointer; }
.cover-wrap { position: relative; width: 110px; height: 74px; border-radius: 6px; overflow: hidden; flex-shrink: 0; margin-right: 12px; background: #e6f0ff; }
.cover { width: 100%; height: 100%; display: block; object-fit: cover; }
.cover-tag { position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 3px; background: rgba(0, 0, 0, 0.55); color: #ffffff; font-size: 10px; line-height: 14px; }
.item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 2px 0; }
.item-title { font-size: 15px; font-weight: 600; color: #111111; line-height: 1.45; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.item-meta { display: flex; align-items: center; margin-top: 8px; }
.course-meta { justify-content: space-between; }
.sub-title { font-size: 12px; color: #8c8c8c; flex: 1; min-width: 0; margin-right: 8px; }
.dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; flex-shrink: 0; }
.dot.living { background: #52c41a; }
.dot.ended { background: #bfbfbf; }
.status { font-size: 12px; color: #8c8c8c; margin-right: 8px; }
.living-text { color: #52c41a; }
.time { font-size: 12px; color: #8c8c8c; flex-shrink: 0; }
.hint { text-align: center; font-size: 11px; color: #bfbfbf; padding: 12px 0 24px; margin: 0; }
.hint-btn { display: block; width: 100%; border: 0; background: transparent; color: #1677ff; cursor: pointer; }
.sentinel { height: 1px; }
</style>
