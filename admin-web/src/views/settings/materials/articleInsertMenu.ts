import { Boot } from "@wangeditor/editor";
import { uploadArticleImageOrToast } from "./articleImageUpload";

const INSERT_ICON_SVG =
  '<svg viewBox="0 0 1024 1024"><path d="M512 192c-176.7 0-320 143.3-320 320s143.3 320 320 320 320-143.3 320-320-143.3-320-320-320zm160 352H544v128a32 32 0 1 1-64 0V544H352a32 32 0 1 1 0-64h128V352a32 32 0 1 1 64 0v128h128a32 32 0 1 1 0 64z"></path></svg>';

let registered = false;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 文章编辑器「插入」：选 jpg/png/gif 后直传并插入图片。 */
export function ensureArticleInsertMenu() {
  if (registered) return;
  registered = true;

  class ArticleInsertMenu {
    readonly key = "articleInsert";
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
        </div>
      `;
      div.addEventListener("click", (event) => {
        const target = (event.target as HTMLElement).closest("[data-action]");
        if (!target || !this.editor) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file || !this.editor) return;
          const url = await uploadArticleImageOrToast(file);
          if (!url) return;
          this.editor.dangerouslyInsertHtml(
            `<p><img src="${escapeAttr(url)}" alt="" style="max-width:100%;height:auto;" /></p>`,
          );
        };
        input.click();
      });
      this.panel = div;
      return div;
    }
  }

  Boot.registerMenu({
    key: "articleInsert",
    factory() {
      return new ArticleInsertMenu();
    },
  });
}
