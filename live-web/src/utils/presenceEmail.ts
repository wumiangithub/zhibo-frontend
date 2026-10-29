/** D85：从微吼推送顶层 email 解析本站 userId。对不上三种形态则返回 null，不要回退 sender_id。 */

const VIEWER = /^([1-9]\d{0,18})@qkzb\.com$/i;
const STAFF = /^e([1-9]\d{0,18})@qkzb\.com$/i;
const GUEST_LOCAL = /^([A-Za-z0-9]{1,64})@zhibo\.local$/i;

export function parsePresenceUserId(email: string | undefined | null): string | null {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) return null;
  const viewer = VIEWER.exec(trimmed);
  if (viewer) return viewer[1];
  const staff = STAFF.exec(trimmed);
  if (staff) return `e${staff[1]}`;
  const guest = GUEST_LOCAL.exec(trimmed);
  if (guest) return guest[1];
  return null;
}

export function presenceUserIdFromMessage(msg: VhallUserPresenceMessage): string | null {
  return parsePresenceUserId(msg.email);
}
