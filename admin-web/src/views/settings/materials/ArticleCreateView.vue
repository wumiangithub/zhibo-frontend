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
import ArticleEditor from "./ArticleEditor.vue";
import { isArticleContentEmpty } from "./articleContent";

const route = useRoute();
const router = useRouter();

const articleId = computed(() => {
  const raw = route.params.id;
  return typeof raw === "string" && raw && raw !== "new" ? raw : "";
});
const editing = computed(() => !!articleId.value);

const crumbs = computed<AppBreadcrumbItem[]>(() => [
  { label: "设置", to: "/settings/materials" },
  {
    label: "素材中心",
    to: { path: "/settings/materials", query: { type: "article" } },
  },
  { label: editing.value ? "编辑文章" : "新建文章" },
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
    if (editing.value) {
      const detail = await getArticle(articleId.value);
      title.value = detail.title;
      author.value = detail.author;
      content.value = detail.content;
      groupId.value = detail.groupId;
      groupReady.value = !!groupId.value;
      auditLocked.value = isMaterialAuditPending(detail);
      if (auditLocked.value) ElMessage.warning("审核中不可编辑");
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
</script>

<template>
  <div class="article-create">
    <AppBreadcrumb :items="crumbs" />
    <section class="card">
      <p
        v-if="auditLocked"
        class="lock-tip"
      >
        审核中不可编辑
      </p>
      <div
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
          <ArticleEditor v-model="content" />
        </div>
      </div>
    </section>
    <footer class="footer">
      <ElButton @click="goBack">取消</ElButton>
      <ElButton
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
  align-items: stretch;
  margin-bottom: 0;
}

.field-label {
  flex: none;
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

.field :deep(.el-input),
.field .article-editor {
  flex: 1;
  min-width: 0;
}

.field-editor .article-editor {
  display: flex;
  flex-direction: column;
  min-height: 420px;
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
