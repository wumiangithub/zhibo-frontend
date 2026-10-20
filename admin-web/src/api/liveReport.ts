import { get, post, put } from "./http";

export type ReportStatus = "pending" | "passed" | "rejected";

export interface PlanTime {
  startTime: string;
  endTime: string;
}

export interface ReportAttachment {
  name: string;
  url: string;
  objectKey: string;
  fileSize: number;
  mimeType?: string;
}

export interface ReportHost {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  avatar?: string;
}

export interface LiveReport {
  id: string;
  title: string;
  content: string;
  planTimes: PlanTime[];
  coverUrl: string;
  coverObjectKey: string;
  coverFileSize: number;
  coverMimeType: string;
  coverMaterialId?: string;
  host: ReportHost;
  attachments: ReportAttachment[];
  status: ReportStatus;
  boundLiveCount: number;
  /** 提交人员工 id（rs_mainkey_id） */
  submitterId: number;
  submitterName: string;
  departmentName?: string;
  submittedTime: string;
  updatedTime: string;
}

export interface SaveReportPayload {
  title: string;
  content: string;
  planTimes: PlanTime[];
  coverUrl: string;
  coverObjectKey: string;
  coverFileSize: number;
  coverMimeType: string;
  coverMaterialId: string;
  /** 主播员工 id（rs_mainkey_id） */
  hostId: number;
  attachments: ReportAttachment[];
}

export interface ReportAudit {
  id: string;
  action: "submit" | "resubmit" | "audit" | "append";
  result?: "passed" | "rejected";
  reason?: string;
  /** 操作人员工 id（rs_mainkey_id） */
  operatorId: number;
  operatorName: string;
  /** 操作人部门展示名；无则省略 */
  departmentName?: string;
  createdTime: string;
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "待审核",
  passed: "已通过",
  rejected: "已驳回",
};

export function listLiveReports(params: Record<string, unknown>) {
  return get<{ page: number; pageSize: number; total: number; list: LiveReport[] }>(
    "/live-reports/list",
    { params },
  );
}

export function getLiveReport(id: string) {
  return get<LiveReport>(`/live-reports/detail/${id}`);
}

export function createLiveReport(p: SaveReportPayload) {
  return post<{ id: string; status: ReportStatus }>("/live-reports/create", p);
}

export function updateLiveReport(id: string, p: Partial<SaveReportPayload>) {
  return put<{ id: string; status: ReportStatus }>(`/live-reports/update/${id}`, p);
}

export function auditLiveReport(id: string, result: "passed" | "rejected", reason?: string) {
  return post<{ id: string; status: ReportStatus }>(`/live-reports/audit/${id}`, { result, reason });
}

export function listLiveReportAudits(id: string) {
  return get<{ list: ReportAudit[] }>(`/live-reports/audits/${id}`);
}
