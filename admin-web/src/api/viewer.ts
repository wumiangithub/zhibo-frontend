import { get, put } from "./http";

export type ViewerKeywordType = "nickname" | "id" | "phone";

export interface ViewerListItem {
  id: number;
  nickname: string;
  avatarUrl?: string;
  /** 1 微信 / 2 导入 */
  registerChannel: number;
  phoneMasked?: string;
  /** 1 正常 / 0 停用（与 banAccess 同步） */
  status: number;
  banComment: number;
  banPurchase: number;
  banAccess: number;
  createdTime?: string;
  lastVisitTime?: string;
  consumeCount: number;
  consumeAmount: string;
  totalLearnDurationSec: number;
  todayLearnDurationSec: number;
  /** 完成课程数；本轮恒 0 */
  completedCourseCount: number;
  /** 最近购买商品；本轮无 */
  recentPurchaseProduct?: string;
  /** 首次支付时间；本轮无 */
  firstPayTime?: string;
  tagIds: number[];
  tagLabels: string[];
}

export interface ViewerListResult {
  page: number;
  pageSize: number;
  total: number;
  list: ViewerListItem[];
}

/** any 满足其一 / all 同时满足 / none 不包含 */
export type ViewerTagMatch = "any" | "all" | "none";

export function listViewers(params: {
  page?: number;
  pageSize?: number;
  keywordType?: ViewerKeywordType;
  keyword?: string;
  consumeAmountMin?: number;
  consumeAmountMax?: number;
  consumeCountMin?: number;
  consumeCountMax?: number;
  /** 标签 id；满足其一/全部见 tagMatch */
  tagIds?: number[];
  /** 默认 any（满足其一） */
  tagMatch?: ViewerTagMatch;
  sort?: string;
  order?: string;
} = {}) {
  const { tagIds, ...rest } = params;
  return get<ViewerListResult>("/viewers/list", {
    params: {
      ...rest,
      tagIds: tagIds?.length ? tagIds.join(",") : undefined,
    },
  });
}

export function updateViewerStatus(id: number, status: 0 | 1) {
  return put<{ id: number; status: number }>(`/viewers/update-status/${id}`, { status });
}

export function updateViewerBlacklist(
  id: number,
  body: { banComment: 0 | 1; banPurchase: 0 | 1; banAccess: 0 | 1 },
) {
  return put<{
    id: number;
    banComment: number;
    banPurchase: number;
    banAccess: number;
    status: number;
  }>(`/viewers/update-blacklist/${id}`, body);
}

export function updateViewerTags(id: number, tagIds: number[]) {
  return put<{ id: number; tagIds: number[]; tagLabels: string[] }>(
    `/viewers/update-tags/${id}`,
    { tagIds },
  );
}

export function registerChannelLabel(channel: number): string {
  if (channel === 2) return "导入";
  return "微信";
}

/**
 * 用户列禁令角标：三项全开 →「已拉黑」；否则逐项展示开着的禁止项。
 */
export function viewerBanBadges(
  row: Pick<ViewerListItem, "banComment" | "banPurchase" | "banAccess">,
): string[] {
  const items: string[] = [];
  if (row.banComment === 1) items.push("禁止评论");
  if (row.banPurchase === 1) items.push("禁止购买");
  if (row.banAccess === 1) items.push("禁止访问");
  if (items.length === 3) return ["已拉黑"];
  return items;
}

/** 学习时长秒 → 文案；无学习（0）显示 `--` */
export function formatLearnDurationSec(sec: number | undefined | null): string {
  const n = Math.max(0, Math.floor(sec || 0));
  if (n <= 0) return "--";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}小时`);
  if (m) parts.push(`${m}分`);
  if (s || parts.length === 0) parts.push(`${s}秒`);
  return parts.join("");
}
