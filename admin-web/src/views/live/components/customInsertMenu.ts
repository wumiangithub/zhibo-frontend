import { Boot } from "@wangeditor/editor";
import { ElMessage, ElMessageBox } from "element-plus";

const INSERT_ICON_SVG =
  '<svg viewBox="0 0 1024 1024"><path d="M512 192c-176.7 0-320 143.3-320 320s143.3 320 320 320 320-143.3 320-320-143.3-320-320-320zm160 352H544v128a32 32 0 1 1-64 0V544H352a32 32 0 1 1 0-64h128V352a32 32 0 1 1 64 0v128h128a32 32 0 1 1 0 64z"></path></svg>';

class CustomInsertMenu {
  readonly key = "customInsert";
  readonly title = "插入";
  readonly iconSvg = INSERT_ICON_SVG;
  readonly tag = "button";
  readonly showDropPanel = true;
  private editor: any = null;
  private panel: HTMLElement | null = null;

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
        <div class="cip-item" data-action="image"><span>图片</span><i class="cip-arrow">›</i></div>
        <div class="cip-item" data-action="audio"><span>音频</span><i class="cip-arrow">›</i></div>
        <div class="cip-item" data-action="video"><span>视频</span><i class="cip-arrow">›</i></div>
        <div class="cip-item" data-action="document"><span>文档</span><i class="cip-arrow">›</i></div>
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
    div.addEventListener("click", this.onClick);
    this.panel = div;
    return div;
  }

  private onClick = (e: Event) => {
    const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.dataset.action;
    const editor = this.editor;
    if (!editor) return;
    switch (action) {
      case "image":
      case "audio":
      case "video":
      case "document": {
        const labelMap: Record<string, string> = {
          image: "图片",
          audio: "音频",
          video: "视频",
          document: "文档",
        };
        ElMessage.info(`${labelMap[action]}上传待接入`);
        break;
      }
      case "table": {
        editor.dangerouslyInsertHtml(
          '<table><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>',
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
}

let registered = false;
export function ensureCustomInsertMenu() {
  if (registered) return;
  (Boot as any).registerMenu({
    key: "customInsert",
    factory: () => new CustomInsertMenu(),
  });
  registered = true;
}
