/**
 * 无 vitest 时用 Node 跑：node src/views/live-console/room/utils/chatViewerId.node-test.mjs
 * 与 chatViewerId.ts 认人规则保持同步。
 */
import assert from "node:assert/strict";

const AVATAR_VIEWER = /\/viewer\/avatar\/([A-Za-z0-9]{1,16})(?:\.[a-z0-9]+)?(?:\?|#|$)/i;
const AVATAR_QUERY_V = /[?&]v=([A-Za-z0-9]{1,16})(?:&|#|$)/i;
const ACCOUNT_LOCAL = /^(?:[A-Za-z0-9]{1,16}|[ze][1-9]\d{0,18})$/i;
const VIEWER = /^([A-Za-z0-9]{1,16})@qkzb\.com$/i;
const STAFF = /^e([1-9]\d{0,18})@qkzb\.com$/i;
const CONSOLE = /^z([1-9]\d{0,18})@qkzb\.com$/i;

function isStaffOrConsoleId(id) {
  return /^e\d+$/i.test(id) || /^z\d+$/i.test(id);
}

function parsePresenceUserId(email) {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) return null;
  const staff = STAFF.exec(trimmed);
  if (staff) return `e${staff[1]}`;
  const consoleM = CONSOLE.exec(trimmed);
  if (consoleM) return `z${consoleM[1]}`;
  const viewer = VIEWER.exec(trimmed);
  if (viewer) return viewer[1];
  return null;
}

function pickChatEmailish(raw) {
  const ctx = raw.context && typeof raw.context === "object" ? raw.context : {};
  const data = raw.data && typeof raw.data === "object" ? raw.data : {};
  for (const v of [raw.email, ctx.email, data.email, raw.account, ctx.account, data.account]) {
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }
  for (const v of [
    raw.account,
    ctx.account,
    data.account,
    ctx.third_account_id,
    raw.third_account_id,
  ]) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (s.includes("@")) return s;
    if (ACCOUNT_LOCAL.test(s)) return `${s.toLowerCase()}@qkzb.com`;
  }
  return undefined;
}

function viewerIdFromAvatarUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const q = AVATAR_QUERY_V.exec(trimmed);
  if (q?.[1]) {
    const v = q[1];
    if (isStaffOrConsoleId(v)) return undefined;
    return v;
  }
  const path = AVATAR_VIEWER.exec(trimmed);
  if (path?.[1]) return path[1];
  return undefined;
}

function chatViewerIdFromRaw(raw) {
  const email = pickChatEmailish(raw);
  if (email) {
    const userId = parsePresenceUserId(email);
    if (userId && !isStaffOrConsoleId(userId)) return userId;
    if (userId) return undefined;
  }
  for (const v of [raw.avatar, raw.context?.avatar, raw.data?.avatar]) {
    if (typeof v !== "string" || !v.trim()) continue;
    const id = viewerIdFromAvatarUrl(v);
    if (id) return id;
  }
  return undefined;
}

// --- viewerIdFromAvatarUrl：v= 优先于 path ---
assert.equal(
  viewerIdFromAvatarUrl("https://cdn/viewer/avatar/u99.png?v=u12"),
  "u12",
  "query v= beats path id",
);
assert.equal(viewerIdFromAvatarUrl("https://cdn/viewer/avatar/u12.png"), "u12");
assert.equal(
  viewerIdFromAvatarUrl(
    "https://qklive-testcos.cjs99.com/viewer/avatar/default-avatar.png?v=u12",
  ),
  "u12",
);
assert.equal(
  viewerIdFromAvatarUrl(
    "https://qklive-testcos.cjs99.com/viewer/avatar/default-avatar.png?v=z276",
  ),
  undefined,
);
assert.equal(viewerIdFromAvatarUrl("https://cdn/a.jpg?v=e10001"), undefined);

// --- 认人顺序：email/account → v= → path ---
assert.equal(
  chatViewerIdFromRaw({
    email: "u12@qkzb.com",
    avatar: "https://cdn/viewer/avatar/u99.png?v=u88",
  }),
  "u12",
  "email first",
);
assert.equal(
  chatViewerIdFromRaw({ account: "u12", avatar: "https://cdn/viewer/avatar/u99.png" }),
  "u12",
  "account local as third-party id",
);
assert.equal(
  chatViewerIdFromRaw({ account: "z276", avatar: "https://cdn/a.jpg?v=u12" }),
  undefined,
  "console account stops; do not guess viewer from avatar",
);
assert.equal(
  chatViewerIdFromRaw({ account: "e10001", avatar: "https://cdn/a.jpg?v=u12" }),
  undefined,
  "staff account stops",
);
assert.equal(
  chatViewerIdFromRaw({ avatar: "https://cdn/viewer/avatar/u99.png?v=u12" }),
  "u12",
  "v= before path when no email/account",
);
assert.equal(
  chatViewerIdFromRaw({ avatar: "https://cdn/viewer/avatar/u99.png" }),
  "u99",
  "path last",
);

console.log("chatViewerId.node-test.mjs ok");
