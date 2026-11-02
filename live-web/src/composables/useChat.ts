import { nextTick, reactive } from "vue";
import { deleteComment, reportComment } from "@/api/comments";
import { normalizeEmojiText } from "@/constants/emoji";
import { collectVhallChatImageUrls } from "@/utils/vhallChatImage";
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
  /**
   * 无 viewerId 且未假验证时想发言：观看页跳小程序登录。
   * 不传则仍弹假验证框（中控台沿用 T11.2）。
   */
  onUnauthenticatedChat?: () => void;
}

/** 非空对象才当回复体（空 {} / [] 表示无回复，对齐 demo verifyIsShowReply） */
function asReplySource(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return Object.keys(v as object).length > 0 ? (v as Record<string, any>) : null;
}

/** 从对象上取昵称；含 chatServer camelCase nickName（demo context.nickName） */
function pickReplyNickname(...objs: Array<Record<string, any> | null | undefined>): string {
  for (const o of objs) {
    if (!o) continue;
    const n = o.nick_name ?? o.nickname ?? o.nickName ?? o.user_name ?? o.userName ?? o.name;
    const s = n != null ? String(n).trim() : "";
    if (s) return s;
  }
  return "";
}

/**
 * get-list 偶发带 accept_name：「回复 昵称：正文」；仅作昵称兜底。
 */
function nicknameFromAcceptName(raw: Record<string, any>): string {
  const accept = String(raw.accept_name || raw.acceptName || "").trim();
  if (!accept || accept === "all") return "";
  const m = /^回复\s*(.+?)[：:]/.exec(accept);
  return m?.[1]?.trim() || "";
}

/**
 * 从 context.replyMsg / reply_msg / 顶层同形字段抽出被回复昵称与正文。
 * content 可能是字符串，或 { text_content }（get-list 样例）；纯图片 →「[图片]」。
 * 昵称取不到时留空，禁止用角色文案「用户」顶替。
 */
function extractReplyQuote(
  raw: Record<string, any>,
  ctx: Record<string, any>,
): ChatMessage["reply"] | undefined {
  const src =
    asReplySource(ctx.replyMsg) ||
    asReplySource(ctx.reply_msg) ||
    asReplySource(raw.replyMsg) ||
    asReplySource(raw.reply_msg);
  if (!src) return undefined;

  const body =
    src.content && typeof src.content === "object" && !Array.isArray(src.content)
      ? (src.content as Record<string, any>)
      : null;

  let content = "";
  if (typeof src.content === "string") {
    content = src.content.trim();
  } else if (body) {
    content = String(
      body.text_content || body.barrage_txt || body.barrageTxt || "",
    ).trim();
    if (!content) {
      const imgs = body.image_urls || body.img_urls;
      if (Array.isArray(imgs) && imgs.length > 0) content = "[图片]";
      else if (body.type === "image") content = "[图片]";
    }
  }
  if (!content) {
    if (src.type === "image") content = "[图片]";
    else {
      const imgs = src.image_urls || src.img_urls;
      if (Array.isArray(imgs) && imgs.length > 0) content = "[图片]";
    }
  }
  // demo：须有 content 才展示回复块
  if (!content) return undefined;

  // 优先级：reply 本体 → content 嵌套 → accept_name「回复 昵称：」；勿读 role / 「用户」
  const nickname =
    pickReplyNickname(src, body, asReplySource(src.context)) ||
    nicknameFromAcceptName(raw);

  const replyMsgIdRaw = src.msg_id ?? src.msgId ?? src.id;
  const replyMsgId =
    replyMsgIdRaw != null && String(replyMsgIdRaw).trim()
      ? String(replyMsgIdRaw).trim()
      : undefined;

  if (!nickname) {
    console.debug("[chat] reply quote missing nickname", {
      keys: Object.keys(src),
      nick_name: src.nick_name,
      nickname: src.nickname,
      nickName: src.nickName,
      replyMsgId,
      contentKeys: body ? Object.keys(body) : typeof src.content,
    });
  }

  return {
    nickname,
    content,
    ...(replyMsgId ? { msgId: replyMsgId } : {}),
  };
}

/** reply 缺昵称时，用列表里被回复消息的 sender_name 回填 */
function fillReplyNicknameFromList(msg: ChatMessage, list: ChatMessage[]) {
  const reply = msg.reply;
  if (!reply || reply.nickname) return;
  if (reply.msgId) {
    const hit = list.find((m) => m.msgId && m.msgId === reply.msgId);
    if (hit?.sender_name) {
      reply.nickname = hit.sender_name;
      return;
    }
  }
  // 无 id 时：同正文最近一条（弱兜底，避免再显示空昵称）
  const text = (reply.content || "").trim();
  if (!text || text === "[图片]") return;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m === msg) continue;
    if ((m.msg || "").trim() === text && m.sender_name) {
      reply.nickname = m.sender_name;
      return;
    }
  }
}

/**
 * 历史：SDK 扁平项 或 open-api get-list 嵌套项（见微吼文档）。
 * 实时 chatMsg：{ context, data: { type, text_content, image_urls, nick_name, avatar } }
 * chatServer 归一化：{ type, content: { type, text_content, image_urls } }
 *
 * 昵称 / 头像 / 角色优先顶层与 context（get-list 必需字段），再兜底 data。
 * 纯图片消息无正文，勿因 !text 丢弃（对齐 demo config.js image_urls）。
 * 回复引用：context.replyMsg / reply_msg（与顶层同形）；空 {} 不设 reply。
 */
function normalizeChatItem(raw: Record<string, any>): ChatMessage | null {
  const ctx = raw.context || {};
  const nestedContent =
    raw.content && typeof raw.content === "object" ? raw.content : null;
  const payload = raw.data || nestedContent || {};
  const msgType = payload.type || raw.type;
  if (msgType && msgType !== "text" && msgType !== "image") return null;
  if (raw.event && raw.event !== "msg") return null;

  const textRaw =
    (typeof raw.content === "string" ? raw.content : "") ||
    payload.text_content ||
    payload.barrage_txt ||
    payload.barrageTxt ||
    "";
  const text = String(textRaw);
  const imageUrls = collectVhallChatImageUrls(
    payload.image_urls,
    payload.img_urls,
    raw.image_urls,
    raw.img_urls,
    nestedContent?.image_urls,
    nestedContent?.img_urls,
  );
  const name =
    raw.nickname ||
    raw.nick_name ||
    ctx.nickname ||
    ctx.nick_name ||
    payload.nickname ||
    payload.nick_name ||
    "";
  if (!name) return null;
  if (!text.trim() && imageUrls.length === 0) return null;

  const avatarRaw =
    raw.avatar || ctx.avatar || payload.avatar || "";
  const avatar = typeof avatarRaw === "string" ? avatarRaw.trim() : "";

  let role = parseVhallChatRole(raw.role_name ?? raw.roleName ?? ctx.role_name);
  // 旧扁平历史偶发 user_role=host，无数字 role_name
  if (role == null && (raw.user_role || ctx.user_role) === "host") {
    role = 1;
  }

  const reply = extractReplyQuote(raw, ctx);

  return {
    sender_id: String(
      raw.user_id ||
        raw.sender_id ||
        raw.sendId ||
        raw.third_user_id ||
        ctx.third_account_id ||
        ctx.user_id ||
        "",
    ),
    sender_name: String(name).trim(),
    msg: text,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    msgId:
      raw.id != null
        ? String(raw.id)
        : raw.msgId != null
          ? String(raw.msgId)
          : raw.msg_id != null
            ? String(raw.msg_id)
            : payload.msg_id != null
              ? String(payload.msg_id)
              : undefined,
    avatar: avatar || undefined,
    role_name: role,
    is_host: role === 1,
    timestamp: raw.create_timestamp ? Number(raw.create_timestamp) * 1000 : Date.now(),
    ...(reply ? { reply } : {}),
  };
}

function formatCommentTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 上报本站评论（须观众 JWT；viewerId 由后端从 Authorization 解析）。
 * 只报本人发言：发聊天必须登录，勿把当前 JWT 绑到他人 chatMsg。
 */
function persistComment(options: ChatOptions, msg: ChatMessage) {
  const activityId = options.getActivityId?.()?.trim() ?? "";
  if (!activityId) return;
  if (options.getViewerId?.() == null) return;
  const text = msg.msg?.trim() || (msg.imageUrls?.length ? "[图片]" : "");
  if (!text) return;
  void reportComment(activityId, {
    content: text.slice(0, 500),
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
    // 小程序 web-view 已带 viewerId：身份已定，跳过 T11.2 假验证弹窗
    if (options.getViewerId?.() != null) return true;
    // 观看页强制登录：不认假验证 localStorage，避免游客靠旧标记绕过
    if (options.onUnauthenticatedChat) return false;
    return localStorage.getItem(VERIFY_KEY) === "1";
  }

  /** 未通过身份时：观看页走登录回调，中控台仍弹假验证 */
  function gateUnauthenticated(): boolean {
    if (isVerified()) return true;
    if (options.onUnauthenticatedChat) {
      chat.showVerifyDialog = false;
      options.onUnauthenticatedChat();
      return false;
    }
    chat.showVerifyDialog = true;
    return false;
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

  /** 输入框聚焦即视为想发言：有 viewerId 直接聚焦；否则登录跳转或假验证 */
  function requestChatFocus(el: unknown) {
    const input = resolveFocusEl(el);
    if (chat.isChatMuted) return;
    if (gateUnauthenticated()) {
      input?.focus();
    } else {
      input?.blur();
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
    if (!gateUnauthenticated()) return;
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

  /**
   * 联调官方 `chat.sendCustomEvent`（文档：{ type, data } → Promise）。
   * 收包看 `[vhall-sdk] sendCustomEvent` / `[vhall-sdk] customEvent`。
   */
  async function sendCustomEventTest(): Promise<void> {
    const sdk = getSdk();
    if (!sdk?.chat?.sendCustomEvent) {
      console.warn("[vhall-sdk] sendCustomEvent unavailable: SDK 未就绪或不支持");
      return;
    }
    const payload = {
      type: "zhibo_test",
      data: {
        name: "zhibo自定义消息测试",
        at: Date.now(),
      },
    };
    try {
      const result = await sdk.chat.sendCustomEvent(payload);
      console.log("[vhall-sdk] sendCustomEvent result", result);
    } catch (e) {
      console.warn("[vhall-sdk] sendCustomEvent failed", e);
    }
  }

  function sameChatBody(a: ChatMessage, b: ChatMessage): boolean {
    if (normalizeEmojiText(a.msg || "") !== normalizeEmojiText(b.msg || "")) return false;
    const aImgs = (a.imageUrls || []).join("\0");
    const bImgs = (b.imageUrls || []).join("\0");
    return aImgs === bImgs;
  }

  function pushChatMessage(msg: ChatMessage) {
    fillReplyNicknameFromList(msg, chat.chatMessages);
    // 自己发的消息先乐观插入 local_ 占位（sender_id=guestId），随后服务端回声用真实 user_id 再来一次，
    // 两者 sender_id 不同，只能按内容匹配把占位替换成带真实 msgId 的回声，避免本地出现两条。
    const placeholderIdx = chat.chatMessages.findIndex(
      (m) =>
        typeof m.msgId === "string" &&
        m.msgId.startsWith("local_") &&
        sameChatBody(m, msg) &&
        Math.abs(m.timestamp - Date.now()) < 15000,
    );
    if (placeholderIdx !== -1) {
      chat.chatMessages.splice(placeholderIdx, 1, msg);
      // 本地发送回声：只上报本人
      persistComment(options, msg);
      return;
    }
    // 他人消息或无占位命中时的常规去重：近 5 秒内相同发送者 + 内容视为同一条
    const isDuplicate = chat.chatMessages
      .slice(-20)
      .some(
        (m) =>
          m.sender_id === msg.sender_id &&
          sameChatBody(m, msg) &&
          Math.abs(m.timestamp - Date.now()) < 5000,
      );
    if (isDuplicate) return;
    chat.chatMessages.push(msg);
    trimList();
    // 他人 chatMsg 不上报（viewerId 来自当前 JWT，不能绑到别人）
    const selfId = options.getSender().id?.trim() || "";
    if (selfId && msg.sender_id?.trim() === selfId) {
      persistComment(options, msg);
    }
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
      if (activityId && !msgId.startsWith("local_") && options.getViewerId?.() != null) {
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
      const ordered = items.reverse();
      for (const m of ordered) fillReplyNicknameFromList(m, ordered);
      chat.chatMessages = ordered;
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
    sendCustomEventTest,
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
