import { get, post, put } from "./http";
import type { ActivityId } from "./activity";
import axios from "axios";
import { getAccessToken } from "@/utils/authSession";

export type AudienceKeywordType = "nickname" | "id" | "phone";

/** any 满足其一 / all 同时满足 / none 不包含 */
export type AudienceTagMatch = "any" | "all" | "none";

/** gte 大于等于 / lte 小于等于 */
export type AudienceDurationOp = "gte" | "lte";

export interface AudienceListItem {
  id: number;
  viewerId: number;
  nickname: string;
  avatarUrl?: string;
  entitlementStatus: number;
  inviterDisplayName?: string;
  inviterKind?: "employee";
  inviteTime?: string;
  employeeInviterId?: number;
  employeeInviteTime?: string;
  importerId?: number;
  importerName?: string;
  importTime?: string;
  tagIds: number[];
  tagLabels: string[];
  stayDurationSec: number;
  totalWatchDurationSec: number;
  liveWatchDurationSec: number;
  replayWatchDurationSec: number;
  commentCount: number;
  dealAmount: string;
}

export interface AudienceListResult {
  page: number;
  pageSize: number;
  total: number;
  list: AudienceListItem[];
}

export interface AudienceCommentItem {
  id: number;
  viewerId?: number;
  guestId?: string;
  nickname?: string;
  content: string;
  commentTime: string;
  deleted: boolean;
}

export interface AudienceCommentListResult {
  page: number;
  pageSize: number;
  total: number;
  list: AudienceCommentItem[];
}

export interface AudienceImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; phone: string; reason: string }[];
}

export function listAudiences(
  activityId: ActivityId,
  params: {
    page?: number;
    pageSize?: number;
    keywordType?: AudienceKeywordType;
    keyword?: string;
    tagIds?: number[];
    tagMatch?: AudienceTagMatch;
    entitlementStatus?: number;
    totalWatchDurationOp?: AudienceDurationOp;
    totalWatchDurationSec?: number;
    liveWatchDurationOp?: AudienceDurationOp;
    liveWatchDurationSec?: number;
    sort?: string;
    order?: string;
  } = {},
) {
  const { tagIds, ...rest } = params;
  return get<AudienceListResult>(`/activities/audiences/list/${activityId}`, {
    params: {
      ...rest,
      tagIds: tagIds?.length ? tagIds.join(",") : undefined,
    },
  });
}

export function createAudience(activityId: ActivityId, phone: string) {
  return post<{ id: number; viewerId: number }>(`/activities/audiences/create/${activityId}`, {
    phone,
  });
}

export function updateAudienceEntitlement(rowId: number, entitlementStatus: 0 | 1) {
  return put<{ id: number; entitlementStatus: number }>(
    `/activities/audiences/entitlement/${rowId}`,
    { entitlementStatus },
  );
}

export function listAudienceComments(
  activityId: ActivityId,
  params: { page?: number; pageSize?: number; nickname?: string } = {},
) {
  return get<AudienceCommentListResult>(`/activities/audiences/comments/${activityId}`, {
    params,
  });
}

export async function importAudiences(activityId: ActivityId, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = getAccessToken();
  const resp = await axios.post(
    `/api/v1/activities/audiences/import/${activityId}`,
    form,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 60000,
    },
  );
  const body = resp.data as { code: number; msg: string; data: AudienceImportResult };
  if (body?.code !== 0) {
    throw new Error(body?.msg || "导入失败");
  }
  return body.data;
}

export async function downloadAudienceImportTemplate() {
  const token = getAccessToken();
  const resp = await axios.get("/api/v1/activities/audiences/import-template", {
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audience-import.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDurationSec(sec: number): string {
  const n = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
