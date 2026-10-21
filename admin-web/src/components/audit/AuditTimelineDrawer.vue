<script setup lang="ts">
import { computed, ref } from "vue";
import { ElDrawer, ElEmpty, ElIcon } from "element-plus";
import { CircleCheckFilled } from "@element-plus/icons-vue";
import ImagePreview from "@/components/ImagePreview.vue";
import type { ImagePreviewItem } from "@/components/ImagePreview.vue";
import AuditActorTag from "./AuditActorTag.vue";
import {
  resolveAuditActorTag,
  type AuditActorChannel,
} from "./resolveAuditActorTag";

/** 审核记录时间线条目：各业务映射后传入，抽屉只负责展示。 */
export interface AuditTimelineNode {
  id: string;
  /** apply：发起/提交类；audit：有结论的审核 */
  variant: "apply" | "audit";
  /**
   * 左侧标签。apply 传「发起申请」等；audit 可省略，由 channel/部门/姓名推导。
   */
  tag?: string;
  /** 素材 AI / 风控；人工审不传 */
  channel?: AuditActorChannel | null;
  departmentName?: string | null;
  operatorName: string;
  createdTime: string;
  result?: "passed" | "rejected" | null;
  reason?: string | null;
  /** 默认 apply→操作人，audit→审核人 */
  operatorLabel?: string;
}

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  coverUrl?: string;
  loading?: boolean;
  nodes: AuditTimelineNode[];
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const coverPreview = ref(false);
const coverPreviewItems = computed<ImagePreviewItem[]>(() =>
  props.coverUrl ? [{ url: props.coverUrl, name: props.title || "封面" }] : [],
);

function operatorLabel(node: AuditTimelineNode) {
  return node.operatorLabel ?? (node.variant === "apply" ? "操作人" : "审核人");
}

function actorTag(node: AuditTimelineNode) {
  if (node.tag?.trim()) return node.tag.trim();
  return resolveAuditActorTag({
    channel: node.channel,
    departmentName: node.departmentName,
  });
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
    </p>
    <button
      v-if="coverUrl"
      type="button"
      class="drawer-cover"
      @click="coverPreview = true"
    >
      <img :src="coverUrl" alt="" />
    </button>
    <ImagePreview v-model="coverPreview" :items="coverPreviewItems" />

    <div
      v-loading="loading"
      class="timeline"
    >
      <div
        v-for="(node, idx) in nodes"
        :key="node.id"
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
          <template v-if="node.variant === 'apply'">
            <div class="tl-head">
              <AuditActorTag :text="actorTag(node)" />
            </div>
            <div class="tl-row">
              <span>{{ operatorLabel(node) }}：{{ node.operatorName }}</span>
            </div>
            <div class="tl-row">
              <span>操作时间：{{ node.createdTime }}</span>
            </div>
            <div
              v-if="node.reason"
              class="comment-box"
            >
              {{ node.reason }}
            </div>
          </template>

          <template v-else>
            <div class="tl-head">
              <AuditActorTag :text="actorTag(node)" />
              <span class="node-status">审核完成</span>
            </div>
            <div class="tl-row tl-row--split">
              <span>{{ operatorLabel(node) }}：{{ node.operatorName }}</span>
              <span>审核时间：{{ node.createdTime }}</span>
            </div>
            <div class="tl-row">
              <span
                class="result"
                :class="node.result === 'passed' ? 'is-pass' : 'is-reject'"
              >
                {{ node.result === "passed" ? "审核通过" : "审核驳回" }}
              </span>
            </div>
            <div
              v-if="node.reason"
              class="comment-box"
            >
              {{ node.reason }}
            </div>
          </template>
        </div>
      </div>
      <ElEmpty
        v-if="!loading && !nodes.length"
        description="暂无审核记录"
      />
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
.drawer-cover {
  display: block;
  width: 160px;
  height: 100px;
  margin: -8px 0 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  cursor: zoom-in;
  background: transparent;
}
.drawer-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.timeline {
  padding: 4px 0 24px;
  min-height: 80px;
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
