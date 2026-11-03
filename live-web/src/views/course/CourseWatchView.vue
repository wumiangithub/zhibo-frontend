<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { enrollCourse } from "@/api/courseEnroll";
import {
  getViewerAccessToken,
  syncViewerAccessTokenFromUrl,
  syncViewerIdFromUrl,
} from "@/utils/viewerAuth";
import { decodeCourseShareToken } from "@/utils/courseShareToken";
import { goViewerLogin } from "@/utils/viewerLogin";

const route = useRoute();
const courseId = String(route.params.id ?? "").trim().toLowerCase();

const routeQuery = route.query as Record<string, unknown>;
syncViewerIdFromUrl(routeQuery);
syncViewerAccessTokenFromUrl(routeQuery);

const SHARE_STORAGE_PREFIX = "zhibo.courseShare.";

const title = ref("");
const statusText = ref("加载中…");
const enrolled = ref(false);
const needLogin = ref(false);

function captureShareFromQuery() {
  // 只信 query `c`；kind/inviterId hint 一律忽略
  const raw = String(route.query.c ?? "").trim();
  const decoded = decodeCourseShareToken(raw);
  if (!decoded) return null;
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

async function tryEnroll() {
  if (!courseId) {
    statusText.value = "课程链接无效";
    return;
  }
  captureShareFromQuery();

  if (!getViewerAccessToken()) {
    needLogin.value = true;
    statusText.value = "请先登录后再加入课程";
    return;
  }

  const stored = readStoredShare();
  try {
    const res = await enrollCourse(
      courseId,
      stored?.inviterId ? { inviterId: stored.inviterId } : undefined,
    );
    title.value = res.title || "";
    enrolled.value = true;
    statusText.value = res.created ? "已加入课程" : "你已在本课程学员名单中";
  } catch (e) {
    statusText.value = e instanceof Error ? e.message : "加入课程失败";
  }
}

async function onLogin() {
  await goViewerLogin();
}

onMounted(() => {
  void tryEnroll();
});
</script>

<template>
  <div class="course-watch">
    <h1 class="course-watch__title">
      {{ title || "课程" }}
    </h1>
    <p class="course-watch__status">
      {{ statusText }}
    </p>
    <p
      v-if="enrolled"
      class="course-watch__hint"
    >
      学习页建设中，你已进入学员名单。
    </p>
    <button
      v-if="needLogin"
      type="button"
      class="course-watch__login"
      @click="onLogin"
    >
      去登录
    </button>
  </div>
</template>

<style scoped>
.course-watch {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #f5f6f8;
  color: #1f2329;
}
.course-watch__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.course-watch__status {
  margin: 16px 0 0;
  font-size: 15px;
  color: #646a73;
}
.course-watch__hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: #8f959e;
}
.course-watch__login {
  margin-top: 20px;
  border: 0;
  border-radius: 8px;
  padding: 10px 28px;
  font-size: 15px;
  color: #fff;
  background: #3370ff;
  cursor: pointer;
}
.course-watch__login:hover {
  opacity: 0.92;
}
</style>
