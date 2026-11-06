/**
 * 昵称首字符（文字头像兜底）。
 * trim 后取第一个 Unicode 码位：中文为首字、英文为首字母；空串回退「?」。
 */
export function nicknameInitial(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  return Array.from(s)[0] ?? "?";
}
