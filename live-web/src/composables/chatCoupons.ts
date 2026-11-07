/**
 * 观看端优惠券自定义消息（D113）。
 * 实时：customEvent；历史：本站 coupon-history 按时间并入。
 */
import {
  listWatchCouponHistory,
  toCouponChatMessage,
  type CouponChatPayload,
} from "@/api/watchCoupons";

interface CouponChatState {
  chatMessages: ChatMessage[];
}

interface CreateChatCouponsDeps {
  chat: CouponChatState;
  getSdk: () => VhallSdkInstance | null;
  getSender: () => { id: string; name: string };
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

export function parseCouponPayload(raw: unknown): CouponChatPayload | null {
  const root = asRecord(raw);
  if (!root) return null;
  const type = asText(root.type);
  const nested = asRecord(root.data) || asRecord(root.content) || root;
  const payloadType = asText(nested.type) || type;
  if (payloadType && payloadType !== "coupon") {
    if (asPositiveNumber(nested.couponId) == null) return null;
  }
  const couponId = asPositiveNumber(nested.couponId);
  const couponName = asText(nested.couponName);
  const couponAmount = asText(nested.couponAmount);
  if (couponId == null || !couponName || !couponAmount) return null;
  return {
    couponId,
    couponNo: asText(nested.couponNo) || undefined,
    couponName,
    couponAmount,
    couponStartDate: asText(nested.couponStartDate) || undefined,
    couponEndDate: asText(nested.couponEndDate) || undefined,
    employeeId: asPositiveNumber(nested.employeeId) ?? undefined,
    deptId: asPositiveNumber(nested.deptId) ?? undefined,
    deptName: asText(nested.deptName) || undefined,
    commentId: asPositiveNumber(nested.commentId) ?? undefined,
    nickname: asText(nested.nickname) || undefined,
  };
}

export function createChatCoupons(deps: CreateChatCouponsDeps) {
  const { chat, getSender, trimList, scrollChatToBottom } = deps;

  function mergeCouponItems(items: ChatMessage[]) {
    if (!items.length) return;
    const seen = new Set(
      chat.chatMessages
        .filter((m) => m.kind === "coupon" && m.msgId)
        .map((m) => m.msgId as string),
    );
    const next = [...chat.chatMessages];
    for (const item of items) {
      if (!item.msgId || seen.has(item.msgId)) continue;
      seen.add(item.msgId);
      next.push(item);
    }
    next.sort((a, b) => a.timestamp - b.timestamp);
    chat.chatMessages = next;
    scrollChatToBottom();
  }

  async function loadHistory(): Promise<void> {
    const activityId = deps.getActivityId?.()?.trim() ?? "";
    if (!activityId) return;
    try {
      const res = await listWatchCouponHistory(activityId);
      const items = (res.list ?? [])
        .map((row) => toCouponChatMessage(row))
        .filter((m): m is ChatMessage => m != null);
      mergeCouponItems(items);
    } catch (e) {
      console.warn("加载优惠券历史失败", e);
    }
  }

  function handleCustomEvent(raw: unknown) {
    const payload = parseCouponPayload(raw);
    if (!payload) return;
    const msg = toCouponChatMessage(
      payload,
      payload.nickname || getSender().name,
      Date.now(),
    );
    if (!msg) return;
    if (msg.msgId && chat.chatMessages.some((m) => m.msgId === msg.msgId)) return;
    chat.chatMessages.push(msg);
    trimList();
    scrollChatToBottom();
  }

  return { loadHistory, handleCustomEvent, mergeCouponItems };
}
