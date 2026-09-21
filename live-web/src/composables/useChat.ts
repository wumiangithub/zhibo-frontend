import { nextTick, reactive } from "vue";
import { normalizeEmojiText } from "@/constants/emoji";

const VERIFY_KEY = "zhibo.chatVerified";
const MAX_LEN = 140;
const MAX_LIST = 200;

export interface ChatOptions {
  getSdk: () => VhallSdkInstance | null;
  /** 乐观上屏时使用的本地身份 */
  getSender: () => { id: string; name: string };
  /** 消息落地后回调，用于把聊天同步成弹幕 */
  onIncoming?: (msg: ChatMessage) => void;
}

/**
 * 历史消息：{ content, nickname, user_id, id, user_role, role_name, create_timestamp }
 * 实时 chatMsg：{ context: 发送者, data: { type, text_content } }
 */
function normalizeChatItem(raw: Record<string, any>): ChatMessage | null {
  const ctx = raw.context || {};
  const payload = raw.data || {};
  if (payload.type && payload.type !== "text" && payload.type !== "image") return null;
  if (raw.event && raw.event !== "msg") return null;

  const text = raw.content || payload.text_content || "";
  const name = raw.nickname || raw.nick_name || ctx.nickname || ctx.nick_name || "";
  if (!text || !name) return null;

  const role = raw.role_name ?? ctx.role_name;
  return {
    sender_id: String(raw.user_id || ctx.third_account_id || ctx.user_id || ""),
    sender_name: name,
    msg: text,
    msgId: raw.id != null ? String(raw.id) : payload.msg_id != null ? String(payload.msg_id) : undefined,
    is_host: (raw.user_role || ctx.user_role) === "host" || String(role) === "1",
    timestamp: raw.create_timestamp ? Number(raw.create_timestamp) * 1000 : Date.now(),
  };
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

  /** 输入框聚焦即视为想发言：未验证先抢回焦点再弹验证框 */
  function requestChatFocus(el: HTMLInputElement | null) {
    if (chat.isChatMuted) return;
    if (isVerified()) {
      el?.focus();
    } else {
      el?.blur();
      chat.showVerifyDialog = true;
    }
  }

  function completeVerify(inputEl?: HTMLInputElement | null) {
    localStorage.setItem(VERIFY_KEY, "1");
    chat.showVerifyDialog = false;
    chat.verifyInput = "";
    window.setTimeout(() => inputEl?.focus(), 100);
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
  }

  function handleChatMessage(data: unknown) {
    const msg = normalizeChatItem(data as Record<string, any>);
    if (!msg) return;
    pushChatMessage(msg);
    onIncoming?.(msg);
  }

  function handleChatDelete(data: unknown) {
    const { msgId } = data as { msgId?: string };
    if (msgId) {
      chat.chatMessages = chat.chatMessages.filter((m) => m.msgId !== msgId);
    }
  }

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
      console.warn("加载聊天历史失败", e);
    }
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
    setMuted,
  });
}

export type ChatController = ReturnType<typeof useChat>;
