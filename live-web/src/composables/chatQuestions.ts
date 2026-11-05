import { useToast } from "@/composables/useToast";
import {
  extractQuestionAnswerUpsert,
  extractQuestionList,
  extractQuestionMsgBackfill,
  isQuestionAnswerCommit,
  isQuestionAnswerCreate,
  normalizeQuestionMessage,
  parseSendQuestionResult,
  questionFailText,
  questionMessageId,
} from "@/utils/vhallQuestion";
import type { ReportCommentBody, UpsertQuestionAnswerBody } from "@/api/comments";
import { CommentType } from "@/api/comments";

const MAX_LEN = 140;
/** 同一人两次提问的最短间隔 */
const QUESTION_GAP_MS = 15_000;
const QUESTION_SENT_KEY = "zhibo.questionSentAt";

/** 跨标签页仍算同一个人；键是发送者 id */
const questionSentAt = new Map<string, number>();

function senderKey(senderId: string): string {
  return senderId.trim() || "anon";
}

function readQuestionSentAt(senderId: string): number {
  const key = senderKey(senderId);
  const memory = questionSentAt.get(key) ?? 0;
  try {
    const stored = Number(localStorage.getItem(`${QUESTION_SENT_KEY}.${key}`));
    return Math.max(memory, Number.isFinite(stored) ? stored : 0);
  } catch {
    return memory;
  }
}

function writeQuestionSentAt(senderId: string, at: number) {
  const key = senderKey(senderId);
  questionSentAt.set(key, at);
  try {
    localStorage.setItem(`${QUESTION_SENT_KEY}.${key}`, String(at));
  } catch {
    /* 隐私模式只保留本页内存 */
  }
}

function clearQuestionSentAt(senderId: string, at: number) {
  const key = senderKey(senderId);
  if (questionSentAt.get(key) === at) questionSentAt.delete(key);
  try {
    const storageKey = `${QUESTION_SENT_KEY}.${key}`;
    if (Number(localStorage.getItem(storageKey)) === at) localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

interface QuestionChatState {
  chatMessages: ChatMessage[];
  chatInput: string;
  isChatMuted: boolean;
}

/**
 * 提问不走 chat.sendChat。须检查 sendQuestion 返回 code===200 且 data.id，
 * 再用该 id 乐观上屏并由 onSent 上报本站（commentType=提问 + questionId）。
 * 优先 instance.sendQuestion(text)；3.x demo 挂在 chat.sendQuestion。
 */
export function createChatQuestions(deps: {
  chat: QuestionChatState;
  getSdk: () => VhallSdkInstance | null;
  getSender: () => { id: string; name: string };
  canSend: () => boolean;
  trimList: () => void;
  scrollChatToBottom: () => void;
  /** 提问发送成功后上报本站（commentType=提问 + 云提问 id）。失败只打日志。 */
  onSent?: (text: string, questionId: string) => void;
  /** create 时若带 msg_id，幂等补写本站 msg_id。失败只打日志。 */
  onCreateMsgBackfill?: (body: ReportCommentBody) => void;
  /** question_answer_commit 后把主持人回复 upsert 到本站。失败只打日志。 */
  onAnswerCommit?: (body: UpsertQuestionAnswerBody) => void;
}) {
  const { chat, getSdk, getSender, canSend, trimList, scrollChatToBottom } = deps;
  const { toast } = useToast();

  function resolveSend(sdk: VhallSdkInstance): ((text: string) => Promise<unknown>) | null {
    if (typeof sdk.sendQuestion === "function") {
      const fn = sdk.sendQuestion;
      return (text) => Promise.resolve(fn.call(sdk, text));
    }
    const chatSend = sdk.chat?.sendQuestion;
    if (typeof chatSend === "function") {
      return (text) => Promise.resolve(chatSend.call(sdk.chat, text));
    }
    return null;
  }

  function upsert(msg: ChatMessage) {
    if (msg.msgId) {
      const idx = chat.chatMessages.findIndex((m) => m.msgId === msg.msgId);
      if (idx !== -1) {
        const prev = chat.chatMessages[idx];
        chat.chatMessages.splice(idx, 1, {
          ...prev,
          ...msg,
          kind: "question",
          answer: msg.answer ?? prev.answer,
        });
        return;
      }
    }
    const placeholderIdx = chat.chatMessages.findIndex(
      (m) =>
        m.kind === "question" &&
        typeof m.msgId === "string" &&
        m.msgId.startsWith("local_") &&
        m.msg === msg.msg &&
        Math.abs(m.timestamp - Date.now()) < 15000,
    );
    if (placeholderIdx !== -1) {
      chat.chatMessages.splice(placeholderIdx, 1, { ...msg, kind: "question" });
      return;
    }
    chat.chatMessages.push(msg);
    trimList();
    scrollChatToBottom();
  }

  async function sendQuestion(): Promise<void> {
    const text = chat.chatInput.trim();
    const sdk = getSdk();
    if (!text || !sdk || chat.isChatMuted || text.length > MAX_LEN) return;
    if (!canSend()) return;
    const send = resolveSend(sdk);
    if (!send) {
      toast("当前直播不支持提问");
      return;
    }
    const sender = getSender();
    const elapsed = Date.now() - readQuestionSentAt(sender.id);
    if (elapsed < QUESTION_GAP_MS) {
      const waitSec = Math.ceil((QUESTION_GAP_MS - elapsed) / 1000);
      toast(`15秒内只能提一个问题，请${waitSec}秒后再试`);
      return;
    }
    const sentAt = Date.now();
    writeQuestionSentAt(sender.id, sentAt);
    chat.chatInput = "";
    try {
      const result = await send(text);
      console.log("[vhall-sdk] sendQuestion result", result);
      const parsed = parseSendQuestionResult(result);
      if (!parsed.ok) {
        clearQuestionSentAt(sender.id, sentAt);
        chat.chatInput = text;
        toast(parsed.message);
        return;
      }
      deps.onSent?.(text, parsed.id);
      upsert({
        sender_id: sender.id,
        sender_name: sender.name,
        msg: text,
        msgId: parsed.id,
        role_name: 2,
        is_host: false,
        timestamp: sentAt,
        kind: "question",
      });
    } catch (e) {
      clearQuestionSentAt(sender.id, sentAt);
      chat.chatInput = text;
      console.warn("[vhall-sdk] sendQuestion failed", e);
      toast(questionFailText(e));
    }
  }

  function handleQuestion(raw: unknown) {
    const msg = normalizeQuestionMessage(raw);
    if (!msg) return;
    upsert(msg);
    if (isQuestionAnswerCreate(raw)) {
      const backfill = extractQuestionMsgBackfill(raw);
      if (backfill) {
        deps.onCreateMsgBackfill?.({
          content: backfill.content,
          nickname: backfill.nickname,
          roleName: backfill.roleName,
          commentType: CommentType.QUESTION,
          questionId: backfill.questionId,
          msgId: backfill.msgId,
        });
      }
      return;
    }
    // 回答落库仅在 commit（多观众重复 POST，后端按提问 id 幂等）
    if (!isQuestionAnswerCommit(raw)) return;
    const payload = extractQuestionAnswerUpsert(raw);
    if (!payload?.answerContent) return;
    deps.onAnswerCommit?.(payload);
  }

  function handleQuestionBackout(raw: unknown) {
    const id = questionMessageId(raw);
    if (!id) return;
    const hit = chat.chatMessages.find((m) => m.kind === "question" && m.msgId === id);
    if (hit) hit.answer = undefined;
  }

  async function loadHistory(): Promise<void> {
    const sdk = getSdk();
    const fn = sdk?.vhall_get_live_history_question_msg;
    if (!sdk || typeof fn !== "function") return;
    try {
      const res = await fn.call(sdk);
      const items = extractQuestionList(res)
        .map(normalizeQuestionMessage)
        .filter((m): m is ChatMessage => m != null);
      if (!items.length) return;
      const seen = new Set(
        chat.chatMessages.map((m) => m.msgId).filter((id): id is string => !!id),
      );
      const next = chat.chatMessages.slice();
      for (const item of items) {
        if (item.msgId && seen.has(item.msgId)) {
          const idx = next.findIndex((m) => m.msgId === item.msgId);
          if (idx >= 0) {
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
      next.sort((a, b) => a.timestamp - b.timestamp);
      chat.chatMessages = next;
      scrollChatToBottom();
    } catch (e) {
      console.warn("加载提问历史失败", e);
    }
  }

  return { sendQuestion, handleQuestion, handleQuestionBackout, loadHistory };
}
