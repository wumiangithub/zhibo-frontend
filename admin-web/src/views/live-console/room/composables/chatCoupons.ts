/**
 * 中控台 / 观看端优惠券自定义消息（D113）。
 * 实时：sendCustomEvent / customEvent；历史：本站 coupon-history 按时间并入。
 */
import {
  listConsoleCouponHistory,
  type ConsoleCouponHistoryItem,
  type ConsoleSendCouponResult,
} from "../api/console";

export type CouponChatPayload = {
  couponId: number;
  couponNo?: string;
  couponName: string;
  couponAmount: string;
  couponStartDate?: string;
  couponEndDate?: string;
  employeeId?: number;
  deptId?: number;
  deptName?: string;
  commentId?: number;
  nickname?: string;
};

interface CouponChatState {
  chatMessages: ChatMessage[];
}

interface CreateChatCouponsDeps {
  chat: CouponChatState;
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

export function parseCouponPayload(raw: unknown): CouponChatPayload | null {
  const root = asRecord(raw);
  if (!root) return null;
  // customEvent 可能包一层 data / type
  const type = asText(root.type);
  const nested = asRecord(root.data) || asRecord(root.content) || root;
  const payloadType = asText(nested.type) || type;
  if (payloadType && payloadType !== "coupon") {
    // 无 type 时仍尝试按字段识别
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

export function toCouponChatMessage(
  row: ConsoleCouponHistoryItem | CouponChatPayload,
  senderName?: string,
  timestamp?: number,
): ChatMessage | null {
  const couponId = "couponId" in row ? row.couponId : null;
  if (couponId == null || couponId <= 0) return null;
  const name =
    ("senderName" in row ? row.senderName : undefined)?.trim() ||
    senderName?.trim() ||
    ("nickname" in row ? row.nickname : undefined)?.trim() ||
    "中控台";
  const couponName = row.couponName?.trim();
  const couponAmount = row.couponAmount?.trim();
  if (!couponName || !couponAmount) return null;
  const commentId =
    "id" in row && typeof row.id === "number"
      ? row.id
      : "commentId" in row
        ? row.commentId
        : undefined;
  const ts =
    timestamp ??
    ("timestamp" in row && typeof row.timestamp === "number" ? row.timestamp : Date.now());
  return {
    sender_id: row.employeeId != null ? `z${row.employeeId}` : "coupon",
    sender_name: name,
    msg: "",
    msgId: commentId != null ? `coupon_${commentId}` : `coupon_${couponId}_${ts}`,
    commentId: commentId ?? undefined,
    role_name: 3,
    timestamp: ts,
    kind: "coupon",
    coupon: {
      couponId,
      couponNo: "couponNo" in row ? row.couponNo : undefined,
      couponName,
      couponAmount,
      couponStartDate: row.couponStartDate,
      couponEndDate: row.couponEndDate,
      employeeId: row.employeeId,
      deptId: row.deptId,
      deptName: row.deptName,
    },
  };
}

export function createChatCoupons(deps: CreateChatCouponsDeps) {
  const { chat, getSdk, getSender, trimList, scrollChatToBottom } = deps;

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
      const res = await listConsoleCouponHistory(activityId);
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

  /** 本站发券成功后：上屏 + sendCustomEvent */
  async function broadcastAfterSend(res: ConsoleSendCouponResult): Promise<void> {
    const local = toCouponChatMessage(
      {
        couponId: res.couponId,
        couponNo: res.couponNo,
        couponName: res.couponName,
        couponAmount: res.couponAmount,
        couponStartDate: res.couponStartDate,
        couponEndDate: res.couponEndDate,
        employeeId: res.employeeId,
        deptId: res.deptId,
        deptName: res.deptName,
        commentId: res.commentId,
        nickname: res.nickname,
      },
      res.nickname,
      Date.now(),
    );
    if (local) {
      if (!chat.chatMessages.some((m) => m.msgId === local.msgId)) {
        chat.chatMessages.push(local);
        trimList();
        scrollChatToBottom();
      }
    }

    const sdk = getSdk();
    const data: Record<string, unknown> = {
      couponId: res.couponId,
      couponNo: res.couponNo,
      couponName: res.couponName,
      couponAmount: res.couponAmount,
      couponStartDate: res.couponStartDate,
      couponEndDate: res.couponEndDate,
      employeeId: res.employeeId,
      commentId: res.commentId,
      nickname: res.nickname,
    };
    if (res.deptId != null) data.deptId = res.deptId;
    if (res.deptName?.trim()) data.deptName = res.deptName.trim();
    if (!sdk?.chat?.sendCustomEvent) {
      throw new Error("当前房间不支持发送优惠券消息");
    }
    try {
      await sdk.chat.sendCustomEvent({ type: "coupon", data });
    } catch (e) {
      console.warn("sendCustomEvent 优惠券失败", e);
      throw new Error("优惠券已记录，但聊天广播失败");
    }
  }

  return { loadHistory, handleCustomEvent, broadcastAfterSend, mergeCouponItems };
}
