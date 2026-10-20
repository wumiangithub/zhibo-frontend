<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  ElButton,
  ElImage,
  ElInput,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  ensureCourseSubmitAudit,
  getCourse,
  listCourseAudits,
  RISK_STATUS_LABEL,
  SHELF_STATUS_LABEL,
  submitCourseAudit,
  type AuditResult,
  type CourseAuditRecord,
  type CourseDetail,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/course";

const route = useRoute();
const id = computed(() => String(route.params.id));

const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const detail = ref<CourseDetail | null>(null);
const audits = ref<CourseAuditRecord[]>([]);
const result = ref<AuditResult>("passed");
const reason = ref("");

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    const [course, auditPage] = await Promise.all([getCourse(id.value), listCourseAudits(id.value)]);
    detail.value = course;
    audits.value = ensureCourseSubmitAudit(auditPage.list ?? [], course.createdTime);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    detail.value = null;
    audits.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadAudits() {
  try {
    const auditPage = await listCourseAudits(id.value);
    audits.value = ensureCourseSubmitAudit(auditPage.list ?? [], detail.value?.createdTime);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "刷新审核记录失败");
  }
}

async function onSubmit() {
  const text = reason.value.trim();
  if (result.value === "rejected" && (!text || text.length > 200)) {
    ElMessage.warning("驳回理由须为 1～100 字");
    return;
  }
  submitting.value = true;
  try {
    const payload = result.value === "passed" ? { result: "passed" as const } : { result: "rejected" as const, reason: text };
    const data = await submitCourseAudit(id.value, payload);
    if (detail.value) {
      detail.value.riskStatus = data.riskStatus;
      detail.value.shelfStatus = data.shelfStatus;
    }
    ElMessage.success("提交成功");
    reason.value = "";
    await loadAudits();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    submitting.value = false;
  }
}

function auditResult(row: { action?: string; result?: string }) {
  if (row.action === "submit" || !row.result) return "发起申请";
  return row.result === "passed" ? "已通过" : "已驳回";
}

onMounted(loadAll);
watch(id, loadAll);
</script>

<template>
  <div class="course-audit">
    <div class="crumb">
      <RouterLink
        to="/course"
        class="crumb-link"
      >
        课程管理
      </RouterLink>
      <span class="crumb-sep">/</span>
      <span>去审核</span>
    </div>
    <p
      v-if="loading"
      class="status"
    >
      加载中…
    </p>
    <p
      v-else-if="error && !detail"
      class="status is-err"
    >
      {{ error }}
    </p>
    <template v-else-if="detail">
      <div class="card">
        <h2>审核</h2>
        <div class="meta">
          <div><span class="meta-label">课程名称</span>{{ detail.title }}</div>
          <div v-if="detail.coverUrl">
            <span class="meta-label">课程封面</span>
            <ElImage
              class="cover"
              :src="detail.coverUrl"
              :preview-src-list="[detail.coverUrl]"
              fit="cover"
              preview-teleported
            />
          </div>
          <div>
            <span class="meta-label">当前风控</span>
            {{ RISK_STATUS_LABEL[detail.riskStatus as RiskStatus] ?? detail.riskStatus }}
          </div>
          <div>
            <span class="meta-label">当前上架</span>
            {{ SHELF_STATUS_LABEL[detail.shelfStatus as ShelfStatus] ?? detail.shelfStatus }}
          </div>
        </div>
        <div class="form-row">
          <span class="meta-label">审核结果</span>
          <ElRadioGroup v-model="result">
            <ElRadio value="passed">通过</ElRadio>
            <ElRadio value="rejected">驳回</ElRadio>
          </ElRadioGroup>
        </div>
        <div
          v-if="result === 'rejected'"
          class="form-row"
        >
          <span class="meta-label">理由</span>
          <ElInput
            v-model="reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="驳回时必填（1～200 字）"
          />
        </div>
        <ElButton
          type="primary"
          :loading="submitting"
          @click="onSubmit"
        >
          提交
        </ElButton>
      </div>
      <div class="card">
        <h2>审核记录</h2>
        <ElTable
          :data="audits"
          empty-text="暂无审核记录"
        >
          <ElTableColumn
            prop="createdTime"
            label="时间"
            min-width="170"
          />
          <ElTableColumn
            prop="operatorName"
            label="审核人"
            min-width="120"
          />
          <ElTableColumn
            label="结果"
            min-width="120"
          >
            <template #default="{ row }">
              {{ auditResult(row) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="理由"
            min-width="200"
          >
            <template #default="{ row }">
              {{ row.reason || "--" }}
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.crumb {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}
.crumb-link {
  color: var(--color-primary);
  text-decoration: none;
}
.crumb-sep {
  margin: 0 6px;
  color: #ccc;
}
.status {
  color: #999;
}
.status.is-err {
  color: #cf1322;
}
.card {
  margin-bottom: 16px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 8px;
}
.card h2 {
  margin: 0 0 16px;
  font-size: 16px;
}
.meta,
.form-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.form-row {
  flex-direction: row;
  align-items: flex-start;
}
.meta-label {
  display: inline-block;
  width: 72px;
  margin-right: 12px;
  color: #666;
}
.cover {
  width: 120px;
  height: 68px;
  vertical-align: top;
  border-radius: 4px;
}
</style>
