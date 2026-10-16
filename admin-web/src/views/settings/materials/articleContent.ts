/** 无可见文字且无图片时视为空正文。 */

const EMPTY_HTML = new Set(["", "<p><br></p>", "<p></p>", "<br>", "<p><br/></p>"]);

export function isArticleContentEmpty(html: string): boolean {
  const raw = (html ?? "").trim();
  if (!raw || EMPTY_HTML.has(raw)) return true;
  if (/<img\b/i.test(raw)) return false;
  const text = raw
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  return text.length === 0;
}
