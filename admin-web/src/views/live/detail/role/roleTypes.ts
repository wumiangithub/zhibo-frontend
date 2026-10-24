/**
 * 本场开播角色。与库列 activity_member.role、接口 JSON 的 role 一致（D57 / D66）。
 * 数字与微吼 get-role-url 的 type 一一对应：1 主播 / 2 嘉宾 / 3 助理。
 * 不是员工组织里的系统角色（sys_uimsrole）。
 */
export const ActivityMemberRole = {
  /** 1 主播（微吼主持人） */
  HOST: 1,
  /** 2 嘉宾（微吼嘉宾） */
  GUEST: 2,
  /** 3 助理（微吼助理） */
  ASSISTANT: 3,
} as const;

export type ActivityMemberRoleCode =
  (typeof ActivityMemberRole)[keyof typeof ActivityMemberRole];

/** 本场直播角色（接口整数枚举）。 */
export type LiveRoomRole = ActivityMemberRoleCode;

/** 列表 / 表格展示用 */
export const ACTIVITY_MEMBER_ROLE_LABEL: Record<ActivityMemberRoleCode, string> = {
  [ActivityMemberRole.HOST]: "主播",
  [ActivityMemberRole.GUEST]: "嘉宾",
  [ActivityMemberRole.ASSISTANT]: "助理",
};

export interface LiveRoomMember {
  /** 员工 rs_mainkey_id */
  id: number;
  userName: string;
  /** 员工微信头像，实时查员工表 */
  headimgurl: string;
  departmentName: string;
  /** 1 主播 / 2 嘉宾 / 3 助理（与微吼 type 一致） */
  role: LiveRoomRole;
  /** 本场展示昵称 */
  nickname: string;
  /** 本场展示头像；空则用姓名首字 */
  avatarUrl: string;
  /** 直播间标签，如讲师、助教 */
  tag: string;
}

export interface RoleMeta {
  label: string;
  description: string;
  /** 新加入时的默认标签 */
  defaultTag: string;
  tone: "blue" | "orange";
}

/** 页面展示顺序：主播 → 助理 → 嘉宾（数字仍按微吼 type） */
export const ROLE_ORDER: LiveRoomRole[] = [
  ActivityMemberRole.HOST,
  ActivityMemberRole.ASSISTANT,
  ActivityMemberRole.GUEST,
];

export const ROLE_META: Record<LiveRoomRole, RoleMeta> = {
  [ActivityMemberRole.HOST]: {
    label: ACTIVITY_MEMBER_ROLE_LABEL[ActivityMemberRole.HOST],
    description: "拥有最高权限，可开启直播、管理成员，同时能使用营销、带货等全功能",
    defaultTag: "讲师",
    tone: "blue",
  },
  [ActivityMemberRole.ASSISTANT]: {
    label: ACTIVITY_MEMBER_ROLE_LABEL[ActivityMemberRole.ASSISTANT],
    description: "无开启直播权限，可协助管理成员、使用营销等功能",
    defaultTag: "助教",
    tone: "orange",
  },
  [ActivityMemberRole.GUEST]: {
    label: ACTIVITY_MEMBER_ROLE_LABEL[ActivityMemberRole.GUEST],
    description: "通过连麦参与直播互动，与主播同台完成直播",
    defaultTag: "嘉宾",
    tone: "orange",
  },
};

export function isLiveRoomRole(value: unknown): value is LiveRoomRole {
  return (
    value === ActivityMemberRole.HOST ||
    value === ActivityMemberRole.ASSISTANT ||
    value === ActivityMemberRole.GUEST
  );
}

export function createRoomMember(
  emp: { id: number; userName: string; departmentName?: string },
  role: LiveRoomRole,
): LiveRoomMember {
  return {
    id: emp.id,
    userName: emp.userName,
    headimgurl: "",
    departmentName: emp.departmentName?.trim() ?? "",
    role,
    nickname: emp.userName,
    avatarUrl: "",
    tag: ROLE_META[role].defaultTag,
  };
}
