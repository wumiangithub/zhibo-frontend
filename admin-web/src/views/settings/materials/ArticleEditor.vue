<script setup lang="ts">
import "@wangeditor/editor/dist/css/style.css";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
// @ts-expect-error vue3 包没有类型声明文件
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { uploadArticleImageOrToast } from "./articleImageUpload";
import { ensureArticleInsertMenu } from "./articleInsertMenu";
import { isArticleContentEmpty } from "./articleContent";

ensureArticleInsertMenu();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    maxLength?: number;
  }>(),
  { maxLength: 100000 },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const editorRef = shallowRef<any>(null);
const html = ref(props.modelValue);
const count = ref(0);

const showTips = computed(() => isArticleContentEmpty(html.value) && count.value === 0);

const toolbarConfig = {
  toolbarKeys: [
    "articleInsert",
    "undo",
    "redo",
    "|",
    "clearStyle",
    "headerSelect",
    "fontSize",
    "|",
    "bold",
    "italic",
    "underline",
    "through",
    "color",
    "bgColor",
    "|",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "justifyJustify",
    "|",
    "bulletedList",
    "numberedList",
    "indent",
    "delIndent",
    "|",
    "fullScreen",
  ],
};

const editorConfig = {
  placeholder: "",
  maxLength: props.maxLength,
  MENU_CONF: {
    uploadImage: {
      maxFileSize: 5 * 1024 * 1024,
      allowedFileTypes: ["image/jpeg", "image/png", "image/gif"],
      async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
        const url = await uploadArticleImageOrToast(file);
        if (!url) return;
        insertFn(url, file.name, url);
      },
    },
  },
};

function textLength(editor: any): number {
  return (editor?.getText?.() ?? "").length;
}

function handleCreated(editor: any) {
  editorRef.value = editor;
  count.value = textLength(editor);
}

function handleChange(editor: any) {
  const v = editor.getHtml() ?? "";
  count.value = textLength(editor);
  if (!editor.isFocused?.()) return;
  if (isArticleContentEmpty(v) && isArticleContentEmpty(props.modelValue)) return;
  if (v === props.modelValue) return;
  emit("update:modelValue", isArticleContentEmpty(v) ? "" : v);
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== html.value) html.value = v;
  },
);

onBeforeUnmount(() => {
  editorRef.value?.destroy();
});
</script>

<template>
  <div class="article-editor">
    <Toolbar
      class="article-editor__toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <div class="article-editor__body">
      <Editor
        v-model="html"
        class="article-editor__input"
        :default-config="editorConfig"
        mode="default"
        @on-created="handleCreated"
        @on-change="handleChange"
      />
      <ol
        v-if="showTips"
        class="article-editor__tips"
      >
        <li>支持从第三方编辑器粘贴内容</li>
        <li>图片宽高自适应显示(推荐宽度分辨率750px)</li>
        <li>图片支持jpg、png、gif格式，每张图大小不超过5M</li>
      </ol>
      <span class="article-editor__count">{{ count }}/{{ maxLength }}</span>
    </div>
  </div>
</template>

<style scoped>
.article-editor {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 340px);
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  background: #fff;
}

.article-editor__toolbar {
  border-bottom: 1px solid #ececec;
}

.article-editor__body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.article-editor__input {
  height: 100%;
}

.article-editor__input :deep(.w-e-text-container) {
  height: 100% !important;
  min-height: calc(100dvh - 420px);
}

.article-editor__input :deep(.w-e-text-container [data-slate-editor]) {
  min-height: calc(100dvh - 460px);
  padding-bottom: 28px;
}

.article-editor__input :deep(img) {
  max-width: 100%;
  height: auto;
}

.article-editor__tips {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 48px;
  z-index: 1;
  margin: 0;
  padding-left: 1.2em;
  color: #c0c4cc;
  font-size: 13px;
  line-height: 1.8;
  pointer-events: none;
}

.article-editor__count {
  position: absolute;
  right: 12px;
  bottom: 8px;
  z-index: 1;
  color: #c0c4cc;
  font-size: 12px;
  pointer-events: none;
}
</style>

<style>
/* 「插入」下拉渲染在 body 下，不能用 scoped */
.custom-insert-panel {
  min-width: 140px;
  padding: 8px 0;
  font-size: 13px;
  color: #333;
}
.custom-insert-panel .cip-group .cip-title {
  padding: 4px 16px;
  font-size: 12px;
  color: #999;
}
.custom-insert-panel .cip-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  cursor: pointer;
}
.custom-insert-panel .cip-item:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
.custom-insert-panel .cip-arrow {
  color: #bbb;
  font-style: normal;
  margin-left: 12px;
}
</style>
