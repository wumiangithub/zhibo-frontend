<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  deleteLiveReport,
  getLiveReport,
  REPORT_STATUS_LABEL,
  type LiveReport,
  type ReportAttachment,
} from "@/api/liveReport";
import { ElMessage, ElMessageBox } from "element-plus";
import { getMaterialFileIcon } from "@/views/settings/materials/materialFileIcons";
import { previewDocument } from "@/utils/documentPreview";
import { downloadFiles } from "@/utils/downloadFile";
import AppBreadcrumb, { type AppBreadcrumbItem } from "@/components/ui/AppBreadcrumb.vue";
import UiButton from "@/components/ui/UiButton.vue";
import ReportAuditDrawer from "./ReportAuditDrawer.vue";

const route = useRoute();
const router = useRouter();
const data = ref<LiveReport>();
const loading = ref(false);
const error = ref("");
const audits = ref(route.query.audits === "1");

const crumbs: AppBreadcrumbItem[] = [
  { label: "直播", to: "/live" },
  { label: "直播报备", to: "/live-reports" },
  { label: "查看详情" },
];

async function load() {
  loading.value = true;
  try {
    data.value = await getLiveReport(String(route.params.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function downloadAttachment(f: ReportAttachment) {
  const res = await downloadFiles([{ fileUrl: f.url, fileName: f.name }], { useLink: true });
  if (!res.success) ElMessage.error("下载失败");
}

async function onDelete() {
  if (!data.value) return;
  try {
    await ElMessageBox.confirm("删除后不可恢复", "删除报备", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteLiveReport(data.value.id);
    ElMessage.success("已删除");
    void router.push("/live-reports");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <AppBreadcrumb :items="crumbs" />
    <div v-loading="loading" class="card">
      <p v-if="error" class="err">{{ error }}</p>
      <template v-if="data">
        <header>
          <h2>{{ data.title }}</h2>
          <span :class="data.status">{{ REPORT_STATUS_LABEL[data.status] }}</span>
          <div>
            <UiButton
              v-if="data.status === 'pending' || data.status === 'passed' || data.status === 'rejected'"
              variant="primary"
              @click="router.push(`/live-reports/audit/${data.id}`)"
            >
              去审核
            </UiButton>
            <UiButton
              v-if="data.status === 'rejected' || (data.status === 'passed' && !data.boundLiveCount)"
              @click="router.push(`/live-reports/edit/${data.id}`)"
            >
              编辑
            </UiButton>
            <UiButton @click="audits = true">审核记录</UiButton>
            <UiButton @click="onDelete">删除</UiButton>
          </div>
        </header>
        <dl>
          <dt>报备直播名称</dt>
          <dd>{{ data.title }}</dd>
          <dt>直播报备内容</dt>
          <dd>{{ data.content }}</dd>
          <dt>计划时间</dt>
          <dd>
            <p v-for="(x, i) in data.planTimes" :key="i">{{ x.startTime }} 至 {{ x.endTime }}</p>
          </dd>
          <dt>报备直播封面</dt>
          <dd><img class="cover" :src="data.coverUrl" alt="" /></dd>
          <dt>主播</dt>
          <dd>{{ data.host.userName }}</dd>
          <dt>直播报备材料</dt>
          <dd>
            <div v-for="f in data.attachments" :key="f.objectKey" class="file">
              <img :src="getMaterialFileIcon(f.name)" class="file-icon" alt="" />
              <b>{{ f.name }}</b>
              <span>{{ (f.fileSize / 1024 / 1024).toFixed(2) }}MB</span>
              <button type="button" @click="previewDocument()">预览</button>
              <button type="button" @click="downloadAttachment(f)">下载</button>
            </div>
          </dd>
        </dl>
        <footer>
          <span>提交人 {{ data.submitterName }}</span>
          <span>所属部门 {{ data.departmentName || "--" }}</span>
          <span>提交时间 {{ data.submittedTime }}</span>
        </footer>
        <ReportAuditDrawer
          v-model="audits"
          :report-id="data.id"
          :title="data.title"
          :cover-url="data.coverUrl"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-width: 800px;
}
.card {
  background: #fff;
  border-radius: 6px;
  min-height: 500px;
  padding: 18px 24px;
}
.err {
  color: var(--color-danger);
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #eee;
  padding-bottom: 16px;
}
header h2 {
  margin: 0;
  font-size: 17px;
}
header > div {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
header > span {
  padding: 2px 7px;
  background: #f5f5f5;
}
.passed {
  color: #389e0d;
  background: #f6ffed;
}
.rejected {
  color: #cf1322;
  background: #fff1f0;
}
dl {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 20px 16px;
  padding: 12px 0;
}
dt {
  text-align: right;
  color: #666;
  font-size: 13px;
}
dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
dd p {
  margin: 0 0 5px;
}
.cover {
  width: 160px;
  height: 100px;
  object-fit: cover;
}
.file {
  display: grid;
  grid-template-columns: 28px minmax(180px, 300px) 70px auto auto;
  align-items: center;
  gap: 10px;
  background: #f7f8fa;
  padding: 10px 12px;
  width: max-content;
  min-width: 470px;
}
.file-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.file a,
.file button {
  border: 0;
  background: none;
  padding: 0;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
  font-size: 13px;
}
footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #eee;
  padding: 18px;
  color: #666;
  font-size: 12px;
}
</style>
