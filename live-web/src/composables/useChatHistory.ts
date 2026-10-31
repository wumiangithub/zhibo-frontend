import { nextTick, reactive } from "vue";
import {
  fetchWatchChatHistory,
  toChatMessage,
} from "@/api/chatHistory";
import type { ChatController } from "@/composables/useChat";

/**
 * 回放页只读聊天：拉 `/watch/chat-history`，形状对齐 ChatPanel 所需的 ChatController 子集。
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

  async function loadFirstPage() {
    page = 0;
    total = 0;
    exhausted = false;
    chat.chatMessages = [];
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
        chat.chatMessages = items;
        scrollChatToBottom();
      } else {
        const prevHeight = listEl?.scrollHeight ?? 0;
        const prevTop = listEl?.scrollTop ?? 0;
        chat.chatMessages = [...items, ...chat.chatMessages];
        preserveScrollAfterPrepend(prevHeight, prevTop);
      }

      if (items.length === 0 || chat.chatMessages.length >= total) {
        exhausted = true;
      }
    } catch (e) {
      console.warn("加载聊天历史失败", e);
      if (opts?.replace) chat.chatMessages = [];
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

  const controller = Object.assign(chat, {
    attachListEl,
    scrollChatToBottom,
    requestChatFocus: noop,
    completeVerify: noop,
    sendChat: noop,
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
