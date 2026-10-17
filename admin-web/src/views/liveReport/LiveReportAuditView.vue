<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ElButton, ElInput, ElMessage, ElRadio, ElRadioGroup, ElTable, ElTableColumn } from "element-plus";
import { auditLiveReport, getLiveReport, listLiveReportAudits, REPORT_STATUS_LABEL, type LiveReport, type ReportAudit } from "@/api/liveReport";

const route = useRoute();
const id = computed(() => String(route.params.id));
const loading = ref(true), submitting = ref(false), error = ref("");
const detail = ref<LiveReport | null>(null), audits = ref<ReportAudit[]>([]);
const result = ref<"passed" | "rejected">("passed"), reason = ref("");

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    const [report, history] = await Promise.all([getLiveReport(id.value), listLiveReportAudits(id.value)]);
    detail.value = report;
    audits.value = history.list ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function submitAudit() {
  const text = reason.value.trim();
  if (text.length > 500) { ElMessage.warning("理由不能超过 500 字"); return; }
  if (result.value === "rejected" && !text) { ElMessage.warning("驳回时请填写理由"); return; }
  submitting.value = true;
  try {
    const updated = await auditLiveReport(id.value, result.value, result.value === "rejected" ? text : undefined);
    if (detail.value) detail.value.status = updated.status;
    audits.value = (await listLiveReportAudits(id.value)).list ?? [];
    reason.value = "";
    ElMessage.success("提交成功");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    submitting.value = false;
  }
}

function auditResult(row: ReportAudit) {
  if (row.action === "submit") return "发起申请";
  if (row.action === "resubmit") return "重新提交";
  return row.result === "passed" ? "已通过" : "已驳回";
}

onMounted(loadAll);
</script>

<template>
  <div class="report-audit">
    <div class="crumb">
      <RouterLink to="/live-reports">直播报备</RouterLink><span>/</span>
      <RouterLink :to="`/live-reports/${id}`">详情</RouterLink><span>/</span><span>去审核</span>
    </div>
    <p v-if="loading" class="status-text">加载中...</p>
    <p v-else-if="error && !detail" class="status-text is-error">{{ error }}</p>
    <template v-else-if="detail">
      <div class="card">
        <h2>审核</h2>
        <div class="meta">
          <div><span>报备名称</span>{{ detail.title }}</div>
          <div><span>当前审核</span>{{ REPORT_STATUS_LABEL[detail.status] }}</div>
          <div><span>当前绑定</span>{{ detail.boundLiveCount > 0 ? `已绑定 ${detail.boundLiveCount} 场直播` : "未绑定直播" }}</div>
        </div>
        <div class="form-row"><span class="form-label">审核结果</span><ElRadioGroup v-model="result" :disabled="detail.status !== 'pending'"><ElRadio value="passed">通过</ElRadio><ElRadio value="rejected">驳回</ElRadio></ElRadioGroup></div>
        <div class="form-row"><span class="form-label">理由</span><ElInput v-model="reason" type="textarea" :rows="3" maxlength="500" show-word-limit :disabled="detail.status !== 'pending'" :placeholder="result === 'rejected' ? '驳回时必填（1～500 字）' : '选填，最多 500 字'" /></div>
        <ElButton type="primary" :loading="submitting" :disabled="detail.status !== 'pending'" @click="submitAudit">提交</ElButton>
      </div>
      <div class="card">
        <h2>审核记录</h2>
        <ElTable :data="audits" empty-text="暂无记录">
          <ElTableColumn prop="createdAt" label="时间" min-width="170" />
          <ElTableColumn prop="operatorName" label="审核人" min-width="120" />
          <ElTableColumn label="结果" min-width="100"><template #default="{ row }">{{ auditResult(row) }}</template></ElTableColumn>
          <ElTableColumn label="理由" min-width="200"><template #default="{ row }">{{ row.reason || "--" }}</template></ElTableColumn>
        </ElTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report-audit{max-width:960px}.crumb{display:flex;align-items:center;gap:6px;margin-bottom:16px;font-size:13px;color:#999}.crumb a{color:var(--color-primary);text-decoration:none}.crumb a:hover{text-decoration:underline}.crumb span:not(:last-child){color:#d9d9d9}.status-text{font-size:13px;color:#999}.status-text.is-error{color:var(--color-danger)}.card{background:#fff;border-radius:8px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.card h2{margin:0 0 16px;font-size:16px;font-weight:600;color:#1a1a1a}.meta{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;font-size:13px;color:#333}.meta span{display:inline-block;width:72px;color:#999}.form-row{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}.form-label{flex:none;width:72px;line-height:32px;font-size:13px;color:#666}.form-row .el-textarea{max-width:480px}
</style>
