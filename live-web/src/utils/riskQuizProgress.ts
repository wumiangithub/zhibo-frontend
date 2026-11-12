import type { RiskQuestion } from "@/api/orderCenter";
import { getViewerOrderCenterUsername, getViewerUsername } from "@/utils/viewerAuth";

/** 全局题库按观众隔离：`zhibo.riskQuiz.{viewerKey}` */
const KEY_PREFIX = "zhibo.riskQuiz.";

export interface RiskQuizProgress {
  fingerprint: string;
  /** questionNo → optionCodes（手填题 codes[0] 为文本） */
  answers: Record<number, string[]>;
  /** 上次停留题下标（0-based）；打开时仍按「第一道未作答」重算 */
  index: number;
}

function resolveViewerKey(): string {
  const fromJwt = getViewerOrderCenterUsername().trim();
  if (fromJwt) return fromJwt;
  return getViewerUsername().trim();
}

export function riskQuizStorageKey(viewerKey = resolveViewerKey()): string {
  return `${KEY_PREFIX}${viewerKey}`;
}

/** 题目指纹：questionNo + inputType + questionText + optionCode 顺序 */
export function fingerprintRiskQuestions(list: RiskQuestion[]): string {
  const payload = list.map((q) => [
    q.questionNo,
    q.inputType,
    q.questionText ?? "",
    (q.options ?? []).map((o) => o.optionCode),
  ]);
  return fnv1aHex(JSON.stringify(payload));
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** 第一道未作答下标；全部已答则最后一题 */
export function findResumeIndex(
  questions: RiskQuestion[],
  answers: Record<number, string[]>,
): number {
  if (questions.length === 0) return 0;
  const firstOpen = questions.findIndex((q) => (answers[q.questionNo] ?? []).length === 0);
  if (firstOpen < 0) return questions.length - 1;
  return firstOpen;
}

function normalizeAnswers(raw: unknown): Record<number, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<number, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const no = Number(k);
    if (!Number.isInteger(no) || no <= 0 || !Array.isArray(v)) continue;
    const codes = v
      .map((c) => (typeof c === "string" ? c : String(c ?? "")))
      .map((c) => c.trim())
      .filter(Boolean);
    if (codes.length > 0) out[no] = codes;
  }
  return out;
}

export function loadRiskQuizProgress(
  expectedFingerprint: string,
): RiskQuizProgress | null {
  const viewerKey = resolveViewerKey();
  if (!viewerKey || !expectedFingerprint) return null;
  try {
    const raw = localStorage.getItem(riskQuizStorageKey(viewerKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      fingerprint?: unknown;
      answers?: unknown;
      index?: unknown;
    };
    const fingerprint =
      typeof parsed.fingerprint === "string" ? parsed.fingerprint.trim() : "";
    if (!fingerprint || fingerprint !== expectedFingerprint) {
      clearRiskQuizProgress(viewerKey);
      return null;
    }
    const answers = normalizeAnswers(parsed.answers);
    const index =
      typeof parsed.index === "number" && Number.isInteger(parsed.index) && parsed.index >= 0
        ? parsed.index
        : 0;
    return { fingerprint, answers, index };
  } catch {
    return null;
  }
}

export function saveRiskQuizProgress(progress: RiskQuizProgress): void {
  const viewerKey = resolveViewerKey();
  if (!viewerKey || !progress.fingerprint) return;
  try {
    const answers: Record<string, string[]> = {};
    for (const [no, codes] of Object.entries(progress.answers)) {
      if (Array.isArray(codes) && codes.length > 0) answers[no] = codes;
    }
    localStorage.setItem(
      riskQuizStorageKey(viewerKey),
      JSON.stringify({
        fingerprint: progress.fingerprint,
        answers,
        index: Math.max(0, Math.floor(progress.index)),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** 写入仅含指纹的空进度（题列表变更后重建） */
export function writeRiskQuizFingerprint(fingerprint: string): void {
  saveRiskQuizProgress({ fingerprint, answers: {}, index: 0 });
}

export function clearRiskQuizProgress(viewerKey = resolveViewerKey()): void {
  if (!viewerKey) return;
  try {
    localStorage.removeItem(riskQuizStorageKey(viewerKey));
  } catch {
    /* ignore */
  }
}
