<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  listRiskQuestions,
  RISK_INPUT_MULTI,
  RISK_INPUT_TEXT,
  type RiskAnswerItem,
  type RiskQuestion,
} from "@/api/orderCenter";
import {
  findResumeIndex,
  fingerprintRiskQuestions,
  loadRiskQuizProgress,
  saveRiskQuizProgress,
  writeRiskQuizFingerprint,
} from "@/utils/riskQuizProgress";

const props = defineProps<{
  open: boolean;
  /** 父级编排建单 + 提交风测时的 loading */
  submitting?: boolean;
  /** 父级建单/风测失败文案 */
  submitError?: string;
}>();

const emit = defineEmits<{
  close: [];
  /** 答完后把答案交给父级：create（若需）→ submitRisk → 开支付 */
  submit: [answers: RiskAnswerItem[]];
}>();

type Phase = "intro" | "quiz";

const phase = ref<Phase>("intro");
const loading = ref(false);
const error = ref("");
const questions = ref<RiskQuestion[]>([]);
const index = ref(0);
/** questionNo → 已选 optionCodes；手填题 codes[0] 为文本 */
const answers = ref<Record<number, string[]>>({});
const textDraft = ref("");
/** 当前题列表指纹；与 localStorage 比对 / 写入用 */
const questionsFingerprint = ref("");

const isSubmitting = computed(() => !!props.submitting);
const displayError = computed(() => props.submitError?.trim() || error.value);

const total = computed(() => questions.value.length);
/** 按题量估时：约 7 题 ≈ 1 分钟，至少 1 分钟 */
const estimateMinutes = computed(() => {
  const n = total.value;
  if (n <= 0) return 0;
  return Math.max(1, Math.ceil(n / 7));
});
const questionCountText = computed(() => {
  const n = total.value;
  if (n <= 0) return "题目加载中…";
  return `${n} 道题，无需准备材料`;
});
const timeTitleText = computed(() => {
  const m = estimateMinutes.value;
  if (m <= 0) return "题目加载中…";
  return `大约 ${m} 分钟`;
});
const introHintText = computed(() => {
  const n = total.value;
  const m = estimateMinutes.value;
  if (n <= 0) return "正在加载题目…";
  return `大约 ${m} 分钟 · 共 ${n} 道题`;
});
const current = computed(() => questions.value[index.value] ?? null);
const progressText = computed(() => {
  if (!current.value || total.value <= 0) return "";
  return `${index.value + 1}/${total.value}`;
});

const isMulti = computed(() => current.value?.inputType === RISK_INPUT_MULTI);
const isText = computed(() => current.value?.inputType === RISK_INPUT_TEXT);
const isLast = computed(() => total.value > 0 && index.value >= total.value - 1);

const selectedCodes = computed(() => {
  const q = current.value;
  if (!q) return [] as string[];
  return answers.value[q.questionNo] ?? [];
});

const canProceed = computed(() => {
  const q = current.value;
  if (!q) return false;
  if (isText.value) return textDraft.value.trim().length > 0;
  return selectedCodes.value.length > 0;
});

const primaryLabel = computed(() => {
  if (isSubmitting.value) return "提交中…";
  if (isLast.value) return "提交测评";
  return "下一题";
});

function persistProgress() {
  const fp = questionsFingerprint.value;
  if (!fp || questions.value.length === 0) return;
  saveRiskQuizProgress({
    fingerprint: fp,
    answers: { ...answers.value },
    index: index.value,
  });
}

function applyQuestions(list: RiskQuestion[]) {
  questions.value = list;
  if (list.length === 0) {
    questionsFingerprint.value = "";
    index.value = 0;
    answers.value = {};
    textDraft.value = "";
    error.value = "暂无风测题目，请稍后再试";
    return;
  }

  const fp = fingerprintRiskQuestions(list);
  questionsFingerprint.value = fp;
  const cached = loadRiskQuizProgress(fp);
  if (cached) {
    answers.value = { ...cached.answers };
    index.value = findResumeIndex(list, answers.value);
  } else {
    answers.value = {};
    index.value = 0;
    writeRiskQuizFingerprint(fp);
  }
  textDraft.value = "";
}

async function loadQuestions() {
  loading.value = true;
  error.value = "";
  try {
    const list = await listRiskQuestions();
    applyQuestions(list);
  } catch (e) {
    questions.value = [];
    questionsFingerprint.value = "";
    answers.value = {};
    index.value = 0;
    error.value = e instanceof Error ? e.message : "拉取问卷失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      phase.value = "intro";
      error.value = "";
      questions.value = [];
      questionsFingerprint.value = "";
      index.value = 0;
      answers.value = {};
      textDraft.value = "";
      void loadQuestions();
    }
  },
);

watch(current, (q) => {
  if (!q) {
    textDraft.value = "";
    return;
  }
  if (q.inputType === RISK_INPUT_TEXT) {
    textDraft.value = (answers.value[q.questionNo] ?? [])[0] ?? "";
  }
});

function onBack() {
  if (phase.value === "quiz") {
    if (index.value > 0) {
      index.value -= 1;
      error.value = "";
      return;
    }
    phase.value = "intro";
    error.value = "";
    return;
  }
  emit("close");
}

async function startQuiz() {
  error.value = "";
  if (loading.value) return;
  if (questions.value.length === 0) {
    await loadQuestions();
  }
  if (questions.value.length === 0) {
    if (!error.value) error.value = "暂无风测题目，请稍后再试";
    return;
  }
  // 保留已恢复的答案；停在第一道未作答（全答完则最后一题）
  index.value = findResumeIndex(questions.value, answers.value);
  phase.value = "quiz";
}

function isSelected(code: string): boolean {
  return selectedCodes.value.includes(code);
}

function toggleOption(code: string) {
  const q = current.value;
  if (!q || isText.value) return;
  const prev = answers.value[q.questionNo] ?? [];
  if (q.inputType === RISK_INPUT_MULTI) {
    const set = new Set(prev);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    answers.value = { ...answers.value, [q.questionNo]: Array.from(set) };
    persistProgress();
    return;
  }
  answers.value = { ...answers.value, [q.questionNo]: [code] };
  persistProgress();
}

function persistTextAnswer() {
  const q = current.value;
  if (!q || !isText.value) return;
  const t = textDraft.value.trim();
  if (!t) {
    const next = { ...answers.value };
    delete next[q.questionNo];
    answers.value = next;
    persistProgress();
    return;
  }
  answers.value = { ...answers.value, [q.questionNo]: [t] };
  persistProgress();
}

function onPrimary() {
  if (!canProceed.value || isSubmitting.value) return;
  const q = current.value;
  if (!q) return;

  if (isText.value) persistTextAnswer();
  if ((answers.value[q.questionNo] ?? []).length === 0) return;

  if (!isLast.value) {
    index.value += 1;
    error.value = "";
    persistProgress();
    return;
  }

  const payload: RiskAnswerItem[] = questions.value.map((item) => ({
    questionNo: item.questionNo,
    optionCodes: answers.value[item.questionNo] ?? [],
  }));
  const missing = payload.find((a) => a.optionCodes.length === 0);
  if (missing) {
    const idx = questions.value.findIndex((x) => x.questionNo === missing.questionNo);
    if (idx >= 0) index.value = idx;
    error.value = "请完成全部题目后再提交";
    persistProgress();
    return;
  }

  error.value = "";
  persistProgress();
  emit("submit", payload);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="risk-fade">
      <div
        v-if="open"
        class="risk-root"
        role="dialog"
        aria-modal="true"
        aria-label="风险测评"
      >
        <header class="risk-nav">
          <button
            type="button"
            class="risk-nav-back"
            aria-label="返回"
            @click="onBack"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 class="risk-nav-title">
            风险测评
          </h1>
          <span class="risk-nav-spacer" />
        </header>

        <!-- 引导页 -->
        <div
          v-if="phase === 'intro'"
          class="risk-body risk-intro"
        >
          <div class="risk-hero">
            <div class="risk-hero-icon" aria-hidden="true">
              <svg
                viewBox="0 0 48 48"
                fill="none"
              >
                <path
                  d="M24 6l14 6v10c0 9.2-6.1 17.5-14 20-7.9-2.5-14-10.8-14-20V12l14-6z"
                  fill="#E8F1FF"
                  stroke="#2F6BFF"
                  stroke-width="2"
                />
                <path
                  d="M18 24l5 5 9-10"
                  stroke="#2F6BFF"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h2 class="risk-hero-title">
              购买前，请先完成风险测评
            </h2>
            <p class="risk-hero-sub">
              为您的投资，匹配更合适的服务
            </p>
          </div>

          <div class="risk-notice">
            <span class="risk-notice-icon" aria-hidden="true">⚠</span>
            <p>
              根据监管要求，完成风险测评后方可支付。测评结果将用于产品匹配与合规留存。
            </p>
          </div>

          <ul class="risk-features">
            <li>
              <span class="risk-feat-icon clock" aria-hidden="true">⏱</span>
              <div>
                <p class="risk-feat-title">
                  {{ timeTitleText }}
                </p>
                <p class="risk-feat-desc">
                  {{ questionCountText }}
                </p>
              </div>
            </li>
            <li>
              <span class="risk-feat-icon heart" aria-hidden="true">♡</span>
              <div>
                <p class="risk-feat-title">
                  为您的投资负责
                </p>
                <p class="risk-feat-desc">
                  避免风险错配，选对适合自己的产品
                </p>
              </div>
            </li>
            <li>
              <span class="risk-feat-icon lock" aria-hidden="true">🔒</span>
              <div>
                <p class="risk-feat-title">
                  信息严格保密
                </p>
                <p class="risk-feat-desc">
                  结果仅用于合规匹配，不对外公开
                </p>
              </div>
            </li>
          </ul>

          <div class="risk-steps">
            <div class="risk-step done">
              <span class="risk-step-dot">✓</span>
              <span class="risk-step-label">提交订单</span>
            </div>
            <span class="risk-step-line" />
            <div class="risk-step current">
              <span class="risk-step-dot">2</span>
              <span class="risk-step-label">风险测评</span>
            </div>
            <span class="risk-step-line muted" />
            <div class="risk-step">
              <span class="risk-step-dot">3</span>
              <span class="risk-step-label">支付</span>
            </div>
          </div>

          <p
            v-if="displayError"
            class="risk-error"
          >
            {{ displayError }}
          </p>

          <div class="risk-intro-foot">
            <button
              type="button"
              class="risk-primary"
              :disabled="loading || total === 0"
              @click="startQuiz"
            >
              {{ loading ? "加载中…" : "开始风险测评" }}
            </button>
            <p class="risk-intro-hint">
              {{ introHintText }}
            </p>
            <p class="risk-legal">
              依据相关投资者适当性管理要求开展风险测评
            </p>
          </div>
        </div>

        <!-- 答题页 -->
        <div
          v-else
          class="risk-body risk-quiz"
        >
          <div
            v-if="current"
            class="risk-quiz-main"
          >
            <p class="risk-q-title">
              <span class="risk-q-progress">{{ progressText }}</span>
              {{ current.questionText }}
              <span
                v-if="isMulti"
                class="risk-q-tag"
              >（多选）</span>
            </p>

            <div
              v-if="isText"
              class="risk-text-wrap"
            >
              <textarea
                v-model="textDraft"
                class="risk-textarea"
                rows="4"
                maxlength="500"
                placeholder="请输入您的答案"
                @blur="persistTextAnswer"
              />
            </div>

            <ul
              v-else
              class="risk-options"
            >
              <li
                v-for="opt in current.options"
                :key="opt.optionCode"
              >
                <button
                  type="button"
                  class="risk-option"
                  :class="{ selected: isSelected(opt.optionCode) }"
                  @click="toggleOption(opt.optionCode)"
                >
                  <span
                    class="risk-radio"
                    :class="{ multi: isMulti }"
                    aria-hidden="true"
                  />
                  <span class="risk-option-text">
                    <span
                      v-if="opt.optionCode"
                      class="risk-option-code"
                    >{{ opt.optionCode }}.</span>
                    {{ opt.optionText }}
                  </span>
                </button>
              </li>
            </ul>

            <p
              v-if="displayError"
              class="risk-error"
            >
              {{ displayError }}
            </p>
          </div>

          <div class="risk-quiz-foot">
            <button
              type="button"
              class="risk-primary"
              :disabled="!canProceed || isSubmitting"
              @click="onPrimary"
            >
              {{ primaryLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.risk-root {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #1f2329;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.risk-nav {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 8px;
  padding-top: env(safe-area-inset-top, 0);
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.risk-nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #1f2329;
  cursor: pointer;
}

.risk-nav-back svg {
  width: 22px;
  height: 22px;
}

.risk-nav-title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
}

.risk-nav-spacer {
  width: 40px;
}

.risk-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.risk-intro {
  padding: 28px 20px 24px;
}

.risk-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.risk-hero-icon {
  width: 72px;
  height: 72px;
  margin-bottom: 16px;
}

.risk-hero-icon svg {
  width: 100%;
  height: 100%;
}

.risk-hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: #1f2329;
}

.risk-hero-sub {
  margin: 8px 0 0;
  font-size: 13px;
  color: #8a9199;
}

.risk-notice {
  margin-top: 20px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff6e8;
  color: #8a5a1a;
  font-size: 12px;
  line-height: 1.5;
}

.risk-notice p {
  margin: 0;
}

.risk-notice-icon {
  flex: none;
  margin-top: 1px;
}

.risk-features {
  margin: 16px 0 0;
  padding: 6px 16px;
  list-style: none;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.risk-features li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 0;
}

.risk-features li + li {
  border-top: 1px solid #f0f2f5;
}

.risk-feat-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 16px;
  background: #eef3ff;
}

.risk-feat-icon.heart {
  background: #ffeef0;
}

.risk-feat-icon.lock {
  background: #eefaf3;
}

.risk-feat-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.risk-feat-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a9199;
  line-height: 1.4;
}

.risk-steps {
  margin: 22px 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.risk-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 56px;
}

.risk-step-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e8ecf2;
  color: #8a9199;
  font-size: 12px;
  font-weight: 600;
}

.risk-step.done .risk-step-dot {
  background: #22c55e;
  color: #fff;
}

.risk-step.current .risk-step-dot {
  background: #c9a06c;
  color: #fff;
}

.risk-step-label {
  font-size: 12px;
  color: #8a9199;
}

.risk-step.current .risk-step-label {
  color: #c9a06c;
  font-weight: 600;
}

.risk-step.done .risk-step-label {
  color: #22c55e;
}

.risk-step-line {
  flex: 1;
  height: 2px;
  margin: 0 6px 22px;
  background: #22c55e;
  border-radius: 1px;
}

.risk-step-line.muted {
  background: #e8ecf2;
}

.risk-intro-foot {
  margin-top: 28px;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.risk-primary {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #2f6bff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.risk-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.risk-primary:not(:disabled):active {
  background: #2558db;
}

.risk-intro-hint {
  margin: 12px 0 0;
  text-align: center;
  font-size: 12px;
  color: #b0b7c0;
}

.risk-legal {
  margin: 20px 0 0;
  text-align: center;
  font-size: 11px;
  line-height: 1.5;
  color: #c0c5cc;
}

.risk-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: #f5222d;
  text-align: center;
}

.risk-quiz {
  display: flex;
  flex-direction: column;
  background: #fff;
}

.risk-quiz-main {
  flex: 1;
  padding: 20px 20px 12px;
}

.risk-q-title {
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.55;
  color: #1f2329;
}

.risk-q-progress {
  margin-right: 4px;
  color: #2f6bff;
  font-variant-numeric: tabular-nums;
}

.risk-q-tag {
  font-weight: 500;
  color: #8a9199;
}

.risk-options {
  margin: 0;
  padding: 0;
  list-style: none;
}

.risk-option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border: 0;
  border-bottom: 1px solid #f0f2f5;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.risk-option:last-child {
  border-bottom: 0;
}

.risk-radio {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border-radius: 999px;
  border: 1.5px solid #c9cdd6;
  box-sizing: border-box;
  position: relative;
}

.risk-option.selected .risk-radio {
  border-color: #2f6bff;
  background: #2f6bff;
}

.risk-option.selected .risk-radio::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #fff;
}

.risk-option-text {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  line-height: 1.5;
  color: #1f2329;
}

.risk-option-code {
  margin-right: 2px;
}

.risk-text-wrap {
  margin-top: 4px;
}

.risk-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #e8ecf1;
  border-radius: 10px;
  background: #f7f8fa;
  color: #1f2329;
  font: inherit;
  font-size: 15px;
  line-height: 1.5;
  resize: vertical;
}

.risk-textarea:focus {
  outline: none;
  border-color: #2f6bff;
  background: #fff;
}

.risk-quiz-foot {
  flex: none;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.04);
}

.risk-fade-enter-active,
.risk-fade-leave-active {
  transition: opacity 0.2s ease;
}

.risk-fade-enter-from,
.risk-fade-leave-to {
  opacity: 0;
}
</style>
