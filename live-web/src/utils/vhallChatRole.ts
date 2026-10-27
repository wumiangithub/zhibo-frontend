/**
 * 微吼聊天 role_name（历史 get-list / 实时 chatMsg 同源）：
 * 1 主持人 / 2 观众 / 3 助理 / 4 嘉宾
 * 注意：与 get-role-url 的 type（1 主持 / 2 嘉宾 / 3 助理）不是同一套枚举。
 */

export type VhallChatRole = 1 | 2 | 3 | 4;

const ROLE_LABEL: Record<VhallChatRole, string> = {
  1: "主持人",
  2: "观众",
  3: "助理",
  4: "嘉宾",
};

export function parseVhallChatRole(raw: unknown): VhallChatRole | undefined {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return undefined;
}

export function vhallChatRoleLabel(role: VhallChatRole | undefined): string | undefined {
  if (role == null) return undefined;
  return ROLE_LABEL[role];
}

/** 观众不打角标；主持/助理/嘉宾展示 */
export function vhallChatRoleBadge(role: VhallChatRole | undefined): string | undefined {
  if (role === 1 || role === 3 || role === 4) return ROLE_LABEL[role];
  return undefined;
}
