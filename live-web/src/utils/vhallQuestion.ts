/**
 * 微吼提问（sendQuestion / question_answer_*）。
 * 历史与实时都可能是 { data: { content, nick_name, answer } }，也可能字段在顶层。
 */
import { parseVhallChatRole } from "@/utils/vhallChatRole";

function asRecord(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, any>;
}

const ANSWER_ROLE: Record<string, string> = {
  "1": "主持人",
  host: "主持人",
  "3": "助理",
  assistant: "助理",
  "4": "嘉宾",
  guest: "嘉宾",
};

function parseTime(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v.trim().replace(" ", "T"));
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

/** 事件或历史单项里的提问体 */
function questionBody(raw: unknown): Record<string, any> | null {
  const root = asRecord(raw);
  if (!root) return null;
  const data = asRecord(root.data);
  if (data && (data.content != null || data.nick_name || data.nickname || data.answer)) {
    return data;
  }
  if (root.content != null || root.nick_name || root.nickname || root.answer) return root;
  return data;
}

/** 微吼提问 data.id（create/commit/backout 对齐键；勿与 msg_id 混用）。 */
export function questionId(raw: unknown): string | undefined {
  const root = asRecord(raw);
  const body = questionBody(raw);
  const id = body?.id ?? body?.question_id ?? root?.question_id;
  if (id == null) return undefined;
  const s = String(id).trim();
  return s || undefined;
}

/** 微吼 data.msg_id（与提问 id 分列）。 */
export function questionSdkMsgId(raw: unknown): string | undefined {
  const body = questionBody(raw);
  const root = asRecord(raw);
  const msgId = body?.msg_id ?? body?.msgId ?? root?.msg_id ?? root?.msgId;
  if (msgId == null) return undefined;
  const s = String(msgId).trim();
  return s || undefined;
}

/** UI / 撤回用：优先提问 id，其次才退到 msg_id。 */
export function questionMessageId(raw: unknown): string | undefined {
  return questionId(raw) ?? questionSdkMsgId(raw);
}

function eventTypeOf(raw: unknown): string {
  const root = asRecord(raw);
  if (!root) return "";
  return String(root.event_type ?? root.eventType ?? "").trim().toLowerCase();
}

/** 是否微吼 question_answer_create（可补写 msg_id）。 */
export function isQuestionAnswerCreate(raw: unknown): boolean {
  return eventTypeOf(raw) === "question_answer_create";
}

/** 是否微吼 question_answer_commit（回答落库只在此事件触发）。 */
export function isQuestionAnswerCommit(raw: unknown): boolean {
  return eventTypeOf(raw) === "question_answer_commit";
}

function questionMeta(raw: unknown): {
  questionId: string;
  msgId?: string;
  content: string;
  nickname?: string;
  roleName?: number;
} | null {
  const body = questionBody(raw);
  if (!body) return null;
  const qid = questionId(raw);
  if (!qid) return null;
  const content = String(body.content ?? body.text ?? body.text_content ?? "").trim();
  const nickname = String(
    body.nick_name ?? body.nickname ?? body.nickName ?? body.user_name ?? body.username ?? body.name ?? "",
  ).trim();
  const roleName = parseVhallChatRole(body.role_name ?? body.roleName);
  const msgId = questionSdkMsgId(raw);
  return {
    questionId: qid.slice(0, 64),
    ...(msgId ? { msgId: msgId.slice(0, 64) } : {}),
    content: content.slice(0, 500),
    ...(nickname ? { nickname: nickname.slice(0, 64) } : {}),
    ...(roleName != null ? { roleName } : {}),
  };
}

/**
 * create 时补写 msg_id：须有提问 id + msg_id + 提问正文（行已存在则幂等补 msg；偶发竞态可补建）。
 */
export function extractQuestionMsgBackfill(
  raw: unknown,
): {
  questionId: string;
  msgId: string;
  content: string;
  nickname?: string;
  roleName?: number;
} | null {
  const meta = questionMeta(raw);
  if (!meta?.msgId || !meta.content) return null;
  return {
    questionId: meta.questionId,
    msgId: meta.msgId,
    content: meta.content,
    ...(meta.nickname ? { nickname: meta.nickname } : {}),
    ...(meta.roleName != null ? { roleName: meta.roleName } : {}),
  };
}

/** 从 commit 载荷抽出本站 upsert 字段；无提问 id 或无回复正文则 null。 */
export function extractQuestionAnswerUpsert(
  raw: unknown,
): {
  questionId: string;
  msgId?: string;
  content: string;
  nickname?: string;
  roleName?: number;
  answerContent: string;
  answerNickname?: string;
  answerRoleName?: number;
} | null {
  const meta = questionMeta(raw);
  if (!meta) return null;
  const body = questionBody(raw);
  const answerSrc = asRecord(body?.answer);
  if (!answerSrc) return null;
  const answerContent = String(answerSrc.content ?? answerSrc.text ?? "").trim();
  if (!answerContent) return null;
  const answerNickname = String(answerSrc.nick_name ?? answerSrc.nickname ?? "").trim();
  const answerRoleName = parseVhallChatRole(answerSrc.role_name ?? answerSrc.roleName);
  return {
    questionId: meta.questionId,
    ...(meta.msgId ? { msgId: meta.msgId } : {}),
    content: meta.content,
    ...(meta.nickname ? { nickname: meta.nickname } : {}),
    ...(meta.roleName != null ? { roleName: meta.roleName } : {}),
    answerContent: answerContent.slice(0, 500),
    ...(answerNickname ? { answerNickname: answerNickname.slice(0, 64) } : {}),
    ...(answerRoleName != null ? { answerRoleName } : {}),
  };
}

export function normalizeQuestionMessage(raw: unknown): ChatMessage | null {
  const body = questionBody(raw);
  if (!body) return null;
  const content = String(body.content ?? body.text ?? body.text_content ?? "").trim();
  const name = String(
    body.nick_name ?? body.nickname ?? body.nickName ?? body.user_name ?? body.username ?? body.name ?? "",
  ).trim();
  if (!content || !name) return null;

  const answerSrc = asRecord(body.answer);
  let answer: ChatMessage["answer"];
  if (answerSrc) {
    const answerContent = String(answerSrc.content ?? answerSrc.text ?? "").trim();
    if (answerContent) {
      const roleLabel = ANSWER_ROLE[String(answerSrc.role_name ?? "").trim()];
      const nickname = String(answerSrc.nick_name ?? answerSrc.nickname ?? "").trim();
      answer = {
        nickname,
        content: answerContent,
        ...(roleLabel ? { roleLabel } : {}),
      };
    }
  }

  const avatar = typeof body.avatar === "string" ? body.avatar.trim() : "";
  const id = questionMessageId(raw);
  const role = parseVhallChatRole(body.role_name ?? body.roleName);

  return {
    sender_id: String(body.join_id ?? body.user_id ?? body.sender_id ?? ""),
    sender_name: name,
    msg: content,
    ...(id ? { msgId: id } : {}),
    ...(avatar ? { avatar } : {}),
    role_name: role,
    is_host: role === 1,
    timestamp: parseTime(body.created_time ?? body.create_timestamp ?? body.date_time),
    kind: "question",
    ...(answer ? { answer } : {}),
  };
}

export function extractQuestionList(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  const root = asRecord(res);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data;
  const data = asRecord(root.data);
  if (data && Array.isArray(data.list)) return data.list;
  if (data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(root.list)) return root.list;
  return [];
}

export function questionAnswerText(msg: ChatMessage): string {
  const answer = msg.answer;
  if (!answer?.content) return "";
  const who = [answer.nickname, answer.roleLabel].filter(Boolean).join(" ");
  return who ? `${who}：${answer.content}` : answer.content;
}

/** 微吼业务码：数字或同值字符串都算命中 */
function sdkCodeIs(raw: unknown, expected: number): boolean {
  if (raw === expected || raw === String(expected)) return true;
  const n = Number(raw);
  return Number.isFinite(n) && n === expected;
}

/** 问答未开启时的固定文案（含 code 513016 / 旧 10006） */
export const QUESTION_DISABLED_TOAST =
  "直播间暂未开启问答，可联系主持人或助理开启";

export function questionFailText(e: unknown): string {
  const o = asRecord(e);
  const codeRaw = o?.code ?? o?.errorCode ?? o?.errCode;
  const msg = String(o?.msg ?? o?.message ?? o?.reason ?? (e instanceof Error ? e.message : ""));
  if (
    sdkCodeIs(codeRaw, 513016) ||
    sdkCodeIs(codeRaw, 10006) ||
    /未开启问答|问答必须处于开启状态/.test(msg)
  ) {
    return QUESTION_DISABLED_TOAST;
  }
  if (sdkCodeIs(codeRaw, 10002)) return "你已被禁言";
  if (sdkCodeIs(codeRaw, 10004)) return "主持人已开启全员禁言";
  if (sdkCodeIs(codeRaw, 10003)) return "提问不能超过140个字";
  if (sdkCodeIs(codeRaw, 10005)) return "当前不在直播中，不能提问";
  if (msg && msg !== "[object Object]") return msg;
  return "提问失败";
}

export type SendQuestionParse =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * sendQuestion 常 resolve 业务结果对象（非 200 也可能不 throw）。
 * 仅 code===200（或 "200"）且 data.id 有值才算成功。
 */
export function parseSendQuestionResult(result: unknown): SendQuestionParse {
  const o = asRecord(result);
  if (!o) return { ok: false, message: "提问失败" };
  const codeRaw = o.code ?? o.errorCode ?? o.errCode;
  if (sdkCodeIs(codeRaw, 200)) {
    const data = asRecord(o.data);
    const id = data?.id;
    if (id == null || String(id).trim() === "") {
      return { ok: false, message: "提问失败" };
    }
    return { ok: true, id: String(id).trim() };
  }
  return { ok: false, message: questionFailText(o) };
}
