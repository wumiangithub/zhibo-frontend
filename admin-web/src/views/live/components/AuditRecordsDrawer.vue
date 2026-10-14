<script setup lang="ts">
import { computed } from "vue";
import { ElDrawer } from "element-plus";
import { CircleCheckFilled } from "@element-plus/icons-vue";

/**
 * 审核记录侧栏：仅 UI。真实审核流后续接风控平台返回的审核流 + 最终结果。
 * 本组件用 Mock 演示三种原型场景，不读本站 GET /audits。
 */

export interface AuditApplyNode {
  kind: "apply";
  applicant: string;
  time: string;
}

export interface AuditStepNode {
  kind: "audit";
  /** 部门标签：AI审核 / 研究部审核 / 合规审核 等 */
  department: string;
  operatorName: string;
  time: string;
  /** 节点右侧状态文案 */
  nodeStatus: string;
  result: "passed" | "rejected";
  /** 意见 / AI 疑似违规文案；有则展示灰底框 */
  comment?: string;
}

export type AuditTimelineNode = AuditApplyNode | AuditStepNode;

const props = defineProps<{
  modelValue: boolean;
  /** 直播标题，仅展示用 */
  title?: string;
  activityId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

/** 三种原型场景 Mock，按活动 id 轮换便于联调 UI */
const SCENARIOS: AuditTimelineNode[][] = [
  // 场景1：发起 + AI 通过 + AI 不通过（带违规说明）
  [
    { kind: "apply", applicant: "余灵巧", time: "2026-09-02 09:30" },
    {
      kind: "audit",
      department: "AI审核",
      operatorName: "AI",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
    },
    {
      kind: "audit",
      department: "AI审核",
      operatorName: "AI",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "rejected",
      comment:
        "这里是风控平台返回的AI检测出的疑似违规内容这里是风控平台返回的AI检测出的疑似违规内容这里是风控平台返回的AI检测出的疑似违规内容",
    },
  ],
  // 场景2：发起 + 研究部 + 合规（均通过，带意见）
  [
    { kind: "apply", applicant: "余灵巧", time: "2026-09-02 09:30" },
    {
      kind: "audit",
      department: "研究部审核",
      operatorName: "汪牧芊",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
      comment: "这里是审核结果这里是审核结果这里是审核结果这里是审核结果这里是审核结果",
    },
    {
      kind: "audit",
      department: "合规审核",
      operatorName: "余应婷",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
      comment: "这里是审核结果这里是审核结果这里是审核结果这里是审核结果这里是审核结果",
    },
  ],
  // 场景3：完整流 发起 → AI → 研究部 → 合规
  [
    { kind: "apply", applicant: "余灵巧", time: "2026-09-02 09:30" },
    {
      kind: "audit",
      department: "AI审核",
      operatorName: "AI",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
    },
    {
      kind: "audit",
      department: "研究部审核",
      operatorName: "汪牧芊",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
      comment: "这里是审核结果这里是审核结果这里是审核结果这里是审核结果这里是审核结果",
    },
    {
      kind: "audit",
      department: "合规审核",
      operatorName: "余应婷",
      time: "2026-09-02 09:30",
      nodeStatus: "审核完成",
      result: "passed",
      comment: "这里是审核结果这里是审核结果这里是审核结果这里是审核结果这里是审核结果",
    },
  ],
];

const nodes = computed(() => {
  const id = props.activityId ?? "";
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return SCENARIOS[sum % SCENARIOS.length] ?? SCENARIOS[0];
});

function resultText(r: "passed" | "rejected") {
  return r === "passed" ? "审核通过" : "审核不通过";
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    title="审核记录"
    direction="rtl"
    size="420px"
    class="audit-records-drawer"
  >
    <p
      v-if="title"
      class="drawer-sub"
    >
      {{ title }}
      <span class="mock-tip">（UI Mock，后续接风控审核流）</span>
    </p>

    <div class="timeline">
      <div
        v-for="(node, idx) in nodes"
        :key="idx"
        class="tl-item"
      >
        <div class="tl-rail">
          <ElIcon
            class="tl-icon"
            :size="18"
          >
            <CircleCheckFilled />
          </ElIcon>
          <div
            v-if="idx < nodes.length - 1"
            class="tl-line"
          />
        </div>

        <div class="tl-card">
          <template v-if="node.kind === 'apply'">
            <div class="tl-head">
              <span class="dept-tag">发起申请</span>
            </div>
            <div class="tl-row">
              <span>发起人：{{ node.applicant }}</span>
            </div>
            <div class="tl-row">
              <span>发起时间：{{ node.time }}</span>
            </div>
          </template>

          <template v-else>
            <div class="tl-head">
              <span class="dept-tag">{{ node.department }}</span>
              <span class="node-status">{{ node.nodeStatus }}</span>
            </div>
            <div class="tl-row tl-row--split">
              <span>审核人：{{ node.operatorName }}</span>
              <span>审核时间：{{ node.time }}</span>
            </div>
            <div class="tl-row">
              审核结果：
              <span
                class="result"
                :class="node.result === 'passed' ? 'is-pass' : 'is-reject'"
              >
                {{ resultText(node.result) }}
              </span>
            </div>
            <div
              v-if="node.comment"
              class="comment-box"
            >
              {{ node.comment }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </ElDrawer>
</template>

<style scoped>
.drawer-sub {
  margin: -8px 0 16px;
  font-size: 13px;
  color: #333;
  word-break: break-all;
}
.mock-tip {
  margin-left: 6px;
  font-size: 12px;
  color: #999;
}
.timeline {
  padding: 4px 0 24px;
}
.tl-item {
  display: flex;
  gap: 12px;
  min-height: 72px;
}
.tl-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex: none;
}
.tl-icon {
  color: var(--color-primary);
  background: #fff;
  z-index: 1;
}
.tl-line {
  flex: 1;
  width: 0;
  margin: 4px 0;
  border-left: 1px dashed #d9d9d9;
  min-height: 24px;
}
.tl-card {
  flex: 1;
  min-width: 0;
  padding-bottom: 20px;
}
.tl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.dept-tag {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  font-size: 12px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  background: #fff;
}
.node-status {
  font-size: 12px;
  color: #999;
  flex: none;
}
.tl-row {
  font-size: 13px;
  color: #666;
  line-height: 1.7;
}
.tl-row--split {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}
.result.is-pass {
  color: #52c41a;
  font-weight: 500;
}
.result.is-reject {
  color: #f5222d;
  font-weight: 500;
}
.comment-box {
  margin-top: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  word-break: break-all;
}
</style>
