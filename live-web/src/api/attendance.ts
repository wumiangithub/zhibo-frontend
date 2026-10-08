import { post } from "./http";

export interface EnterAttendanceBody {
  userId: string;
  enterTime: string;
  nickname?: string;
  avatarUrl?: string;
  /** ≤64；短串 `{activityId}_{userId}_{enterTime到分}`，超长 SHA-256 hex；请求体时间仍带秒 */
  mid: string;
}

export interface LeaveAttendanceItem {
  userId: string;
  enterTime: string;
  leaveTime: string;
  /** ≤64；短串 `{activityId}_{userId}_{leaveTime到分}`，超长 SHA-256 hex；请求体时间仍带秒 */
  mid: string;
}

export interface LeaveAttendanceBatchBody {
  items: LeaveAttendanceItem[];
}

export interface LeaveAttendanceBatchResult {
  updated: number;
  skipped: number;
  missing: number;
}

export function enterAttendance(activityId: string, body: EnterAttendanceBody) {
  return post<{ id: string }>(`/watch/${activityId}/attendance/enter`, body);
}

/** 批量离开：`{ items }`，单请求 1～100 条 */
export function leaveAttendanceBatch(activityId: string, body: LeaveAttendanceBatchBody) {
  return post<LeaveAttendanceBatchResult>(`/watch/${activityId}/attendance/leave`, body);
}
