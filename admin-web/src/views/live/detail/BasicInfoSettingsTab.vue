<script setup lang="ts">
import { computed, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  updateActivity,
  type ActivityDetail,
  type ActivityId,
  type LiveProvider,
  type UpdateActivityPayload,
} from "@/api/activity";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { useLiveForm, type LiveMode } from "../composables/useLiveForm";
import BasicInfoSection from "../sections/BasicInfoSection.vue";
import ProviderModeSection from "../sections/ProviderModeSection.vue";
import RelatedBusinessSection from "../sections/RelatedBusinessSection.vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const { form, submitting } = useLiveForm();
const leave = useLeaveConfirm({ routeLeave: false });

/** 待审核或未写风控状态时，基本信息不可改。 */
const auditLocked = computed(() => {
  const status = props.detail.riskStatus;
  return !status || status === "pending";
});

const TYPE_TO_MODE: Record<number, LiveMode> = {
  1: "voice",
  2: "video",
  3: "interactive",
  4: "recorded",
};

function applyDetail(d: ActivityDetail) {
  form.provider = (d.provider as LiveProvider) || "vhall";
  form.name = d.title;
  form.intro = d.introduction ?? "";
  form.mode = TYPE_TO_MODE[d.type] ?? "video";
  form.viewerStyle = d.viewerStyle === "immersive" ? "immersive" : "traditional";
  form.ultraLowLatency = d.ultraLowLatency ?? true;
  const [datePart, timePart] = (d.startTime || "").split(" ");
  form.startDate = datePart ?? "";
  form.startTime = timePart ? timePart.slice(0, 5) : "";
  if (d.endTime && !d.endTime.startsWith("0000")) {
    const [ed, et] = d.endTime.split(" ");
    form.endDate = ed ?? "";
    form.endTime = et ? et.slice(0, 5) : "";
  } else {
    form.endDate = "";
    form.endTime = "";
  }
  form.detailCover = d.coverUrl ?? "";
  form.detailHtml = d.detailHtml ?? "";
  // UI 单选：后端若返回多人，只取第一人回显
  form.hostIds = (d.hosts ?? []).map((h) => String(h.id)).slice(0, 1);
  form.ownerIds = (d.owners ?? []).map((o) => String(o.id));
  form.products = (d.products ?? []).map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName,
  }));
  form.coursewares = (d.coursewares ?? []).map((c) => ({ ...c }));
  form.coursewareMaterialIds = form.coursewares.map((c) => c.id);
  form.autoList = d.autoList ?? false;
  form.agreed = true;
  // 录播素材回显；替换视频保存时传 recordMaterialId → ready 可能变 0
  if (d.type === 4 && d.recordMaterialId) {
    form.materialId = d.recordMaterialId;
    form.recordId = null;
    form.recordSource = "video";
    form.recordLabel = form.recordLabel || "已选素材";
  } else {
    form.materialId = "";
    form.recordId = null;
    form.recordSource = "";
    form.recordLabel = "";
  }
}

watch(
  () => props.detail,
  (d) => {
    applyDetail(d);
    leave.markClean();
  },
  { immediate: true },
);

function validateBasic(): string | null {
  if (!form.name.trim()) return "请填写直播名称";
  if (form.name.trim().length > 64) return "直播名称不能超过 64 字";
  if (form.intro.trim().length > 256) return "直播简介不能超过 256 字";
  if (!form.startDate || !form.startTime) return "请选择开始时间";
  if ((form.endDate && !form.endTime) || (!form.endDate && form.endTime)) {
    return "结束时间须完整填写日期与时间";
  }
  const startAt = new Date(`${form.startDate} ${form.startTime}:00`).getTime();
  if (Number.isNaN(startAt)) return "开始时间无效";
  if (startAt < Date.now() + 2 * 60 * 1000) {
    return "开始时间须晚于当前时间至少 2 分钟";
  }
  if (form.endDate && form.endTime) {
    const endAt = new Date(`${form.endDate} ${form.endTime}:00`).getTime();
    if (endAt <= startAt) return "结束时间必须大于开始时间";
  }
  if (!form.hostIds.length) return "请选择主播";
  if (form.ownerIds.length > 20) return "归属人最多 20 人";
  if (form.products.length > 20) return "关联商品最多 20 个";
  if (form.coursewareMaterialIds.length > 100) return "课件资料最多 100 个";
  return null;
}

function sameIdList(a: Array<string | number>, b: Array<string | number>): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => String(id) === String(b[i]));
}

function sameProducts(
  a: Array<{ spuId: string; productName: string }>,
  b: Array<{ spuId: string; productName: string }>,
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (p, i) =>
      String(p.spuId) === String(b[i].spuId)
      && p.productName.trim() === b[i].productName.trim(),
  );
}

/** 相对详情快照：其它字段是否未改、关联商品是否未改 */
function diffAgainstDetail(): { otherSame: boolean; productsSame: boolean } {
  const d = props.detail;
  const title = form.name.trim();
  const startTime = `${form.startDate} ${form.startTime}:00`;
  const intro = form.intro.trim();
  const endTime =
    form.endDate && form.endTime ? `${form.endDate} ${form.endTime}:00` : "";
  const detailEnd =
    d.endTime && !d.endTime.startsWith("0000") ? d.endTime : "";
  const cover = form.detailCover || "";
  const html = form.detailHtml?.trim() || "";
  const hostIds = form.hostIds.slice(0, 1);
  const ownerIds = [...form.ownerIds];
  const courseIds = [...form.coursewareMaterialIds];
  const products = form.products.map((p) => ({
    spuId: String(p.spuId),
    productName: p.productName.trim(),
  }));

  const otherSame =
    title === (d.title ?? "").trim()
    && startTime === (d.startTime || "")
    && intro === (d.introduction ?? "").trim()
    && endTime === detailEnd
    && cover === (d.coverUrl ?? "")
    && html === (d.detailHtml ?? "").trim()
    && form.autoList === (d.autoList ?? false)
    && sameIdList(hostIds, (d.hosts ?? []).map((h) => h.id).slice(0, 1))
    && sameIdList(ownerIds, (d.owners ?? []).map((o) => o.id))
    && sameIdList(courseIds, (d.coursewares ?? []).map((c) => c.id))
    && !(
      d.type === 4
      && form.recordSource === "video"
      && form.materialId.trim()
      && form.materialId.trim() !== (d.recordMaterialId ?? "")
    );

  const productsSame = sameProducts(
    products,
    (d.products ?? []).map((p) => ({
      spuId: String(p.spuId),
      productName: p.productName,
    })),
  );
  return { otherSame, productsSame };
}

/** 当前值相对详情基线是否有差异（改完又改回不算脏） */
const hasEdits = computed(() => {
  const { otherSame, productsSame } = diffAgainstDetail();
  return !(otherSame && productsSame);
});

/** 未改动 / 审核锁时保存不高亮、不可点 */
const canSave = computed(() => hasEdits.value && !auditLocked.value);

// 同步 leave.dirty，供 beforeunload / confirmLeave 与值对比一致
watch(
  hasEdits,
  (v) => {
    if (v) leave.markDirty();
    else leave.markClean();
  },
  { flush: "sync" },
);

async function onSave() {
  if (auditLocked.value) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
  const err = validateBasic();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  if (!hasEdits.value) {
    ElMessage.info("没有修改");
    return;
  }
  const { otherSame, productsSame } = diffAgainstDetail();
  // 仅改关联商品：只传 products，后端不回 pending、不追加发起申请
  const productsOnly = otherSame && !productsSame;
  submitting.value = true;
  try {
    const products = form.products.map((p) => ({
      spuId: String(p.spuId),
      productName: p.productName.trim(),
    }));
    let payload: UpdateActivityPayload;
    if (productsOnly) {
      payload = { products };
    } else {
      payload = {
        title: form.name.trim(),
        startTime: `${form.startDate} ${form.startTime}:00`,
        introduction: form.intro.trim() || undefined,
        coverUrl: form.detailCover || undefined,
        detailHtml: form.detailHtml?.trim() || undefined,
        autoList: form.autoList,
        hostIds: form.hostIds.slice(0, 1).map((id) => Number(id)),
        ownerIds: form.ownerIds.map((id) => Number(id)),
        products,
        coursewareMaterialIds: [...form.coursewareMaterialIds],
      };
      if (form.endDate && form.endTime) {
        payload.endTime = `${form.endDate} ${form.endTime}:00`;
      }
      // 录播替换素材：与详情原 recordMaterialId 不同才传
      if (
        props.detail.type === 4
        && form.recordSource === "video"
        && form.materialId.trim()
        && form.materialId.trim() !== (props.detail.recordMaterialId ?? "")
      ) {
        payload.recordMaterialId = form.materialId.trim();
      }
    }
    await updateActivity(props.activityId, payload);
    ElMessage.success(productsOnly ? "保存成功" : "保存成功，重新进入审核");
    leave.markClean();
    emit("refreshed");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    submitting.value = false;
  }
}

defineExpose({
  isDirty: () => hasEdits.value,
  confirmLeave: leave.confirmLeave,
});
</script>

<template>
  <div class="tab-panel">
    <p
      v-if="auditLocked"
      class="lock-tip"
    >
      审核中不可编辑
    </p>
    <div :class="{ 'is-locked': auditLocked }">
      <BasicInfoSection :form="form" />
      <ProviderModeSection
        :form="form"
        provider-readonly
        mode-readonly
        viewer-style-readonly
      />
      <RelatedBusinessSection
        :form="form"
        :known-hosts="detail.hosts"
        :known-owners="detail.owners"
        :host-locked="!!detail.reportId"
      />
    </div>

    <div class="save-bar">
      <UiButton
        :variant="canSave ? 'primary' : 'default'"
        :disabled="!canSave || submitting"
        @click="onSave"
      >
        {{ submitting ? "保存中…" : "保存" }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* 给固定底栏留空，避免最后一项被挡住 */
  padding-bottom: 88px;
}
.lock-tip {
  margin: 0 0 8px;
  color: var(--color-danger, #f56c6c);
  font-size: 13px;
}

.is-locked {
  pointer-events: none;
  opacity: 0.72;
}

/* 与新建页 live-create__footer 同款：贴视口底，避开左侧 176px 导航 */
.save-bar {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  padding: 0 32px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
