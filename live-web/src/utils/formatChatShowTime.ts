/**
 * 对齐微吼官方 demo `handleChatShowTime`（vhlive_sdk_js_demo MsgItem / utils）：
 * - 无上一条（首条）：显示当前 HH:mm
 * - 与上一条同一天且同一小时：不显示（demo 用 datetime 字符串 slice(0,13) 比「YYYY-MM-DD HH」）
 * - 否则：显示当前 HH:mm（跨小时 / 跨天均如此，格式不含日期）
 *
 * @param prevTs 上一条消息毫秒时间戳；首条传 null/undefined/0
 * @param curTs 当前消息毫秒时间戳
 * @returns 居中分隔文案，或空串表示不展示
 */
export function formatChatShowTime(
  prevTs: number | null | undefined,
  curTs: number | null | undefined,
): string {
  if (curTs == null || !Number.isFinite(curTs) || curTs <= 0) return "";

  const hhmm = (ts: number): string => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const curLabel = hhmm(curTs);
  if (!curLabel) return "";

  if (prevTs == null || !Number.isFinite(prevTs) || prevTs <= 0) {
    return curLabel;
  }

  const prev = new Date(prevTs);
  const cur = new Date(curTs);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(cur.getTime())) return curLabel;

  // 等价 demo：preMsgTime.slice(0, 13) === curMsgTime.slice(0, 13)
  // 对 "YYYY-MM-DD HH:mm:ss" 即同日同时钟小时
  const sameDayHour =
    prev.getFullYear() === cur.getFullYear() &&
    prev.getMonth() === cur.getMonth() &&
    prev.getDate() === cur.getDate() &&
    prev.getHours() === cur.getHours();

  return sameDayHour ? "" : curLabel;
}
