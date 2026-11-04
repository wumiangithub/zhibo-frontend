<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElButton, ElInput, ElMessage } from "element-plus";
import {
  createArticle,
  getArticle,
  isMaterialAuditPending,
  listMaterialGroups,
  updateArticle,
} from "@/api/materials";
import { ApiError } from "@/api/http";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import RichTextEditor from "@/components/rich-text/RichTextEditor.vue";
import { TosObjectKeyPrefix } from "@/utils/tosUpload";
import { isArticleContentEmpty } from "./articleContent";

const route = useRoute();
const router = useRouter();
const articleId = computed(() => {
  const raw = route.params.id;
  return typeof raw === "string" && raw && raw !== "new" ? raw : "";
});
const editing = computed(() => !!articleId.value && route.name !== "settings-article-view");
const viewing = computed(() => route.name === "settings-article-view");

const crumbs = computed<AppBreadcrumbItem[]>(() => [
  { label: "设置", to: "/settings/materials" },
  {
    label: "素材中心",
    to: { path: "/settings/materials", query: { type: "article" } },
  },
  { label: viewing.value ? "文章详情" : editing.value ? "编辑文章" : "新建文章" },
]);

const title = ref("");
const author = ref("");
const content = ref("");
const groupId = ref("");
const submitting = ref(false);
const groupReady = ref(false);
const auditLocked = ref(false);
const pageReady = ref(false);

const canSubmit = computed(
  () =>
    pageReady.value &&
    !auditLocked.value &&
    groupReady.value &&
    title.value.trim().length > 0 &&
    author.value.trim().length > 0 &&
    !isArticleContentEmpty(content.value) &&
    !submitting.value,
);

function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

onMounted(async () => {
  try {
    if (editing.value || viewing.value) {
      const detail = await getArticle(articleId.value);
      title.value = detail.title;
      author.value = detail.author;
      content.value = detail.content;
      groupId.value = detail.groupId;
      groupReady.value = !!groupId.value;
      if (editing.value) {
        auditLocked.value = isMaterialAuditPending(detail);
        if (auditLocked.value) ElMessage.warning("审核中不可编辑");
      }
    } else {
      const groups = await listMaterialGroups("article");
      const queryId = typeof route.query.groupId === "string" ? route.query.groupId : "";
      const picked = groups.find((g) => g.id === queryId);
      const fallback = groups.find((g) => g.isDefault) ?? groups[0];
      groupId.value = picked?.id ?? fallback?.id ?? "";
      groupReady.value = !!groupId.value;
      if (!groupId.value) ElMessage.error("未找到文章分组");
    }
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, editing.value ? "加载文章失败" : "加载分组失败"));
  } finally {
    pageReady.value = true;
  }
});

function goBack() {
  void router.push({ path: "/settings/materials", query: { type: "article" } });
}

async function onConfirm() {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    if (editing.value) {
      await updateArticle(articleId.value, {
        title: title.value.trim(),
        author: author.value.trim(),
        content: content.value,
      });
      ElMessage.success("已保存，重新进入审核");
    } else {
      await createArticle({
        groupId: groupId.value,
        title: title.value.trim(),
        author: author.value.trim(),
        content: content.value,
      });
      ElMessage.success("已新建文章");
    }
    goBack();
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, editing.value ? "保存文章失败" : "新建文章失败"));
  } finally {
    submitting.value = false;
  }
}

/** 与课程详情占位一致：空内容时的编辑区提示 */
const ARTICLE_PLACEHOLDER = [
  "1.支持从第三方编辑器粘贴内容",
  "2.图片宽高自适应显示(推荐宽度分辨率750px)",
  "3.图片支持jpg、png、gif格式，每张图片大小不超过5M",
].join("\n");
</script>

<template>
  <div class="article-create">
    <AppBreadcrumb :items="crumbs" />
    <section class="card">
      <div
        v-if="viewing"
        class="detail"
      >
        <h1 class="detail-title">{{ title || "未命名文章" }}</h1>
        <p class="detail-author">作者：{{ author || "—" }}</p>
        <div
          v-if="content"
          class="detail-html"
          v-html="content"
        />
        <p
          v-else
          class="detail-empty"
        >
          暂无正文
        </p>
      </div>
      <p
        v-if="auditLocked"
        class="lock-tip"
      >
        审核中不可编辑
      </p>
      <div
        v-if="!viewing"
        class="form"
        :class="{ 'is-locked': auditLocked }"
      >
        <div class="field">
          <label class="field-label"><i>*</i>标题</label>
          <ElInput
            v-model="title"
            maxlength="45"
            show-word-limit
            :disabled="auditLocked"
            placeholder="请输入标题(建议字数在14字以内，不超过45个字)"
          />
        </div>
        <div class="field">
          <label class="field-label"><i>*</i>文章作者</label>
          <ElInput
            v-model="author"
            maxlength="16"
            show-word-limit
            :disabled="auditLocked"
            placeholder="请输入文章作者"
          />
        </div>
        <div class="field field-editor">
          <label class="field-label"><i>*</i>文章详情</label>
          <div class="field-editor-col">
            <RichTextEditor
              v-model="content"
              :height="'420px'"
              :max-length="100000"
              :placeholder="ARTICLE_PLACEHOLDER"
              :upload-object-key-prefix="TosObjectKeyPrefix.MATERIAL_ARTICLE"
              example-dialog-title="文章详情示例"
              :preview-title="title"
              :preview-author="author"
              show-preview
              show-example
              show-content-viewport
            />
          </div>
        </div>
      </div>
    </section>
    <footer class="footer">
      <ElButton @click="goBack">{{ viewing ? "返回" : "取消" }}</ElButton>
      <ElButton
        v-if="!viewing"
        :type="canSubmit ? 'primary' : 'default'"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </footer>
  </div>
</template>

<style scoped>
.article-create {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}

.lock-tip {
  margin: 0;
  padding: 10px 48px 0;
  color: var(--color-danger, #f56c6c);
  font-size: 13px;
}

.form.is-locked {
  pointer-events: none;
  opacity: 0.72;
}

.card {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: 4px;
}

.detail {
  padding: 28px 48px 40px;
}

.detail-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
}

.detail-author {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--color-text-secondary, #8c8c8c);
}

.detail-empty {
  margin: 24px 0 0;
  font-size: 14px;
  color: var(--color-text-secondary, #8c8c8c);
}

.detail-html {
  margin-top: 24px;
  max-width: 720px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text);
  word-break: break-word;
}

.detail-html :deep(img),
.detail-html :deep(video),
.detail-html :deep(audio) {
  max-width: 100%;
  height: auto;
}

.detail-html :deep(p) {
  margin: 0 0 12px;
}

.detail-html :deep(p:last-child) {
  margin-bottom: 0;
}

.form {
  display: flex;
  flex-direction: column;
  padding: 28px 48px 24px;
}

.field {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 22px;
}

.field-editor {
  width: 100%;
  flex-wrap: nowrap;
  align-items: flex-start;
  margin-bottom: 0;
}

.field-label {
  flex: none;
  flex-shrink: 0;
  width: 88px;
  padding-top: 6px;
  font-size: 14px;
  color: var(--color-text);
  text-align: right;
}

.field-editor .field-label {
  padding-top: 8px;
}

.field-label i {
  margin-right: 4px;
  color: var(--color-danger, #f56c6c);
  font-style: normal;
}

/* Direct child only — nested MaterialPickerDialog stays in-tree (EP dialog Teleport off by default) */
.field > :deep(.el-input) {
  flex: 1;
  min-width: 0;
}

.field-editor-col {
  flex: 1;
  min-width: 0;
  width: 100%;
}

/* 与新建直播 LiveCreateView .live-create__footer 同一套贴底悬浮 */
.footer {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  z-index: 10;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 0 32px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
