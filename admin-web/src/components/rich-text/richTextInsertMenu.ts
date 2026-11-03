import { Boot } from "@wangeditor/editor";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  buildRichTextMediaHtml,
  RICH_TEXT_MEDIA_ACCEPT,
  type RichTextMediaKind,
} from "./richTextMediaEmbed";

/** 加号圆标 +「插入」同画进一份 SVG，工具栏只渲染这一个 asset */
const INSERT_ICON_SVG =
  '<svg viewBox="0 0 45 16" xmlns="http://www.w3.org/2000/svg">' +
  '<g transform="translate(8, 8) scale(0.0171875) translate(-512, -512)">' +
  '<path d="M512 192c-176.7 0-320 143.3-320 320s143.3 320 320 320 320-143.3 320-320-143.3-320-320-320zm160 352H544v128a32 32 0 1 1-64 0V544H352a32 32 0 1 1 0-64h128V352a32 32 0 1 1 64 0v128h128a32 32 0 1 1 0 64z"></path>' +
  "</g>" +
  '<text x="18" y="8.5" dominant-baseline="middle" font-size="13" font-weight="500" font-family="system-ui,\'PingFang SC\',\'Microsoft YaHei\',sans-serif">插入</text>' +
  "</svg>";

const MEDIA_KINDS: RichTextMediaKind[] = ["image", "audio", "video", "document"];

export type RichTextPickedMaterial = { url: string; name: string };

export type RichTextMediaActions = {
  /** 本地文件直传 TOS，返回可访问 URL */
  upload: (kind: RichTextMediaKind, file: File) => Promise<string | null>;
  /** 打开素材库选择；取消返回 null */
  pickFromLibrary: (kind: RichTextMediaKind) => Promise<RichTextPickedMaterial[] | null>;
};

/** 按 editor 实例绑定媒体动作（菜单全局单例，路径/弹窗由调用方决定） */
const mediaActions = new WeakMap<object, RichTextMediaActions>();

export function bindRichTextMediaActions(editor: object, actions: RichTextMediaActions) {
  mediaActions.set(editor, actions);
}

/** @deprecated 请用 bindRichTextMediaActions */
export type RichTextImageUploader = (file: File) => Promise<string | null>;

/** @deprecated 请用 bindRichTextMediaActions */
export function bindRichTextImageUploader(editor: object, uploader: RichTextImageUploader) {
  const prev = mediaActions.get(editor);
  mediaActions.set(editor, {
    upload: async (kind, file) => (kind === "image" ? uploader(file) : prev?.upload(kind, file) ?? null),
    pickFromLibrary: prev?.pickFromLibrary ?? (async () => null),
  });
}

function insertMediaHtml(editor: any, kind: RichTextMediaKind, url: string, name = "") {
  const html = buildRichTextMediaHtml(kind, url, name);
  if (kind === "video" && typeof editor.insertVideo === "function") {
    editor.insertVideo(url);
    return;
  }
  editor.dangerouslyInsertHtml(html);
}

function pickLocalFile(kind: RichTextMediaKind): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = RICH_TEXT_MEDIA_ACCEPT[kind];
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

class RichTextInsertMenu {
  readonly key = "richTextInsert";
  /** 与其它工具栏项一致：Boot 据此写 button[data-tooltip]，供 .w-e-menu-tooltip-v5 悬停提示 */
  readonly title = "插入";
  readonly iconSvg = INSERT_ICON_SVG;
  readonly tag = "button";
  readonly showDropPanel = true;
  private editor: any = null;
  private panel: HTMLElement | null = null;
  private flyout: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  getValue() {
    return "";
  }
  isActive() {
    return false;
  }
  isDisabled() {
    return false;
  }
  exec() {}

  getPanelContentElem(editor: any) {
    this.editor = editor;
    if (this.panel) return this.panel;
    const div = document.createElement("div");
    div.className = "custom-insert-panel";
    div.innerHTML = `
      <div class="cip-group">
        <div class="cip-title">插入素材</div>
        <div class="cip-item cip-has-sub" data-media="image"><span>图片</span><i class="cip-arrow">›</i></div>
        <div class="cip-item cip-has-sub" data-media="audio"><span>音频</span><i class="cip-arrow">›</i></div>
        <div class="cip-item cip-has-sub" data-media="video"><span>视频</span><i class="cip-arrow">›</i></div>
        <div class="cip-item cip-has-sub" data-media="document"><span>文档</span><i class="cip-arrow">›</i></div>
      </div>
      <div class="cip-divider"></div>
      <div class="cip-group">
        <div class="cip-title">布局和样式</div>
        <div class="cip-item" data-action="table"><span>表格</span><i class="cip-arrow">›</i></div>
        <div class="cip-item" data-action="link"><span>超链接</span></div>
        <div class="cip-item" data-action="quote"><span>引用</span></div>
        <div class="cip-item" data-action="hr"><span>分隔线</span><i class="cip-arrow">›</i></div>
      </div>
    `;

    const flyout = document.createElement("div");
    flyout.className = "cip-flyout";
    flyout.hidden = true;
    flyout.innerHTML = `
      <div class="cip-flyout-item" data-sub="local">本地上传</div>
      <div class="cip-flyout-item" data-sub="library">从素材库选择</div>
    `;
    div.appendChild(flyout);
    this.flyout = flyout;

    div.addEventListener("click", this.onClick);
    div.addEventListener("mouseleave", this.onPanelLeave);
    flyout.addEventListener("mouseenter", this.cancelHide);
    flyout.addEventListener("mouseleave", this.onPanelLeave);

    for (const item of Array.from(div.querySelectorAll<HTMLElement>(".cip-has-sub"))) {
      item.addEventListener("mouseenter", () => this.showFlyout(item));
    }
    for (const item of Array.from(div.querySelectorAll<HTMLElement>("[data-action]"))) {
      item.addEventListener("mouseenter", () => this.hideFlyoutSoon());
    }

    this.panel = div;
    return div;
  }

  private cancelHide = () => {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  };

  private onPanelLeave = () => {
    this.hideFlyoutSoon();
  };

  private hideFlyoutSoon() {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hideFlyout(), 120);
  }

  private hideFlyout() {
    if (!this.flyout || !this.panel) return;
    this.flyout.hidden = true;
    for (const el of Array.from(this.panel.querySelectorAll(".cip-has-sub.is-open"))) {
      el.classList.remove("is-open");
    }
  }

  private showFlyout(item: HTMLElement) {
    if (!this.flyout || !this.panel) return;
    this.cancelHide();
    for (const el of Array.from(this.panel.querySelectorAll(".cip-has-sub.is-open"))) {
      el.classList.remove("is-open");
    }
    item.classList.add("is-open");
    const kind = item.dataset.media as RichTextMediaKind;
    this.flyout.dataset.media = kind;
    this.flyout.hidden = false;
    // 相对面板定位到当前项右侧
    const panelRect = this.panel.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    this.flyout.style.top = `${itemRect.top - panelRect.top}px`;
  }

  private onClick = async (e: Event) => {
    const target = e.target as HTMLElement;
    const sub = target.closest("[data-sub]") as HTMLElement | null;
    if (sub && this.flyout && !this.flyout.hidden) {
      const kind = this.flyout.dataset.media as RichTextMediaKind | undefined;
      const mode = sub.dataset.sub;
      if (kind && MEDIA_KINDS.includes(kind) && (mode === "local" || mode === "library")) {
        await this.handleMedia(kind, mode);
      }
      return;
    }

    const actionEl = target.closest("[data-action]") as HTMLElement | null;
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const editor = this.editor;
    if (!editor) return;
    switch (action) {
      case "table": {
        editor.dangerouslyInsertHtml(
          "<table><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>",
        );
        break;
      }
      case "link": {
        ElMessageBox.prompt("请输入链接地址", "插入超链接", {
          confirmButtonText: "插入",
          cancelButtonText: "取消",
          inputPlaceholder: "https://",
        })
          .then(({ value }) => {
            if (!value) return;
            const safe = /^https?:\/\//.test(value) ? value : `https://${value}`;
            editor.dangerouslyInsertHtml(`<a href="${safe}" target="_blank">链接</a>`);
          })
          .catch(() => {});
        break;
      }
      case "quote": {
        editor.dangerouslyInsertHtml("<blockquote>引用内容</blockquote>");
        break;
      }
      case "hr": {
        editor.dangerouslyInsertHtml("<hr>");
        break;
      }
    }
  };

  private async handleMedia(kind: RichTextMediaKind, mode: "local" | "library") {
    const editor = this.editor;
    if (!editor) return;
    const actions = mediaActions.get(editor);
    if (!actions) {
      ElMessage.warning("未配置素材插入能力");
      return;
    }

    if (mode === "local") {
      const file = await pickLocalFile(kind);
      if (!file) return;
      const url = await actions.upload(kind, file);
      if (!url) return;
      insertMediaHtml(editor, kind, url, file.name);
      return;
    }

    const picked = await actions.pickFromLibrary(kind);
    if (!picked?.length) return;
    for (const item of picked) {
      if (!item.url) {
        ElMessage.warning(`「${item.name || "素材"}」暂无可用地址`);
        continue;
      }
      insertMediaHtml(editor, kind, item.url, item.name);
    }
  }
}

let registered = false;
export function ensureRichTextInsertMenu() {
  if (registered) return;
  (Boot as any).registerMenu({
    key: "richTextInsert",
    factory: () => new RichTextInsertMenu(),
  });
  registered = true;
}
