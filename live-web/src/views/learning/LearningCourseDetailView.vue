<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getLearningCourseDetail,
  type LearningCatalogNode,
  type LearningSubCourse,
} from "@/api/learning";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import { useToast } from "@/composables/useToast";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";
import {
  buildCatalogBlocks,
  type LessonRow,
} from "@/utils/learningCatalog";

const DEFAULT_COVER = "/audience/cover-live-1.png";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const courseId = computed(() => String(route.params.id ?? "").trim());
const frameTitle = ref("课程详情");
const loading = ref(true);
const loadError = ref("");
const activeTab = ref<"catalog" | "intro">("catalog");
const cover = ref(DEFAULT_COVER);
const title = ref("");
const validityLabel = ref("");
const introduction = ref("");
const detailHtml = ref("");
const subCourses = ref<LearningSubCourse[]>([]);
const selectedSubId = ref(0);
const nodes = ref<LearningCatalogNode[]>([]);
const collapsedChapterIds = ref<Record<number, boolean>>({});
const subScroll = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

let authRetried = false;

const catalogBlocks = computed(() =>
  buildCatalogBlocks(nodes.value, selectedSubId.value, collapsedChapterIds.value),
);

function needsRelogin(e: unknown): boolean {
  if (isViewerLoginRequiredError(e)) return true;
  const msg = e instanceof Error ? e.message : "";
  return msg.includes("登录已过期");
}

function updateSubArrows() {
  const el = subScroll.value;
  if (!el || subCourses.value.length <= 1) {
    canScrollLeft.value = false;
    canScrollRight.value = false;
    return;
  }
  canScrollLeft.value = el.scrollLeft > 2;
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
}

function scrollSub(dir: number) {
  const el = subScroll.value;
  if (!el) return;
  const card = el.querySelector(".sub-card-wrap");
  const step = (card instanceof HTMLElement ? card.offsetWidth : 260) + 12;
  el.scrollBy({ left: dir * step, behavior: "smooth" });
}

function onSelectSub(id: number) {
  if (!id) return;
  if (id !== selectedSubId.value) selectedSubId.value = id;
  const index = subCourses.value.findIndex((s) => s.id === id);
  const card = subScroll.value?.querySelectorAll(".sub-card-wrap")[index];
  card?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

function onToggleChapter(id: number) {
  if (!id) return;
  collapsedChapterIds.value = {
    ...collapsedChapterIds.value,
    [id]: !collapsedChapterIds.value[id],
  };
}

function onCoverError() {
  if (cover.value !== DEFAULT_COVER) cover.value = DEFAULT_COVER;
}

function onTapLesson(lesson: LessonRow) {
  const id = courseId.value;
  if (!lesson.id || !id) {
    toast("缺少小节信息");
    return;
  }
  void router.push({
    name: "course-lesson",
    params: { courseId: id, lessonNodeId: String(lesson.id) },
  });
}

async function load() {
  const id = courseId.value;
  loading.value = true;
  loadError.value = "";
  if (!id) {
    loading.value = false;
    loadError.value = "缺少课程 id";
    return;
  }
  let settle = true;
  try {
    const detail = await getLearningCourseDetail(id);
    authRetried = false;
    nodes.value = detail.nodes;
    const subs = detail.subCourses;
    const firstSub = subs.length ? Number(subs[0].id) : 0;
    cover.value = detail.coverUrl || DEFAULT_COVER;
    title.value = detail.title || "课程";
    frameTitle.value = detail.title || "课程详情";
    validityLabel.value = detail.validityLabel || "";
    introduction.value = detail.introduction || "";
    detailHtml.value = detail.detailHtml || "";
    subCourses.value = subs;
    selectedSubId.value = firstSub;
    collapsedChapterIds.value = {};
    canScrollLeft.value = false;
    canScrollRight.value = false;
    await nextTick();
    updateSubArrows();
  } catch (e) {
    if (!authRetried && needsRelogin(e)) {
      authRetried = true;
      settle = false;
      const outcome = await recoverViewerAuth(`/learning/courses/${id}`);
      if (outcome === "refreshed") await load();
      return;
    }
    const msg = e instanceof Error && e.message ? e.message : "加载失败";
    loadError.value = msg;
    nodes.value = [];
    subCourses.value = [];
  } finally {
    if (settle) loading.value = false;
  }
}

watch(courseId, () => {
  authRetried = false;
  activeTab.value = "catalog";
  void load();
});

onMounted(() => {
  void load();
});
</script>

<template>
  <AudienceFrame :title="frameTitle">
    <div class="page">
      <p
        v-if="loading"
        class="state"
      >
        加载中…
      </p>
      <div
        v-else-if="loadError"
        class="state"
      >
        <p class="state-text">
          {{ loadError }}
        </p>
        <button
          type="button"
          class="retry"
          @click="load"
        >
          重试
        </button>
      </div>

      <template v-else>
        <div class="hero">
          <img
            class="hero-cover"
            :src="cover"
            alt=""
            @error="onCoverError"
          >
          <div class="hero-mask" />
          <p
            v-if="validityLabel"
            class="hero-validity"
          >
            有效期: {{ validityLabel }}
          </p>
          <span class="hero-badge">课程</span>
        </div>

        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'catalog' }"
            @click="activeTab = 'catalog'"
          >
            目录
            <span
              v-if="activeTab === 'catalog'"
              class="tab-line"
            />
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'intro' }"
            @click="activeTab = 'intro'"
          >
            介绍
            <span
              v-if="activeTab === 'intro'"
              class="tab-line"
            />
          </button>
        </div>

        <div
          v-if="activeTab === 'catalog'"
          class="panel"
        >
          <div
            v-if="subCourses.length"
            class="sub-row"
          >
            <div
              ref="subScroll"
              class="sub-scroll"
              @scroll="updateSubArrows"
            >
              <div class="sub-track">
                <button
                  v-for="item in subCourses"
                  :key="item.id"
                  type="button"
                  class="sub-card-wrap"
                  :class="{ selected: selectedSubId === item.id }"
                  @click="onSelectSub(item.id)"
                >
                  <span class="sub-card-frame">
                    <span class="sub-card">
                      <img
                        class="sub-card-cover"
                        :src="item.coverUrl || cover"
                        alt=""
                      >
                      <span class="sub-card-info">
                        <span class="sub-card-title">{{ item.title }}</span>
                        <span class="sub-card-meta">共 {{ item.lessonCount }} 小节</span>
                      </span>
                    </span>
                  </span>
                  <span
                    v-if="selectedSubId === item.id"
                    class="sub-tip"
                  />
                </button>
              </div>
            </div>
            <button
              v-if="canScrollLeft"
              type="button"
              class="sub-nav sub-nav-left"
              aria-label="向左"
              @click="scrollSub(-1)"
            >
              <img
                src="/audience/icon-arrow-left.png"
                alt=""
              >
            </button>
            <button
              v-if="canScrollRight"
              type="button"
              class="sub-nav sub-nav-right"
              aria-label="向右"
              @click="scrollSub(1)"
            >
              <img
                src="/audience/icon-arrow-right.png"
                alt=""
              >
            </button>
          </div>

          <p
            v-if="!catalogBlocks.length"
            class="empty-catalog"
          >
            暂无目录
          </p>

          <template
            v-for="block in catalogBlocks"
            :key="`${block.type}-${block.id}`"
          >
            <button
              v-if="block.type === 'chapter'"
              type="button"
              class="chapter"
              @click="onToggleChapter(block.id)"
            >
              <span class="chapter-main">
                <span class="chapter-title">{{ block.title }}</span>
                <span class="chapter-count">({{ block.lessonCount }}小节)</span>
              </span>
              <img
                class="chapter-arrow"
                :class="{ collapsed: !block.expanded }"
                src="/audience/icon-arrow-down.png"
                alt=""
              >
            </button>
            <template v-if="block.type === 'chapter' && block.expanded">
              <button
                v-for="lesson in block.lessons"
                :key="lesson.id"
                type="button"
                class="lesson"
                @click="onTapLesson(lesson)"
              >
                <span class="lesson-title">{{ lesson.indexLabel }}. {{ lesson.title }}</span>
                <span class="lesson-meta">{{ lesson.metaLine }}</span>
              </button>
            </template>
            <button
              v-else-if="block.type === 'lesson'"
              type="button"
              class="lesson"
              @click="onTapLesson(block)"
            >
              <span class="lesson-title">{{ block.indexLabel }}. {{ block.title }}</span>
              <span class="lesson-meta">{{ block.metaLine }}</span>
            </button>
          </template>
        </div>

        <div
          v-else
          class="panel intro-panel"
        >
          <h2 class="intro-title">
            {{ title }}
          </h2>
          <p
            v-if="introduction"
            class="intro-text"
          >
            {{ introduction }}
          </p>
          <!-- 课程详情富文本，与小程序 rich-text 同一字段 -->
          <div
            v-if="detailHtml"
            class="intro-html"
            v-html="detailHtml"
          />
          <p
            v-else-if="!introduction"
            class="empty-catalog"
          >
            暂无介绍
          </p>
        </div>
      </template>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page { flex: 1; min-height: 0; overflow: auto; background: #ffffff; padding-bottom: 24px; }
.state { padding: 80px 16px; text-align: center; color: #bfbfbf; font-size: 14px; }
.state-text { margin: 0; }
.retry { margin-top: 16px; height: 36px; padding: 0 18px; border: 0; border-radius: 8px; background: #f5f5f5; color: #1677ff; font-size: 14px; cursor: pointer; }
.hero { position: relative; width: 100%; height: 210px; background: #e6f0ff; overflow: hidden; }
.hero-cover { width: 100%; height: 100%; display: block; object-fit: cover; }
.hero-mask { position: absolute; left: 0; right: 0; bottom: 0; height: 80px; background: linear-gradient(transparent, rgba(0, 0, 0, 0.55)); }
.hero-validity { position: absolute; left: 12px; bottom: 12px; margin: 0; color: #ffffff; font-size: 12px; line-height: 17px; z-index: 1; }
.hero-badge { position: absolute; right: 12px; bottom: 12px; padding: 2px 7px; border-radius: 3px; background: rgba(0, 0, 0, 0.55); color: #ffffff; font-size: 11px; line-height: 16px; z-index: 1; }
.tabs { display: flex; height: 44px; padding: 0 24px; border-bottom: 1px solid #f0f0f0; }
.tab { position: relative; margin-right: 32px; display: flex; align-items: center; justify-content: center; height: 44px; padding: 0; border: 0; background: transparent; font-size: 15px; color: #595959; cursor: pointer; }
.tab.active { color: #1677ff; font-weight: 600; }
.tab-line { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 24px; height: 3px; border-radius: 3px; background: #1677ff; }
.panel { padding: 12px 0 20px; }
.sub-row { position: relative; }
.sub-scroll { width: 100%; overflow-x: auto; overflow-y: hidden; }
.sub-track { display: flex; align-items: flex-start; padding: 0 28px; box-sizing: border-box; }
.sub-card-wrap { position: relative; width: 264px; margin-right: 12px; flex-shrink: 0; padding: 0 0 8px; border: 0; background: transparent; text-align: left; cursor: pointer; }
.sub-card-wrap:last-child { margin-right: 0; }
.sub-card-frame { display: block; width: 260px; border-radius: 8px; overflow: hidden; border: 2px solid transparent; box-sizing: content-box; }
.sub-card-wrap.selected .sub-card-frame { border-color: #a9a9a9; background: #a9a9a9; }
.sub-card { display: flex; width: 260px; height: 90px; overflow: hidden; background: #a9a9a9; }
.sub-card-cover { width: 160px; height: 90px; flex-shrink: 0; object-fit: cover; background: #e8eef2; }
.sub-card-info { flex: 1; min-width: 0; padding: 14px 12px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
.sub-card-title { font-size: 15px; font-weight: 600; color: #ffffff; line-height: 1.4; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.sub-card-meta { font-size: 11px; color: rgba(255, 255, 255, 0.9); }
.sub-tip { position: absolute; left: 207px; top: 90px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 8px solid #a9a9a9; }
.sub-nav { position: absolute; top: 33px; width: 32px; height: 32px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.92); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); display: flex; align-items: center; justify-content: center; z-index: 3; cursor: pointer; padding: 0; }
.sub-nav img { width: 18px; height: 18px; }
.sub-nav-left { left: 6px; }
.sub-nav-right { right: 6px; }
.chapter { display: flex; align-items: center; justify-content: space-between; width: calc(100% - 24px); margin: 0 12px 4px; padding: 12px 14px; border: 0; border-radius: 6px; background: #f5f5f5; cursor: pointer; text-align: left; }
.chapter-main { flex: 1; min-width: 0; display: flex; align-items: baseline; margin-right: 8px; overflow: hidden; }
.chapter-title { font-size: 14px; color: #333333; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
.chapter-count { flex-shrink: 0; margin-left: 4px; font-size: 12px; color: #999999; font-weight: 400; }
.chapter-arrow { width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.2s ease; }
.chapter-arrow.collapsed { transform: rotate(-90deg); }
.lesson { display: block; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid #f5f5f5; background: #ffffff; text-align: left; cursor: pointer; }
.lesson-title { display: block; font-size: 14px; color: #111111; line-height: 1.45; }
.lesson-meta { display: block; margin-top: 4px; font-size: 11px; color: #8c8c8c; }
.empty-catalog { padding: 40px 16px; text-align: center; color: #bfbfbf; font-size: 13px; margin: 0; }
.intro-panel { padding: 16px 16px 24px; }
.intro-title { margin: 0 0 10px; font-size: 18px; font-weight: 700; color: #111111; line-height: 1.45; }
.intro-text { margin: 0 0 14px; font-size: 14px; color: #595959; line-height: 1.7; }
.intro-html { font-size: 14px; color: #262626; line-height: 1.75; word-break: break-word; }
.intro-html :deep(img) { max-width: 100%; height: auto; }
</style>
