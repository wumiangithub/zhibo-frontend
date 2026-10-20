<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElOption, ElSelect } from "element-plus";
import { getLiveReport, listLiveReports, type LiveReport } from "@/api/liveReport";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const form = props.form;
const markDirty = useMarkDirty();

const loading = ref(false);
const options = ref<LiveReport[]>([]);

function splitDateTime(value: string | undefined): { date: string; time: string } | null {
  if (!value) return null;
  const matched = value.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::\d{2})?$/);
  if (!matched) return null;
  return { date: matched[1], time: matched[2] };
}

function applyReport(report: LiveReport) {
  form.reportId = report.id;
  form.name = (report.title ?? "").trim().slice(0, 64);
  form.intro = (report.content ?? "").trim().slice(0, 256);
  const first = report.planTimes?.[0];
  const start = splitDateTime(first?.startTime);
  const end = splitDateTime(first?.endTime);
  form.startDate = start?.date ?? "";
  form.startTime = start?.time ?? "";
  form.endDate = end?.date ?? "";
  form.endTime = end?.time ?? "";
  form.detailCover = report.coverUrl?.trim() || "";
  if (report.host?.id) {
    form.hostIds = [report.host.id];
    form.reportHost = {
      id: report.host.id,
      userName: report.host.userName,
      avatar: report.host.avatar,
    };
  } else {
    form.hostIds = [];
    form.reportHost = null;
  }
  markDirty();
}

function clearReport() {
  if (!form.reportId && !form.hostIds.length) return;
  form.reportId = "";
  form.reportHost = null;
  form.hostIds = [];
  markDirty();
}

function optionLabel(row: LiveReport) {
  const host = row.host?.userName?.trim();
  return host ? `${row.title} / ${host}` : row.title;
}

async function loadPassed(keyword?: string) {
  loading.value = true;
  try {
    const data = await listLiveReports({
      page: 1,
      pageSize: 50,
      status: "passed",
      title: keyword?.trim() || undefined,
    });
    const list = data.list ?? [];
    if (form.reportId && !list.some((row) => row.id === form.reportId)) {
      const current = options.value.find((row) => row.id === form.reportId);
      options.value = current ? [current, ...list] : list;
    } else {
      options.value = list;
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载直播报备失败");
    options.value = [];
  } finally {
    loading.value = false;
  }
}

async function onChange(id: string | null | undefined) {
  const next = id ? String(id) : "";
  if (!next) {
    clearReport();
    return;
  }
  if (next === form.reportId && form.hostIds.length) return;
  let report = options.value.find((row) => row.id === next);
  if (!report?.host?.id || !report.planTimes?.length) {
    try {
      report = await getLiveReport(next);
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "加载报备详情失败");
      return;
    }
  }
  if (report.status && report.status !== "passed") {
    ElMessage.warning("只能绑定已通过的直播报备");
    return;
  }
  applyReport(report);
}

onMounted(() => {
  void loadPassed();
});
</script>

<template>
  <FormRow
    label="绑定直播报备:"
    required
    info="仅可选已通过报备；选中后回填名称、简介、计划时间、封面和主播。主播不可手选。"
  >
    <ElSelect
      :model-value="form.reportId || undefined"
      filterable
      remote
      clearable
      :remote-method="loadPassed"
      :loading="loading"
      placeholder="请选择已通过的直播报备"
      style="width: 360px"
      @update:model-value="onChange"
      @visible-change="(open: boolean) => open && loadPassed()"
    >
      <ElOption
        v-for="row in options"
        :key="row.id"
        :label="optionLabel(row)"
        :value="row.id"
      />
    </ElSelect>
  </FormRow>
</template>
