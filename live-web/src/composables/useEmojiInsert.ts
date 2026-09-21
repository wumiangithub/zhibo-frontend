import { nextTick } from "vue";

/**
 * 在光标处插入表情令牌，返回插入后的完整文本；超出 max 返回 null（调用方保持原值）。
 * 面板收起后把光标放回令牌之后，方便继续打字。
 */
export function insertEmojiAtCursor(
  el: HTMLInputElement | null,
  current: string,
  name: string,
  max: number,
): string | null {
  const pos = el?.selectionStart ?? current.length;
  const next = current.slice(0, pos) + name + current.slice(pos);
  if (next.length > max) return null;
  nextTick(() => {
    el?.focus();
    el?.setSelectionRange(pos + name.length, pos + name.length);
  });
  return next;
}
