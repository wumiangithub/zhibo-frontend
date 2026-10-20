/** 审核记录蓝色标签：AI / 风控 / 部门审核 / 人工审核。 */

export type AuditActorChannel = "ai" | "risk";

export interface AuditActorTagInput {
  /** 素材中心 AI / 风控通道；直播与报备人工审不传 */
  channel?: AuditActorChannel | null;
  /** 审核人部门展示名（可多部门顿号连接） */
  departmentName?: string | null;
}

/**
 * 审核完成节点左侧蓝标签文案。
 * AI →「AI审核」；风控 →「风控审核」；否则「{部门}审核」；无部门 →「人工审核」（禁止用人名）。
 */
export function resolveAuditActorTag(input: AuditActorTagInput): string {
  if (input.channel === "ai") return "AI审核";
  if (input.channel === "risk") return "风控审核";
  const dept = input.departmentName?.trim();
  if (dept) {
    return dept.endsWith("审核") ? dept : `${dept}审核`;
  }
  return "人工审核";
}
