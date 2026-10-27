import { nextTick, reactive } from "vue";
import { deleteComment, reportComment } from "@/api/comments";
import { normalizeEmojiText } from "@/constants/emoji";
import { parseVhallChatRole } from "@/utils/vhallChatRole";

const VERIFY_KEY = "zhibo.chatVerified";
const MAX_LEN = 140;
const MAX_LIST = 200;

export interface ChatOptions {
  getSdk: () => VhallSdkInstance | null;
  /** 乐观上屏时使用的本地身份 */
  getSender: () => { id: string; name: string };
  /** 消息落地后回调，用于把聊天同步成弹幕 */
  onIncoming?: (msg: ChatMessage) => void;
  /** 本站活动 UUID；有则把聊天上报本站库（D77） */
  getActivityId?: () => string;
  /** 可选 viewer.id（已登录观众） */
  getViewerId?: () => number | null;
}

/**
 * 历史：SDK 扁平项 或 open-api get-list 嵌套项（见微吼文档）。
 * 实时 chatMsg：{ context, data: { type, text_content, nick_name, avatar } }
 *
 * 昵称 / 头像 / 角色优先顶层与 context（get-list 必需字段），再兜底 data。
 */
function normalizeChatItem(raw: Record<string, any>): ChatMessage | null {
  const ctx = raw.context || {};
  const payload = raw.data || {};
  if (payload.type && payload.type !== "text" && payload.type !== "image") return null;
  if (raw.event && raw.event !== "msg") return null;

  const text =
    raw.content ||
    payload.text_content ||
    payload.barrage_txt ||
    payload.barrageTxt ||
    "";
  const name =
    raw.nickname ||
    raw.nick_name ||
    ctx.nickname ||
    ctx.nick_name ||
    payload.nickname ||
    payload.nick_name ||
    "";
  if (!text || !name) return null;

  const avatarRaw =
    raw.avatar || ctx.avatar || payload.avatar || "";
  const avatar = typeof avatarRaw === "string" ? avatarRaw.trim() : "";

  let role = parseVhallChatRole(raw.role_name ?? ctx.role_name);
  // 旧扁平历史偶发 user_role=host，无数字 role_name
  if (role == null && (raw.user_role || ctx.user_role) === "host") {
    role = 1;
  }

  return {
    sender_id: String(
      raw.user_id ||
        raw.sender_id ||
        raw.third_user_id ||
        ctx.third_account_id ||
        ctx.user_id ||
        "",
    ),
    sender_name: String(name).trim(),
    msg: String(text),
    msgId:
      raw.id != null
        ? String(raw.id)
        : raw.msg_id != null
          ? String(raw.msg_id)
          : payload.msg_id != null
            ? String(payload.msg_id)
            : undefined,
    avatar: avatar || undefined,
    role_name: role,
    is_host: role === 1,
    timestamp: raw.create_timestamp ? Number(raw.create_timestamp) * 1000 : Date.now(),
  };
}

function formatCommentTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function persistComment(options: ChatOptions, msg: ChatMessage) {
  const activityId = options.getActivityId?.()?.trim() ?? "";
  if (!activityId || !msg.msg?.trim()) return;
  const guestId = msg.sender_id?.trim() || options.getSender().id || "";
  const viewerId = options.getViewerId?.() ?? null;
  if (!guestId && viewerId == null) return;
  void reportComment(activityId, {
    content: msg.msg.slice(0, 500),
    guestId: guestId || undefined,
    viewerId: viewerId ?? undefined,
    nickname: msg.sender_name || undefined,
    roleName: msg.role_name ?? undefined,
    providerMsgId:
      msg.msgId && !msg.msgId.startsWith("local_") ? msg.msgId.slice(0, 64) : undefined,
    commentTime: formatCommentTime(msg.timestamp || Date.now()),
  }).catch((e) => {
    console.warn("评论上报本站失败", e);
  });
}

export function useChat(options: ChatOptions) {
  const { getSdk, getSender, onIncoming } = options;
  const chat = reactive({
    chatMessages: [] as ChatMessage[],
    chatInput: "",
    isChatMuted: false,
    showVerifyDialog: false,
    verifyInput: "",
  });

  let historyTimer: number | undefined;
  let historyDisposed = false;

  let listEl: HTMLElement | null = null;

  /** 列表元素由模板 ref 函数挂进来；切 tab 回来会重新挂载，顺带滚到底 */
  function attachListEl(el: unknown) {
    listEl = (el as HTMLElement | null) || null;
    if (listEl) scrollChatToBottom();
  }

  function scrollChatToBottom() {
    nextTick(() => {
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  }

  function isVerified(): boolean {
    return localStorage.getItem(VERIFY_KEY) === "1";
  }

  /** 把 template ref / 组件实例收成可 focus 的 DOM 节点 */
  function resolveFocusEl(el: unknown): HTMLElement | null {
    if (!el) return null;
    if (el instanceof HTMLElement) return el;
    if (typeof el === "object" && el !== null && "$el" in el) {
      const root = (el as { $el: unknown }).$el;
      return root instanceof HTMLElement ? root : null;
    }
    // Vue Ref：勿用 `'value' in el` 误伤 HTMLInputElement（本身也有 value）
    if (typeof el === "object" && el !== null && !(el instanceof Node)) {
      const maybe = el as { value?: unknown };
      if ("value" in maybe) return resolveFocusEl(maybe.value);
    }
    return null;
  }

  /** 输入框聚焦即视为想发言：未验证先抢回焦点再弹验证框 */
  function requestChatFocus(el: unknown) {
    const input = resolveFocusEl(el);
    if (chat.isChatMuted) return;
    if (isVerified()) {
      input?.focus();
    } else {
      input?.blur();
      chat.showVerifyDialog = true;
    }
  }

  function completeVerify(inputEl?: unknown) {
    localStorage.setItem(VERIFY_KEY, "1");
    chat.showVerifyDialog = false;
    chat.verifyInput = "";
    const el = resolveFocusEl(inputEl);
    window.setTimeout(() => el?.focus(), 100);
  }

  function trimList() {
    if (chat.chatMessages.length > MAX_LIST) {
      chat.chatMessages = chat.chatMessages.slice(-MAX_LIST / 2);
    }
  }

  function sendChat() {
    const msg = chat.chatInput.trim();
    const sdk = getSdk();
    if (!msg || !sdk || chat.isChatMuted || msg.length > MAX_LEN) return;
    try {
      sdk.chat.sendChat(msg);
      const sender = getSender();
      chat.chatMessages.push({
        sender_id: sender.id,
        sender_name: sender.name,
        msg,
        msgId: `local_${Date.now()}`,
        role_name: 2,
        is_host: false,
        timestamp: Date.now(),
      });
      trimList();
      chat.chatInput = "";
      scrollChatToBottom();
    } catch (e) {
      console.error("发送聊天失败", e);
    }
  }

  function pushChatMessage(msg: ChatMessage) {
    // 自己发的消息先乐观插入 local_ 占位（sender_id=guestId），随后服务端回声用真实 user_id 再来一次，
    // 两者 sender_id 不同，只能按内容匹配把占位替换成带真实 msgId 的回声，避免本地出现两条。
    const placeholderIdx = chat.chatMessages.findIndex(
      (m) =>
        typeof m.msgId === "string" &&
        m.msgId.startsWith("local_") &&
        normalizeEmojiText(m.msg) === normalizeEmojiText(msg.msg) &&
        Math.abs(m.timestamp - Date.now()) < 15000,
    );
    if (placeholderIdx !== -1) {
      chat.chatMessages.splice(placeholderIdx, 1, msg);
      persistComment(options, msg);
      return;
    }
    // 他人消息或无占位命中时的常规去重：近 5 秒内相同发送者 + 内容视为同一条
    const isDuplicate = chat.chatMessages
      .slice(-20)
      .some(
        (m) =>
          m.sender_id === msg.sender_id &&
          normalizeEmojiText(m.msg) === normalizeEmojiText(msg.msg) &&
          Math.abs(m.timestamp - Date.now()) < 5000,
      );
    if (isDuplicate) return;
    chat.chatMessages.push(msg);
    trimList();
    persistComment(options, msg);
  }

  function handleChatMessage(data: VhallChatMsgMessage) {
    const msg = normalizeChatItem(data as unknown as Record<string, any>);
    if (!msg) return;
    // 实时推送带 date_time / msg_id，归一化历史字段对不上时补上
    if (!msg.msgId && data.msg_id) msg.msgId = data.msg_id;
    if (data.date_time) {
      const t = Date.parse(data.date_time.replace(" ", "T"));
      if (!Number.isNaN(t)) msg.timestamp = t;
    }
    if (!msg.sender_id && data.sender_id) msg.sender_id = data.sender_id;
    pushChatMessage(msg);
    onIncoming?.(msg);
  }

  function handleChatDelete(data: unknown) {
    const { msgId } = data as { msgId?: string };
    if (msgId) {
      chat.chatMessages = chat.chatMessages.filter((m) => m.msgId !== msgId);
      const activityId = options.getActivityId?.()?.trim() ?? "";
      if (activityId && !msgId.startsWith("local_")) {
        void deleteComment(activityId, { providerMsgId: msgId.slice(0, 64) }).catch((e) => {
          console.warn("评论软删上报失败", e);
        });
      }
    }
  }

  /** SDK 进房异步；login 未完成时拉历史会空/拒，用 interact_token 作就绪信号 */
  function hasSdkRoomReady(): boolean {
    const w = window as unknown as {
      vhsdklInfo?: { interact_token?: string };
      interact_token?: string;
    };
    return !!(w.vhsdklInfo?.interact_token || w.interact_token);
  }

  /**
   * 拉直播历史（SDK → open-api .../chat/get-list）。
   * 成功才整体替换列表；失败不碰已有消息（实时 chatMsg / 先前成功页仍可展示）。
   */
  async function loadChatHistory() {
    const sdk = getSdk();
    if (!sdk) return;
    try {
      // SDK 读 opt.page；page>1 会切到回放历史，直播历史固定传 1
      const res = await sdk.vhall_get_live_history_chat_msg({ page: 1 });
      const raw = res as Record<string, any>;
      const list: Record<string, any>[] = Array.isArray(raw) ? raw : raw.data || raw.list || [];
      const items = list.map(normalizeChatItem).filter((m): m is ChatMessage => m !== null);
      // 接口返回新→旧，列表展示旧→新
      chat.chatMessages = items.reverse();
      scrollChatToBottom();
    } catch (e) {
      // 偶发 CORS/Network（localhost→open-api）；列表已有内容时 warn 易误导成「历史没了」
      if (chat.chatMessages.length === 0) {
        console.warn("加载聊天历史失败", e);
      }
      throw e;
    }
  }

  /**
   * 等 SDK login/进房完成再拉历史；新机网络慢时立刻拉会踩 10s login 超时窗口。
   * onReady：历史成功后再跑（公告等同属 JSONP，须串行）。
   */
  function scheduleLoadHistory(onReady?: () => void | Promise<void>, tries = 0) {
    if (historyDisposed) return;
    const finish = () => {
      void loadChatHistory()
        .then(async () => {
          if (historyDisposed) return;
          await onReady?.();
        })
        .catch(() => {
          // 就绪后仍失败再补拉（login 边缘态 / 瞬时 CORS / 断连）
          if (historyDisposed) return;
          if (tries >= 18) {
            if (chat.chatMessages.length === 0) {
              console.warn("加载聊天历史已放弃重试（列表仍空）");
            }
            void onReady?.();
            return;
          }
          historyTimer = window.setTimeout(() => scheduleLoadHistory(onReady, tries + 1), 1500);
        });
    };
    if (hasSdkRoomReady() || tries >= 15) {
      finish();
      return;
    }
    historyTimer = window.setTimeout(() => scheduleLoadHistory(onReady, tries + 1), 1000);
  }

  function cancelHistoryLoad() {
    historyDisposed = true;
    if (historyTimer != null) {
      window.clearTimeout(historyTimer);
      historyTimer = undefined;
    }
  }

  /** destroySdk 后再进房时重置，允许重新 schedule */
  function resetHistoryLoad() {
    cancelHistoryLoad();
    historyDisposed = false;
  }

  function setMuted(muted: boolean) {
    chat.isChatMuted = muted;
  }

  return Object.assign(chat, {
    attachListEl,
    scrollChatToBottom,
    requestChatFocus,
    completeVerify,
    sendChat,
    handleChatMessage,
    handleChatDelete,
    loadChatHistory,
    scheduleLoadHistory,
    cancelHistoryLoad,
    resetHistoryLoad,
    setMuted,
  });
}

export type ChatController = ReturnType<typeof useChat>;
