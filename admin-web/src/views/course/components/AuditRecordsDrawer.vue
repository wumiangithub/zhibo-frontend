<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDrawer, ElEmpty, ElIcon, ElImage } from "element-plus";
import { CircleCheckFilled } from "@element-plus/icons-vue";
import { ensureCourseSubmitAudit, listCourseAudits, type CourseAuditRecord } from "@/api/course";

const props = defineProps<{
  modelValue: boolean;
  courseId: string;
  title?: string;
  coverUrl?: string;
  createdTime?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
const rows = ref<CourseAuditRecord[]>([]);
const loading = ref(false);

watch(
  () => [props.modelValue, props.courseId] as const,
  async ([open]) => {
    if (!open || !props.courseId) return;
    loading.value = true;
    try {
      rows.value = ensureCourseSubmitAudit(
        (await listCourseAudits(props.courseId)).list ?? [],
        props.createdTime,
      );
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function isApply(row: CourseAuditRecord) {
  return row.action === "submit" || !row.result;
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    title="审核记录"
    direction="rtl"
    size="420px"
  >
    <p
      v-if="title"
      class="drawer-sub"
    >
      {{ title }}
    </p>
    <ElImage
      v-if="coverUrl"
      class="drawer-cover"
      :src="coverUrl"
      :preview-src-list="[coverUrl]"
      fit="cover"
      preview-teleported
    />
    <div
      v-loading="loading"
      class="timeline"
    >
      <div
        v-for="(node, idx) in rows"
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
            v-if="idx < rows.length - 1"
            class="tl-line"
          />
        </div>
        <div class="tl-card">
          <template v-if="isApply(node)">
            <div class="tl-head">
              <span class="dept-tag">发起申请</span>
            </div>
            <div class="tl-row">操作人：{{ node.operatorName }}</div>
            <div class="tl-row">操作时间：{{ node.createdTime }}</div>
          </template>
          <template v-else>
            <div class="tl-head">
              <span class="dept-tag">审核</span>
              <span class="node-status">审核完成</span>
            </div>
            <div class="tl-row">审核人：{{ node.operatorName }}</div>
            <div class="tl-row">审核时间：{{ node.createdTime }}</div>
            <div class="tl-row">
              审核结果：
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
        v-if="!loading && !rows.length"
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
  height: 90px;
  margin: -8px 0 16px;
  border-radius: 4px;
  overflow: hidden;
  cursor: zoom-in;
}
.timeline {
  min-height: 80px;
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
  z-index: 1;
  color: var(--color-primary);
  background: #fff;
}
.tl-line {
  flex: 1;
  width: 0;
  min-height: 24px;
  margin: 4px 0;
  border-left: 1px dashed #d9d9d9;
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
}
.node-status,
.tl-row {
  font-size: 13px;
  color: #666;
  line-height: 1.7;
}
.node-status {
  font-size: 12px;
  color: #999;
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
