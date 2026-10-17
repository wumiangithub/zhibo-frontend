import { get, post, put } from "./http";
export type ReportStatus = "pending" | "passed" | "rejected";
export interface PlanTime { startTime: string; endTime: string }
export interface ReportAttachment { name:string; url:string; objectKey:string; fileSize:number; mimeType?:string }
export interface ReportHost { id:string; userName:string; avatar?:string }
export interface LiveReport { id:string; title:string; content:string; planTimes:PlanTime[]; coverUrl:string; coverObjectKey:string; coverFileSize:number; coverMimeType:string; host:ReportHost; attachments:ReportAttachment[]; status:ReportStatus; boundLiveCount:number; submitterId:string; submitterName:string; departmentName?:string; submittedAt:string; updatedAt:string }
export interface SaveReportPayload { id:string; title:string; content:string; planTimes:PlanTime[]; coverUrl:string; coverObjectKey:string; coverFileSize:number; coverMimeType:string; hostId:string; attachments:ReportAttachment[] }
export interface ReportAudit { id:string; action:"submit"|"resubmit"|"audit"; result?:"passed"|"rejected"; reason?:string; operatorId:string; operatorName:string; createdAt:string }
export const REPORT_STATUS_LABEL:Record<ReportStatus,string>={pending:"待审核",passed:"已通过",rejected:"已驳回"};
export function listLiveReports(params:Record<string,unknown>){return get<{page:number;pageSize:number;total:number;list:LiveReport[]}>("/live-reports",{params});}
export function getLiveReport(id:string){return get<LiveReport>(`/live-reports/${id}`);}
export function createLiveReport(p:SaveReportPayload){return post<{id:string;status:ReportStatus}>("/live-reports",p);}
export function updateLiveReport(id:string,p:Partial<SaveReportPayload>){return put<{id:string;status:ReportStatus}>(`/live-reports/${id}`,p);}
export function auditLiveReport(id:string,result:"passed"|"rejected",reason?:string){return post<{id:string;status:ReportStatus}>(`/live-reports/${id}/audit`,{result,reason});}
export function listLiveReportAudits(id:string){return get<{list:ReportAudit[]}>(`/live-reports/${id}/audits`);}
