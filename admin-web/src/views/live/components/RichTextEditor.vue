<script setup lang="ts">
import "@wangeditor/editor/dist/css/style.css";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
// @ts-expect-error vue3 包没有类型声明文件
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { ensureCustomInsertMenu } from "./customInsertMenu";

ensureCustomInsertMenu();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /** 编辑区高度 */
    height?: string;
    /** 最大字符数 */
    maxLength?: number;
    /** 左下角提示文案 */
    tip?: string;
  }>(),
  {
    placeholder: "请输入内容",
    height: "340px",
    maxLength: 10000,
    tip: "友情提示：粘贴第三方内容，若排版不符合预期，需调整样式",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const editorRef = shallowRef<any>(null);
const html = ref<string>(props.modelValue);
const count = ref(0);

const remaining = computed(() => Math.max(0, props.maxLength - count.value));

/** 自定义「插入」菜单放最左；排除默认插入类菜单，避免重复 */
const toolbarConfig = {
  insertKeys: { index: 0, keys: ["customInsert"] },
  excludeKeys: [
    "group-image",
    "group-video",
    "insertImage",
    "uploadImage",
    "insertVideo",
    "uploadVideo",
    "insertLink",
    "editLink",
    "unLink",
    "viewLink",
    "insertTable",
    "deleteTable",
    "insertTableRow",
    "deleteTableRow",
    "insertTableCol",
    "deleteTableCol",
    "tableHeader",
    "tableFullWidth",
    "blockquote",
    "divider",
  ],
};

const editorConfig = {
  placeholder: props.placeholder,
  MENU_CONF: {},
};

function getTextLength(editor: any): number {
  if (!editor) return 0;
  const text = editor.getText?.() ?? "";
  return text.length;
}

function handleCreated(editor: any) {
  editorRef.value = editor;
  count.value = getTextLength(editor);
}

function handleChange(editor: any) {
  const v = editor.getHtml();
  emit("update:modelValue", v);
  count.value = getTextLength(editor);
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== html.value) html.value = v;
  },
);

onBeforeUnmount(() => {
  const editor = editorRef.value;
  if (editor) editor.destroy();
});
</script>

<template>
  <div class="rich-editor">
    <Toolbar
      class="rich-editor__toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      class="rich-editor__body"
      v-model="html"
      :default-config="editorConfig"
      mode="default"
      :style="{ height }"
      @on-created="handleCreated"
      @on-change="handleChange"
    />
    <div class="rich-editor__footer">
      <span class="rich-editor__tip">{{ tip }}</span>
      <span class="rich-editor__count">
        已输入{{ count }}个字符，还可以输入{{ remaining }}个字符
      </span>
    </div>
  </div>
</template>

<style scoped>
.rich-editor {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}
.rich-editor__toolbar {
  border-bottom: 1px solid #ececec;
}
.rich-editor__body {
  overflow-y: auto;
}
.rich-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #ececec;
  background: #fafafa;
  padding: 6px 12px;
  font-size: 12px;
  color: #999;
}
.rich-editor__tip {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rich-editor__count {
  flex: none;
  margin-left: 12px;
}
</style>

<style>
/* 自定义「插入」下拉面板：dropPanel 渲染在 body 下，需全局样式 */
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
.custom-insert-panel .cip-divider {
  height: 1px;
  margin: 6px 0;
  background: #ececec;
}
</style>
