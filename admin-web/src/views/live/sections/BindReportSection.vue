<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Check } from "@element-plus/icons-vue";
import { ElIcon, ElMessage, ElOption, ElSelect } from "element-plus";
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
  if (report.host?.id != null) {
    // 与 LiveFormState.hostIds（string[]）及提交 number[] 对齐：表单内存字符串 id
    form.hostIds = [String(report.host.id)];
    form.reportHost = {
      id: report.host.id,
      userName: (report.host.userName ?? "").trim() || String(report.host.id),
      avatar: report.host.avatar,
      departmentName: report.host.departmentName?.trim() || undefined,
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

/** 选中后输入框只展示报备标题，不展示报备 ID / 主播 */
function optionLabel(row: LiveReport) {
  return row.title?.trim() || row.id;
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
      fit-input-width
      :remote-method="loadPassed"
      :loading="loading"
      placeholder="请选择已通过的直播报备"
      style="width: 680px"
      popper-class="bind-report-select-popper"
      @update:model-value="onChange"
      @visible-change="(open: boolean) => open && loadPassed()"
    >
      <ElOption
        v-for="row in options"
        :key="row.id"
        :label="optionLabel(row)"
        :value="row.id"
      >
        <div class="report-opt">
          <span class="report-opt__id">【报备ID：{{ row.id }}】</span>
          <span class="report-opt__title">{{ row.title }}</span>
          <ElIcon
            v-if="form.reportId === row.id"
            class="report-opt__check"
          >
            <Check />
          </ElIcon>
        </div>
      </ElOption>
    </ElSelect>
  </FormRow>
</template>

<!-- popper 挂到 body，样式必须非 scoped -->
<style>
.bind-report-select-popper.el-select__popper,
.bind-report-select-popper {
  width: 680px !important;
  min-width: 680px !important;
  max-width: none !important;
}
.bind-report-select-popper .el-select-dropdown__item {
  height: 34px;
  line-height: 34px;
  padding-top: 0;
  padding-bottom: 0;
}
.bind-report-select-popper .report-opt {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.bind-report-select-popper .report-opt__id {
  flex: none;
  box-sizing: border-box;
  /* 【报备ID：】+ 36 位 UUID + 】，固定宽便于右侧标题竖向对齐 */
  width: 340px;
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.bind-report-select-popper .report-opt__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bind-report-select-popper .report-opt__check {
  flex: none;
  margin-left: 8px;
  font-size: 14px;
  color: var(--color-primary, #409eff);
}
.bind-report-select-popper .el-select-dropdown__item.is-selected .report-opt__title {
  color: var(--color-primary, #409eff);
  font-weight: 500;
}
</style>
