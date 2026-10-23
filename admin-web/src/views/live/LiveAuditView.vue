<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ElButton,
  ElInput,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElTable,
  ElTableColumn,
} from "element-plus";
import {
  getActivity,
  listActivityAudits,
  RISK_STATUS_LABEL,
  SHELF_STATUS_LABEL,
  submitActivityAudit,
  type ActivityDetail,
  type ActivityId,
  type AuditRecord,
  type AuditResult,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/activity";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";

const route = useRoute();
const id = computed<ActivityId>(() => String(route.params.id));

const crumbs = computed<AppBreadcrumbItem[]>(() => [
  { label: "直播管理", to: "/live" },
  { label: "详情", to: `/live/${id.value}` },
  { label: "去审核" },
]);

const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const audits = ref<AuditRecord[]>([]);

const result = ref<AuditResult>("passed");
const reason = ref("");

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    const [d, a] = await Promise.all([getActivity(id.value), listActivityAudits(id.value)]);
    detail.value = d;
    audits.value = a.list ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    detail.value = null;
    audits.value = [];
  } finally {
    loading.value = false;
  }
}

/** 只拉审核记录，不切整页 loading */
async function loadAudits() {
  try {
    const a = await listActivityAudits(id.value);
    audits.value = a.list ?? [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "刷新审核记录失败");
  }
}

async function onSubmit() {
  const text = reason.value.trim();
  if (text.length > 200) {
    ElMessage.warning("说明不能超过 200 字");
    return;
  }
  if (result.value === "rejected" && !text) {
    ElMessage.warning("驳回时请填写理由");
    return;
  }
  submitting.value = true;
  try {
    // 契约：通过不传 reason；驳回必传
    const payload =
      result.value === "passed"
        ? { result: "passed" as const }
        : { result: "rejected" as const, reason: text };
    const data = await submitActivityAudit(id.value, payload);
    // 就地更新当前风控/上架，避免整页重载闪一下
    if (detail.value) {
      detail.value.riskStatus = data.riskStatus;
      detail.value.shelfStatus = data.shelfStatus;
    }
    ElMessage.success("提交成功");
    reason.value = "";
    // 保留当前「通过/驳回」选择，不强制切回通过
    await loadAudits();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    submitting.value = false;
  }
}

function resultLabel(r: AuditResult) {
  return r === "passed" ? "已通过" : "已驳回";
}

onMounted(loadAll);
watch(id, loadAll);
</script>

<template>
  <div class="live-audit">
    <AppBreadcrumb :items="crumbs" />

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
        <h2 class="card-title">审核</h2>
        <div class="meta">
          <div><span class="meta-label">直播名称</span>{{ detail.title }}</div>
          <div>
            <span class="meta-label">当前风控</span>
            {{
              RISK_STATUS_LABEL[(detail.riskStatus ?? "pending") as RiskStatus]
            }}
          </div>
          <div>
            <span class="meta-label">当前上架</span>
            {{
              SHELF_STATUS_LABEL[(detail.shelfStatus ?? "pending") as ShelfStatus]
            }}
          </div>
        </div>

        <div class="form-row">
          <span class="form-label">审核结果</span>
          <ElRadioGroup v-model="result">
            <ElRadio value="passed">通过</ElRadio>
            <ElRadio value="rejected">驳回</ElRadio>
          </ElRadioGroup>
        </div>
        <div class="form-row">
          <span class="form-label">理由</span>
          <ElInput
            v-model="reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            :placeholder="
              result === 'rejected' ? '驳回时必填（1～200 字）' : '选填，最多 200 字'
            "
            style="max-width: 480px"
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
        <h2 class="card-title">审核记录</h2>
        <ElTable
          :data="audits"
          empty-text="暂无记录"
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
            min-width="100"
          >
            <template #default="{ row }">
              {{ resultLabel(row.result) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="理由"
            min-width="200"
          >
            <template #default="{ row }">
              {{ row.result === "passed" ? "--" : row.reason || "--" }}
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.live-audit {
  max-width: 960px;
}
.status {
  font-size: 13px;
  color: #999;
}
.status.is-err {
  color: #cf1322;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.card-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #333;
}
.meta-label {
  display: inline-block;
  width: 72px;
  color: #999;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.form-label {
  flex: none;
  width: 72px;
  line-height: 32px;
  font-size: 13px;
  color: #666;
}
</style>
