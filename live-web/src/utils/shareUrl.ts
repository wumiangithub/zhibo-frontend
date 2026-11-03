/**
 * 分享链接统一拼装：`{base}?c={token}&…hints`
 *
 * - `c`：权威混淆载荷（XOR+校验和+Base64URL），解析端**只信**它
 * - hints：与 `c` 明文同名字段的人读提示（如 `kind`/`inviterId`），**不含 sig**；
 *   其中 `kind` = 邀请类型：`1` 员工 / `2` 观众（废弃）；直播与课程共用该枚举
 *   业务与鉴权必须忽略 hints，禁止只靠明文 query 归因/enroll
 *
 * 直播 watch、课程 course 凡带 `c` 的分享 URL 一律走本函数，禁止各处手写 `?c=`。
 */
export function buildShareUrl(
  baseUrl: string,
  cToken: string,
  hints?: Record<string, string | number>,
): string {
  const base = baseUrl.trim().replace(/[?&]+$/, "");
  const c = cToken.trim();
  if (!base || !c) return base;

  const params = new URLSearchParams();
  params.set("c", c);
  if (hints) {
    for (const [key, value] of Object.entries(hints)) {
      if (key === "c") continue;
      if (value === "" || value == null) continue;
      params.set(key, String(value));
    }
  }
  const qIndex = base.indexOf("?");
  if (qIndex < 0) return `${base}?${params.toString()}`;
  const path = base.slice(0, qIndex);
  const existing = new URLSearchParams(base.slice(qIndex + 1));
  existing.delete("c");
  for (const [key] of Object.entries(hints ?? {})) {
    existing.delete(key);
  }
  for (const [key, value] of params.entries()) {
    existing.set(key, value);
  }
  return `${path}?${existing.toString()}`;
}
