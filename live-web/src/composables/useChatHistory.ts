import { nextTick, reactive, ref } from "vue";
import {
  fetchWatchChatHistory,
  toChatMessage,
} from "@/api/chatHistory";
import {
  fetchWatchQuestionHistory,
  toQuestionChatMessage,
} from "@/api/questionHistory";
import {
  listWatchCouponHistory,
  toCouponChatMessage,
} from "@/api/watchCoupons";
import {
  listWatchSystemMessageHistory,
  toSystemChatMessage,
} from "@/api/watchSystemMessages";
import type { ChatController } from "@/composables/useChat";
import type { PinnedSystemMessage } from "@/composables/chatSystemMessages";
import {
  isSystemPinDismissed,
  rememberSystemPinDismissed,
} from "@/utils/systemPinDismiss";

/**
 * 回放页只读聊天：拉 `/watch/chat-history`（微吼）+ question/coupon/system-message-history（本站），
 * 形状对齐 ChatPanel 所需的 ChatController 子集。
 */
export function useChatHistory(getActivityId: () => string) {
  const chat = reactive({
    chatMessages: [] as ChatMessage[],
    chatInput: "",
    isChatMuted: false,
    showVerifyDialog: false,
    verifyInput: "",
  });

  let listEl: HTMLElement | null = null;
  let page = 0;
  let total = 0;
  let loading = false;
  let exhausted = false;
  let loadMoreCooldown = false;
  /** 本站提问缓存；聊天分页后重新并入，避免被 replace/prepend 冲掉 */
  let questionItems: ChatMessage[] = [];
  /** 本站优惠券历史缓存；并入逻辑同提问 */
  let couponItems: ChatMessage[] = [];
  /** 本站系统消息历史缓存；并入逻辑同提问 */
  let systemItems: ChatMessage[] = [];
  const systemPinned = ref<PinnedSystemMessage | null>(null);

  function attachListEl(el: unknown) {
    listEl = (el as HTMLElement | null) || null;
    if (listEl && chat.chatMessages.length) scrollChatToBottom();
  }

  function scrollChatToBottom() {
    nextTick(() => {
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  }

  function preserveScrollAfterPrepend(prevHeight: number, prevTop: number) {
    nextTick(() => {
      if (!listEl) return;
      const delta = listEl.scrollHeight - prevHeight;
      listEl.scrollTop = prevTop + delta;
    });
  }

  function mergeAuxiliaryIntoList(base: ChatMessage[]): ChatMessage[] {
    const buckets: ChatMessage[][] = [questionItems, couponItems, systemItems];
    let next = base.slice();
    for (const bucket of buckets) {
      if (!bucket.length) continue;
      const seen = new Set(
        next.map((m) => m.msgId).filter((id): id is string => !!id),
      );
      for (const item of bucket) {
        if (item.msgId && seen.has(item.msgId)) {
          const idx = next.findIndex((m) => m.msgId === item.msgId);
          if (idx >= 0 && item.kind === "question") {
            next[idx] = {
              ...next[idx],
              kind: "question",
              answer: item.answer ?? next[idx].answer,
            };
          }
          continue;
        }
        if (item.msgId) seen.add(item.msgId);
        next.push(item);
      }
    }
    next.sort((a, b) => a.timestamp - b.timestamp);
    return next;
  }

  async function loadQuestions(activityId: string) {
    try {
      const res = await fetchWatchQuestionHistory(activityId);
      questionItems = (res.list ?? [])
        .map(toQuestionChatMessage)
        .filter((m): m is ChatMessage => m != null);
    } catch (e) {
      console.warn("加载问答历史失败", e);
      questionItems = [];
    }
  }

  async function loadCoupons(activityId: string) {
    try {
      const res = await listWatchCouponHistory(activityId);
      couponItems = (res.list ?? [])
        .map((row) => toCouponChatMessage(row))
        .filter((m): m is ChatMessage => m != null);
    } catch (e) {
      console.warn("加载优惠券历史失败", e);
      couponItems = [];
    }
  }

  async function loadSystemMessages(activityId: string) {
    try {
      const res = await listWatchSystemMessageHistory(activityId);
      systemItems = (res.list ?? [])
        .map((row) => toSystemChatMessage(row))
        .filter((m): m is ChatMessage => m != null);
      const pinId = res.pinnedCommentId;
      if (pinId != null && pinId > 0) {
        if (isSystemPinDismissed(activityId, pinId)) {
          systemPinned.value = null;
        } else {
          const hit = systemItems.find((m) => m.commentId === pinId);
          systemPinned.value = hit?.commentId
            ? {
                commentId: hit.commentId,
                text: hit.msg.trim(),
                nickname: hit.sender_name || "系统消息",
              }
            : null;
        }
      } else {
        systemPinned.value = null;
      }
    } catch (e) {
      console.warn("加载系统消息历史失败", e);
      systemItems = [];
      systemPinned.value = null;
    }
  }

  async function loadFirstPage() {
    page = 0;
    total = 0;
    exhausted = false;
    questionItems = [];
    couponItems = [];
    systemItems = [];
    systemPinned.value = null;
    chat.chatMessages = [];
    const activityId = getActivityId()?.trim();
    if (activityId) {
      await Promise.all([
        loadQuestions(activityId),
        loadCoupons(activityId),
        loadSystemMessages(activityId),
      ]);
    }
    await loadMore({ replace: true });
  }

  async function loadMore(opts?: { replace?: boolean }) {
    const activityId = getActivityId()?.trim();
    if (!activityId || loading || exhausted) return;
    loading = true;
    try {
      const nextPage = page + 1;
      const res = await fetchWatchChatHistory(activityId, nextPage);
      const items = (res.list ?? [])
        .map(toChatMessage)
        .filter((m): m is ChatMessage => m != null);
      total = Number(res.total) || 0;
      page = nextPage;

      if (opts?.replace) {
        chat.chatMessages = mergeAuxiliaryIntoList(items);
        scrollChatToBottom();
      } else {
        const prevHeight = listEl?.scrollHeight ?? 0;
        const prevTop = listEl?.scrollTop ?? 0;
        // 先剥掉已并入的提问/券，再 prepend 聊天，最后重新 merge，避免重复
        const chatOnly = chat.chatMessages.filter(
          (m) => m.kind !== "question" && m.kind !== "coupon" && m.kind !== "system",
        );
        chat.chatMessages = mergeAuxiliaryIntoList([...items, ...chatOnly]);
        preserveScrollAfterPrepend(prevHeight, prevTop);
      }

      const chatCount = chat.chatMessages.filter(
        (m) => m.kind !== "question" && m.kind !== "coupon" && m.kind !== "system",
      ).length;
      if (items.length === 0 || chatCount >= total) {
        exhausted = true;
      }
    } catch (e) {
      console.warn("加载聊天历史失败", e);
      if (opts?.replace) {
        chat.chatMessages = mergeAuxiliaryIntoList([]);
      }
      exhausted = true;
    } finally {
      loading = false;
    }
  }

  /** 列表触顶：加载更旧一页并前置 */
  function onScrollNearTop() {
    if (loading || exhausted || loadMoreCooldown) return;
    loadMoreCooldown = true;
    void loadMore().finally(() => {
      window.setTimeout(() => {
        loadMoreCooldown = false;
      }, 400);
    });
  }

  function noop() {}

  function dismissSystemPin() {
    const activityId = getActivityId()?.trim() ?? "";
    const commentId = systemPinned.value?.commentId;
    if (activityId && commentId != null && commentId > 0) {
      rememberSystemPinDismissed(activityId, commentId);
    }
    systemPinned.value = null;
  }

  const controller = Object.assign(chat, {
    attachListEl,
    scrollChatToBottom,
    requestChatFocus: noop,
    completeVerify: noop,
    sendChat: noop,
    reportSentMessage: noop,
    sendQuestion: () => Promise.resolve(),
    handleQuestion: noop,
    handleQuestionBackout: noop,
    handleCustomEvent: noop,
    systemPinned,
    dismissSystemPin,
    handleChatMessage: noop,
    handleChatDelete: noop,
    loadChatHistory: loadFirstPage,
    scheduleLoadHistory: noop,
    cancelHistoryLoad: noop,
    resetHistoryLoad: noop,
    setMuted: noop,
  }) as ChatController;

  return {
    chat: controller,
    loadFirstPage,
    onScrollNearTop,
    get loading() {
      return loading;
    },
  };
}
