/**
 * 中控台系统消息（D127）。
 * 实时：sendCustomEvent / customEvent type=system；历史：system-message-history。
 */
import { ref } from "vue";
import {
  listConsoleSystemMessageHistory,
  sendConsoleSystemMessage,
  unpinConsoleSystemMessage,
  type ConsoleSendSystemMessageResult,
  type ConsoleSystemMessageHistoryItem,
} from "../api/console";

export type SystemChatPayload = {
  text: string;
  pin?: boolean;
  commentId?: number;
  nickname?: string;
  action?: string;
};

export type PinnedSystemMessage = {
  commentId: number;
  text: string;
  nickname: string;
};

interface SystemChatState {
  chatMessages: ChatMessage[];
}

interface CreateChatSystemMessagesDeps {
  chat: SystemChatState;
  getSdk: () => VhallSdkInstance | null;
  getSender: () => { id: string; name: string; avatar?: string };
  trimList: () => void;
  scrollChatToBottom: () => void;
  getActivityId?: () => string | undefined;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function asPositiveNumber(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

export function parseSystemPayload(raw: unknown): SystemChatPayload | null {
  const root = asRecord(raw);
  if (!root) return null;
  const nested = asRecord(root.data) || asRecord(root.content) || root;
  const payloadType = asText(root.type) || asText(nested.type);
  if (payloadType === "coupon") return null;
  if (payloadType && payloadType !== "system") return null;
  const text = asText(nested.text);
  const commentId = asPositiveNumber(nested.commentId) ?? undefined;
  const action = asText(nested.action) || undefined;
  const pinRaw = nested.pin;
  const pin =
    pinRaw === true || pinRaw === "true" || pinRaw === 1 || pinRaw === "1"
      ? true
      : pinRaw === false || pinRaw === "false" || pinRaw === 0 || pinRaw === "0"
        ? false
        : undefined;
  // 无显式 type=system 时：须有 text，且不能是券字段
  if (!payloadType) {
    if (asPositiveNumber(nested.couponId) != null) return null;
    if (!text && action !== "unpin") return null;
  }
  if (!text && action !== "unpin" && pin !== false) return null;
  return {
    text,
    pin,
    commentId,
    nickname: asText(nested.nickname) || undefined,
    action,
  };
}

export function toSystemChatMessage(
  row: ConsoleSystemMessageHistoryItem | SystemChatPayload | ConsoleSendSystemMessageResult,
  senderName?: string,
  timestamp?: number,
): ChatMessage | null {
  const text = "text" in row ? String(row.text || "").trim() : "";
  if (!text) return null;
  const commentId =
    "commentId" in row && row.commentId != null && Number(row.commentId) > 0
      ? Number(row.commentId)
      : undefined;
  const nick =
    ("nickname" in row && row.nickname?.trim()) ||
    senderName?.trim() ||
    "系统消息";
  const ts =
    timestamp ??
    ("timestamp" in row && typeof row.timestamp === "number" ? row.timestamp : Date.now());
  return {
    sender_id: "system",
    sender_name: nick,
    msg: text,
    msgId: commentId != null ? `system_${commentId}` : `system_local_${ts}`,
    commentId,
    role_name: 3,
    timestamp: ts,
    kind: "system",
  };
}

export function createChatSystemMessages(deps: CreateChatSystemMessagesDeps) {
  const { chat, getSdk, getSender, trimList, scrollChatToBottom, getActivityId } = deps;
  const pinned = ref<PinnedSystemMessage | null>(null);

  function setPinnedFrom(msg: ChatMessage | null) {
    if (!msg?.commentId || !msg.msg?.trim()) {
      pinned.value = null;
      return;
    }
    pinned.value = {
      commentId: msg.commentId,
      text: msg.msg.trim(),
      nickname: msg.sender_name || "系统消息",
    };
  }

  function mergeSystemItems(items: ChatMessage[]) {
    if (!items.length) return;
    const existing = new Set(
      chat.chatMessages
        .filter((m) => m.kind === "system" && m.msgId)
        .map((m) => m.msgId as string),
    );
    const incoming = items.filter((m) => m.msgId && !existing.has(m.msgId));
    if (!incoming.length) return;
    chat.chatMessages = [...chat.chatMessages, ...incoming].sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    );
    trimList();
  }

  async function loadHistory(): Promise<void> {
    const activityId = getActivityId?.()?.trim();
    if (!activityId) return;
    try {
      const data = await listConsoleSystemMessageHistory(activityId);
      const items = (data.list || [])
        .map((row) => toSystemChatMessage(row))
        .filter((m): m is ChatMessage => m != null);
      mergeSystemItems(items);
      const pinId = data.pinnedCommentId;
      if (pinId != null && pinId > 0) {
        const hit = items.find((m) => m.commentId === pinId) || null;
        setPinnedFrom(hit);
      } else {
        pinned.value = null;
      }
    } catch (e) {
      console.warn("加载系统消息历史失败", e);
    }
  }

  function applyPayload(payload: SystemChatPayload, timestamp = Date.now()) {
    const isUnpin = payload.action === "unpin" || payload.pin === false;
    if (isUnpin) {
      if (
        payload.commentId != null &&
        pinned.value?.commentId === payload.commentId
      ) {
        pinned.value = null;
      } else if (payload.commentId == null) {
        pinned.value = null;
      }
      return;
    }
    const msg = toSystemChatMessage(payload, payload.nickname || getSender().name, timestamp);
    if (!msg) return;
    if (msg.msgId && chat.chatMessages.some((m) => m.msgId === msg.msgId)) {
      // already have message; still update pin
    } else {
      chat.chatMessages.push(msg);
      trimList();
      scrollChatToBottom();
    }
    if (payload.pin) {
      setPinnedFrom(msg);
    }
  }

  function handleCustomEvent(raw: unknown): boolean {
    const payload = parseSystemPayload(raw);
    if (!payload) return false;
    const root = asRecord(raw);
    const nested = root ? asRecord(root.data) || root : null;
    const t = asText(root?.type) || asText(nested?.type);
    // 必须显式 type=system（或 unpin 动作），避免吞掉其它自定义消息
    if (t !== "system" && payload.action !== "unpin") return false;
    applyPayload(payload);
    return true;
  }

  async function broadcastCustomEvent(data: Record<string, unknown>) {
    const sdk = getSdk();
    if (!sdk?.chat?.sendCustomEvent) {
      throw new Error("当前房间不支持发送系统消息");
    }
    try {
      await sdk.chat.sendCustomEvent({ type: "system", data });
    } catch (e) {
      console.warn("sendCustomEvent 系统消息失败", e);
      throw new Error("系统消息已记录，但聊天广播失败");
    }
  }

  async function sendAndBroadcast(text: string, pin: boolean): Promise<void> {
    const activityId = getActivityId?.()?.trim();
    if (!activityId) throw new Error("活动无效");
    const res = await sendConsoleSystemMessage(activityId, { text, pin });
    const local = toSystemChatMessage(res, res.nickname, Date.now());
    if (local && !chat.chatMessages.some((m) => m.msgId === local.msgId)) {
      chat.chatMessages.push(local);
      trimList();
      scrollChatToBottom();
    }
    if (res.pin) setPinnedFrom(local);
    else if (local?.commentId && pinned.value?.commentId === local.commentId) {
      pinned.value = null;
    }
    await broadcastCustomEvent({
      text: res.text,
      pin: res.pin,
      commentId: res.commentId,
      nickname: res.nickname,
    });
  }

  async function unpinAndBroadcast(commentId: number): Promise<void> {
    const activityId = getActivityId?.()?.trim();
    if (!activityId) throw new Error("活动无效");
    const res = await unpinConsoleSystemMessage(activityId, commentId);
    if (pinned.value?.commentId === commentId) pinned.value = null;
    await broadcastCustomEvent({
      text: res.text,
      pin: false,
      commentId: res.commentId,
      nickname: res.nickname,
      action: "unpin",
    });
  }

  /** 观众端本地关闭置顶条（不改库、不广播） */
  function dismissPinnedLocally() {
    pinned.value = null;
  }

  return {
    pinned,
    loadHistory,
    handleCustomEvent,
    sendAndBroadcast,
    unpinAndBroadcast,
    dismissPinnedLocally,
  };
}
