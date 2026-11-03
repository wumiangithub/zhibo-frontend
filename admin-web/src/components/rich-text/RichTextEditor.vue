<script setup lang="ts">
import "@wangeditor/editor/dist/css/style.css";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
// @ts-expect-error vue3 包没有类型声明文件
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElDialog, ElIcon, ElMessage } from "element-plus";
import type { MaterialListItem, MaterialType } from "@/api/materials";
import MaterialPickerDialog from "@/views/live/components/MaterialPickerDialog.vue";
import { isEmptyHtml } from "./isEmptyHtml";
import { uploadRichTextImageOrToast } from "./richTextImageUpload";
import {
  bindRichTextMediaActions,
  ensureRichTextInsertMenu,
  type RichTextPickedMaterial,
} from "./richTextInsertMenu";
import type { RichTextMediaKind } from "./richTextMediaEmbed";
import { uploadRichTextMediaOrToast } from "./richTextMediaUpload";
import detailExampleImg from "@/assets/images/live/detail-example.png";

ensureRichTextInsertMenu();

/** 共用默认示例正文（沿用直播详情既有示例图）；调用方可传 exampleHtml 覆盖 */
const DEFAULT_EXAMPLE_HTML = `<img src="${detailExampleImg}" alt="详情示例" />`;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /** 编辑区高度 */
    height?: string;
    /** 字数上限（按纯文本计） */
    maxLength?: number;
    /** 左下角友情提示；传空字符串可隐藏 */
    tipText?: string;
    /**
     * TOS 对象 key 前缀（D60 已登记），如 material/article/、activity/detail/。
     * 插入本地媒体时直传此目录。
     */
    uploadObjectKeyPrefix: string;
    /** 示例弹窗标题（直播 / 文章等场景不同） */
    exampleDialogTitle?: string;
    /** 示例弹窗 HTML；未传则用共用默认示例 */
    exampleHtml?: string;
    /** 手机预览可选标题 */
    previewTitle?: string;
    /** 手机预览可选作者 */
    previewAuthor?: string;
  }>(),
  {
    placeholder: "请输入内容",
    height: "340px",
    maxLength: 10000,
    tipText: "友情提示：粘贴第三方内容，若排版不符合预期，需调整样式",
    exampleDialogTitle: "查看示例",
    exampleHtml: "",
    previewTitle: "",
    previewAuthor: "",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const editorRef = shallowRef<any>(null);
const html = ref<string>(props.modelValue);
const count = ref(0);
const previewOpen = ref(false);
const exampleOpen = ref(false);
/** 自定义全屏（左编辑 + 右实时预览），不走 wangEditor 原生全屏 */
const isFullscreen = ref(false);

const pickerVisible = ref(false);
const pickerType = ref<MaterialType>("image");
const pickerTitle = ref("从素材库选择");
let pickerResolve: ((items: RichTextPickedMaterial[] | null) => void) | null = null;

const remaining = computed(() => Math.max(0, props.maxLength - count.value));

const exampleBodyHtml = computed(() => {
  const custom = (props.exampleHtml ?? "").trim();
  return custom || DEFAULT_EXAMPLE_HTML;
});

const editorBodyStyle = computed(() =>
  isFullscreen.value ? { height: "100%" } : { height: props.height },
);

/**
 * 对齐 wangEditor 默认工具栏，并：
 * - 最前加自定义「插入」（图/音/视/档走 TOS / 素材库）
 * - 去掉与「插入」重复的原生图片/视频/链接/表格/引用/分割线
 * - 去掉默认「行高」lineHeight
 * - 「橡皮擦」clearStyle 提到一级（默认埋在「更多」里，直播旧版是显式按钮）
 */
const toolbarConfig = {
  toolbarKeys: [
    "richTextInsert",
    "headerSelect",
    "|",
    "bold",
    "underline",
    "italic",
    "through",
    "color",
    "bgColor",
    "|",
    "fontSize",
    "fontFamily",
    "|",
    "bulletedList",
    "numberedList",
    "todo",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "justifyJustify",
    "indent",
    "delIndent",
    "|",
    "emotion",
    "codeBlock",
    "|",
    "undo",
    "redo",
    "clearStyle",
    "|",
    "fullScreen",
  ],
};

const editorConfig = computed(() => ({
  placeholder: props.placeholder,
  maxLength: props.maxLength,
  MENU_CONF: {
    uploadImage: {
      maxFileSize: 5 * 1024 * 1024,
      allowedFileTypes: ["image/jpeg", "image/png", "image/gif"],
      async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
        const url = await uploadRichTextImageOrToast(file, props.uploadObjectKeyPrefix);
        if (!url) return;
        insertFn(url, file.name, url);
      },
    },
  },
}));

function getTextLength(editor: any): number {
  if (!editor) return 0;
  return (editor.getText?.() ?? "").length;
}

function mediaKindToPickerType(kind: RichTextMediaKind): MaterialType | null {
  if (kind === "audio") return null;
  return kind;
}

function pickFromLibrary(kind: RichTextMediaKind): Promise<RichTextPickedMaterial[] | null> {
  const type = mediaKindToPickerType(kind);
  if (!type) {
    ElMessage.warning("素材中心暂无音频类型，请使用本地上传");
    return Promise.resolve(null);
  }
  if (pickerResolve) {
    pickerResolve(null);
    pickerResolve = null;
  }
  const titleMap: Record<MaterialType, string> = {
    image: "选择图片",
    video: "选择视频",
    document: "选择文档",
  };
  pickerType.value = type;
  pickerTitle.value = titleMap[type];
  pickerVisible.value = true;
  return new Promise((resolve) => {
    pickerResolve = resolve;
  });
}

function finishPicker(items: RichTextPickedMaterial[] | null) {
  const resolve = pickerResolve;
  pickerResolve = null;
  pickerVisible.value = false;
  resolve?.(items);
}

function onPickerConfirm(items: MaterialListItem[]) {
  finishPicker(
    items.map((it) => ({
      url: it.url || "",
      name: it.name || "",
    })),
  );
}

function onPickerVisibleChange(open: boolean) {
  pickerVisible.value = open;
  // 取消/关闭时结束等待；确认路径已在 onPickerConfirm 里 resolve
  if (!open && pickerResolve) finishPicker(null);
}

/** 同步 wangEditor 工具栏全屏按钮的 isActive（读 editor.isFullScreen） */
function syncWangFullScreenFlag(on: boolean) {
  const editor = editorRef.value;
  if (!editor) return;
  editor.isFullScreen = on;
  // 触发工具栏重绘，图标/激活态才会切到「取消全屏」
  try {
    editor.emit?.("fullScreen");
    editor.emit?.("change");
  } catch {
    /* ignore */
  }
}

function enterFullscreen() {
  if (isFullscreen.value) return;
  isFullscreen.value = true;
  syncWangFullScreenFlag(true);
  document.documentElement.classList.add("rte-fs-lock");
}

function exitFullscreen() {
  if (!isFullscreen.value) return;
  isFullscreen.value = false;
  syncWangFullScreenFlag(false);
  document.documentElement.classList.remove("rte-fs-lock");
}

function onFsKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isFullscreen.value) {
    e.preventDefault();
    exitFullscreen();
  }
}

function handleCreated(editor: any) {
  editorRef.value = editor;
  count.value = getTextLength(editor);
  bindRichTextMediaActions(editor, {
    upload: (kind, file) => uploadRichTextMediaOrToast(kind, file, props.uploadObjectKeyPrefix),
    pickFromLibrary,
  });
  // 劫持原生全屏 → 本组件双栏布局（顶栏退出+工具栏，左编辑右预览）
  editor.fullScreen = () => enterFullscreen();
  editor.unFullScreen = () => exitFullscreen();
}

/**
 * wangEditor 初始化 / setHtml 会触发 onChange，常把 "" 规范成 `<p><br></p>` 等。
 * 仅在编辑器聚焦且内容相对外层有实质变化时回写。
 */
function handleChange(editor: any) {
  const v = editor.getHtml() ?? "";
  count.value = getTextLength(editor);
  if (!editor.isFocused?.()) return;
  if (isEmptyHtml(v) && isEmptyHtml(props.modelValue)) return;
  if (v === props.modelValue) return;
  emit("update:modelValue", isEmptyHtml(v) ? "" : v);
}

function openPreview() {
  if (isEmptyHtml(html.value)) {
    ElMessage.warning("暂无内容可预览");
    return;
  }
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
}

function openExample() {
  exampleOpen.value = true;
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== html.value) html.value = v;
  },
);

onMounted(() => {
  window.addEventListener("keydown", onFsKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onFsKeydown);
  document.documentElement.classList.remove("rte-fs-lock");
  if (pickerResolve) {
    pickerResolve(null);
    pickerResolve = null;
  }
  const editor = editorRef.value;
  if (editor) editor.destroy();
});

defineExpose({ openPreview, openExample });
</script>

<template>
  <div
    class="rich-editor"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <div class="rich-editor__fs-top">
      <button
        v-if="isFullscreen"
        type="button"
        class="rich-editor__fs-exit"
        @click="exitFullscreen"
      >
        <ElIcon
          class="rich-editor__fs-exit-icon"
          :size="16"
        >
          <ArrowLeft />
        </ElIcon>
        退出全屏
      </button>
      <Toolbar
        class="rich-editor__toolbar"
        :editor="editorRef"
        :default-config="toolbarConfig"
        mode="default"
      />
    </div>

    <div class="rich-editor__workspace">
      <Editor
        class="rich-editor__body"
        v-model="html"
        :default-config="editorConfig"
        mode="default"
        :style="editorBodyStyle"
        @on-created="handleCreated"
        @on-change="handleChange"
      />
      <aside
        v-if="isFullscreen"
        class="rich-editor__fs-preview hover-scrollbar"
        aria-label="实时预览"
      >
        <div
          class="rich-editor__fs-preview-html"
          v-html="html"
        />
      </aside>
    </div>

    <div
      v-show="!isFullscreen"
      class="rich-editor__footer"
    >
      <span
        v-if="tipText"
        class="rich-editor__tip"
      >{{ tipText }}</span>
      <span class="rich-editor__count">
        已输入{{ count }}个字符，还可以输入{{ remaining }}个字符
      </span>
    </div>

    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="rte-preview-mask"
        @click.self="closePreview"
      >
        <div
          class="rte-preview-phone"
          role="dialog"
          aria-modal="true"
          aria-label="内容预览"
        >
          <div class="rte-preview-phone__notch" />
          <div class="rte-preview-phone__screen hover-scrollbar">
            <header
              v-if="previewTitle || previewAuthor"
              class="rte-preview-phone__meta"
            >
              <h1
                v-if="previewTitle"
                class="rte-preview-phone__title"
              >
                {{ previewTitle }}
              </h1>
              <p
                v-if="previewAuthor"
                class="rte-preview-phone__author"
              >
                作者：{{ previewAuthor }}
              </p>
            </header>
            <div
              class="rte-preview-phone__html"
              v-html="html"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <ElDialog
      v-model="exampleOpen"
      :title="exampleDialogTitle"
      width="720px"
      align-center
      destroy-on-close
    >
      <div
        class="rte-example-body hover-scrollbar"
        v-html="exampleBodyHtml"
      />
    </ElDialog>

    <MaterialPickerDialog
      :model-value="pickerVisible"
      :title="pickerTitle"
      hint="从素材中心选择已审核通过的素材插入正文"
      :max="10"
      :allowed-types="[pickerType]"
      :default-type="pickerType"
      @update:model-value="onPickerVisibleChange"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<style scoped>
.rich-editor {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.rich-editor__fs-top {
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.rich-editor__fs-exit {
  display: none;
}

.rich-editor__toolbar {
  border-bottom: 1px solid #ececec;
  min-width: 0;
}

/* 收紧工具栏项间距（wangEditor 默认 item padding:4px、button padding:0 8px、divider margin:0 5px） */
.rich-editor__toolbar :deep(.w-e-bar-item) {
  padding: 4px 1px;
}

.rich-editor__toolbar :deep(.w-e-bar-item button) {
  padding: 0 5px;
}

.rich-editor__toolbar :deep(.w-e-bar-divider) {
  margin: 0 3px;
}

/*
 * tip 是 button 上的 ::before/::after（.w-e-menu-tooltip-v5），相对 .w-e-bar-item 定位到下方。
 * 工具栏折行时，下一排 bar-item 后绘会盖住上一排 tip（插入在首行最左，正下方常是对齐图标）。
 * hover 抬高当前项，让 tip 完整露在其它项之上；不影响未悬停项。
 */
.rich-editor__toolbar :deep(.w-e-bar-item:hover) {
  z-index: 10;
}

/* 「插入」已画进 iconSvg；按钮 / SVG 随 viewBox 加宽（默认 .w-e-bar svg 是 14×14） */
.rich-editor__toolbar :deep(button[data-menu-key="richTextInsert"]) {
  width: auto !important;
}

.rich-editor__toolbar :deep(button[data-menu-key="richTextInsert"] svg) {
  width: auto;
  height: 16px;
}

.rich-editor__workspace {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rich-editor__body {
  overflow-y: auto;
  min-width: 0;
}

.rich-editor__body :deep(img),
.rich-editor__body :deep(video),
.rich-editor__body :deep(audio) {
  max-width: 100%;
  height: auto;
}

.rich-editor__body :deep(.w-e-max-length-info) {
  display: none;
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

/* —— 自定义全屏：上「退出全屏」+ 工具栏；灰底；左大编辑白板 + 右窄实时 HTML 预览 —— */
.rich-editor.is-fullscreen {
  position: fixed;
  inset: 0;
  /* 低于 Element Plus Dialog(~2000+)，全屏内仍可弹出素材库等 */
  z-index: 1500;
  width: 100vw;
  max-width: none;
  height: 100vh;
  height: 100dvh;
  border: none;
  border-radius: 0;
  overflow: hidden;
  background: #f5f5f5;
}

/* 顶区保持纵向：退出一行，工具栏一行（对齐截图） */
.rich-editor.is-fullscreen .rich-editor__fs-top {
  flex-direction: column;
  align-items: stretch;
  background: #fff;
  border-bottom: 1px solid #ececec;
}

.rich-editor.is-fullscreen .rich-editor__fs-exit {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  flex: none;
  gap: 2px;
  height: 36px;
  margin: 4px 0 0 8px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #333;
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.rich-editor.is-fullscreen .rich-editor__fs-exit:hover {
  color: var(--color-primary, #2f6bff);
}

.rich-editor.is-fullscreen .rich-editor__fs-exit-icon {
  flex: none;
  margin-right: 2px;
}

.rich-editor.is-fullscreen .rich-editor__toolbar {
  flex: none;
  width: 100%;
  min-width: 0;
  border-bottom: none;
}

.rich-editor.is-fullscreen .rich-editor__workspace {
  flex: 1;
  flex-direction: row;
  justify-content: center;
  align-items: stretch;
  gap: 24px;
  padding: 20px 24px 24px;
  overflow: hidden;
  background: #f5f5f5;
}

.rich-editor.is-fullscreen .rich-editor__body {
  /* 普通态父级 640；全屏加宽到 1000 并与预览一起居中 */
  flex: 0 1 1000px;
  width: 100%;
  max-width: 1000px;
  min-width: 0;
  height: auto !important;
  background: #fff;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview {
  /* 与手机预览弹层一致：固定 375，不跟 flex 比例漂到 420 */
  flex: 0 0 375px;
  width: 375px;
  max-width: 375px;
  min-width: 375px;
  box-sizing: border-box;
  padding: 20px 18px;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 0;
  box-shadow: none;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(p) {
  margin: 0 0 1em;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(p:last-child) {
  margin-bottom: 0;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h1),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h2),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h3) {
  margin: 1.2em 0 0.6em;
  line-height: 1.4;
  font-weight: 600;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h1:first-child),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h2:first-child),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(h3:first-child) {
  margin-top: 0;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(img),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(video),
.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(audio) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px 0;
}

.rich-editor.is-fullscreen .rich-editor__fs-preview-html :deep(table) {
  max-width: 100%;
  display: block;
  overflow-x: auto;
}

/* —— 手机框预览（Teleport 到 body） —— */
.rte-preview-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
}

.rte-preview-phone {
  position: relative;
  box-sizing: border-box;
  width: 395px;
  max-width: calc(100vw - 48px);
  padding: 12px 10px 14px;
  background: #1a1a1a;
  border-radius: 36px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.rte-preview-phone__notch {
  width: 110px;
  height: 22px;
  margin: 0 auto 8px;
  background: #1a1a1a;
  border-radius: 0 0 14px 14px;
}

.rte-preview-phone__screen {
  box-sizing: border-box;
  width: 100%;
  max-width: 375px;
  height: min(667px, calc(100dvh - 96px));
  margin: 0 auto;
  padding: 16px 16px 24px;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
  border-radius: 24px;
  -webkit-overflow-scrolling: touch;
}

.rte-preview-phone__meta {
  margin: 0 0 16px;
  padding: 0 0 14px;
  border-bottom: 1px solid #f0f0f0;
}

.rte-preview-phone__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.45;
  color: #111;
  word-break: break-word;
}

.rte-preview-phone__author {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: #8c8c8c;
}

.rte-preview-phone__html {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
}

.rte-preview-phone__html :deep(p) {
  margin: 0 0 1em;
}

.rte-preview-phone__html :deep(p:last-child) {
  margin-bottom: 0;
}

.rte-preview-phone__html :deep(h1),
.rte-preview-phone__html :deep(h2),
.rte-preview-phone__html :deep(h3) {
  margin: 1.2em 0 0.6em;
  line-height: 1.4;
  font-weight: 600;
}

.rte-preview-phone__html :deep(h1:first-child),
.rte-preview-phone__html :deep(h2:first-child),
.rte-preview-phone__html :deep(h3:first-child) {
  margin-top: 0;
}

.rte-preview-phone__html :deep(img),
.rte-preview-phone__html :deep(video),
.rte-preview-phone__html :deep(audio) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px 0;
}

.rte-preview-phone__html :deep(table) {
  max-width: 100%;
  display: block;
  overflow-x: auto;
}

.rte-example-body {
  max-height: 70vh;
  overflow-x: hidden;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
}

.rte-example-body :deep(img) {
  display: block;
  width: 369px;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

.rte-example-body :deep(p) {
  margin: 0 0 1em;
}

.rte-example-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>

<style>
/* 全屏时锁滚动，避免底层页面跟着滚 */
html.rte-fs-lock,
html.rte-fs-lock body {
  overflow: hidden !important;
}

/* 「插入」下拉渲染在 body 下，不能用 scoped */
.custom-insert-panel {
  position: relative;
  min-width: 140px;
  padding: 8px 0;
  font-size: 13px;
  color: #333;
  overflow: visible;
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
.custom-insert-panel .cip-item:hover,
.custom-insert-panel .cip-item.is-open {
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
.custom-insert-panel .cip-flyout {
  position: absolute;
  left: 100%;
  margin-left: 4px;
  min-width: 132px;
  padding: 6px 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
}
.custom-insert-panel .cip-flyout-item {
  padding: 8px 16px;
  cursor: pointer;
  white-space: nowrap;
  color: #333;
}
.custom-insert-panel .cip-flyout-item:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
</style>
