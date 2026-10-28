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
  importId?: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; phone: string; reason: string }[];
}

export interface AudienceImportHistoryItem {
  id: number;
  importTime: string;
  importerId: number;
  importerName?: string;
  successCount: number;
  failCount: number;
}

export interface AudienceImportHistoryList {
  list: AudienceImportHistoryItem[];
}

export type AudienceListQuery = {
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
};

function audienceFilterParams(params: AudienceListQuery = {}) {
  const { tagIds, ...rest } = params;
  return {
    ...rest,
    tagIds: tagIds?.length ? tagIds.join(",") : undefined,
  };
}

export function listAudiences(activityId: ActivityId, params: AudienceListQuery = {}) {
  return get<AudienceListResult>(`/activities/audiences/list/${activityId}`, {
    params: audienceFilterParams(params),
  });
}

/** phone 与 viewerId 二选一；created=false 表示本场已有该观众 */
export function createAudience(
  activityId: ActivityId,
  body: { phone: string } | { viewerId: number },
) {
  return post<{ id: number; viewerId: number; created: boolean }>(
    `/activities/audiences/create/${activityId}`,
    body,
  );
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

export function listAudienceImports(activityId: ActivityId) {
  return get<AudienceImportHistoryList>(`/activities/audiences/imports/list/${activityId}`);
}

async function downloadAuthorizedBlob(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
) {
  const token = getAccessToken();
  try {
    const resp = await axios.get(url, {
      responseType: "blob",
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 60000,
    });
    await saveBlob(resp.data as Blob, filename);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      throw new Error(await blobErrorMessage(e.response.data));
    }
    throw e;
  }
}

async function saveBlob(blob: Blob, filename: string) {
  if (blob.type && blob.type.includes("application/json")) {
    throw new Error(await blobErrorMessage(blob));
  }
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

async function blobErrorMessage(blob: Blob): Promise<string> {
  const text = await blob.text();
  try {
    const body = JSON.parse(text) as { msg?: string };
    if (body?.msg) return body.msg;
  } catch {
    // not json
  }
  return "下载失败";
}

export async function downloadAudienceImportTemplate() {
  await downloadAuthorizedBlob("/api/v1/activities/audiences/import-template", "audience-import.csv");
}

export async function downloadAudienceImportFailures(importId: number) {
  await downloadAuthorizedBlob(
    `/api/v1/activities/audiences/imports/failures/${importId}`,
    "audience-import-failures.csv",
  );
}

export async function exportAudiences(activityId: ActivityId, params: AudienceListQuery = {}) {
  await downloadAuthorizedBlob(
    `/api/v1/activities/audiences/export/${activityId}`,
    "audience-export.csv",
    audienceFilterParams(params),
  );
}

export function formatDurationSec(sec: number): string {
  const n = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
