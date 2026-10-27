import { post } from "./http";

/** 仅员工邀请归因。 */
export function attributeAudience(
  activityId: string,
  body: { viewerId: number; inviterId: number; inviterKind?: "employee" },
) {
  return post<{ id: number; viewerId: number }>(
    `/watch/audience/attribute/${activityId}`,
    { inviterKind: "employee", ...body },
  );
}
