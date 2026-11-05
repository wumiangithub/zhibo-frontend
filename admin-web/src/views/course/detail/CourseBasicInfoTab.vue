<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { EmployeeItem } from "@/api/activity";
import {
  CourseMaterialAccess,
  updateCourse,
  type CourseDetail,
  type CourseMaterialAccessPermission,
} from "@/api/course";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import UiButton from "@/components/ui/UiButton.vue";
import CourseBasicForm from "../components/CourseBasicForm.vue";
import {
  createEmptyCourseForm,
  validateCourseBasicForm,
} from "../composables/useCourseForm";

const props = defineProps<{
  courseId: string;
  detail: CourseDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const form = createEmptyCourseForm();
const formRef = ref<InstanceType<typeof CourseBasicForm> | null>(null);
const leave = useLeaveConfirm({ routeLeave: false });
const submitting = ref(false);
const knownOwners = ref<EmployeeItem[]>([]);

function applyDetail(d: CourseDetail) {
  form.name = d.title ?? "";
  form.intro = d.introduction ?? "";
  form.detailHtml = d.detailHtml ?? "";
  form.coverMaterialId = d.coverMaterialId ?? "";
  form.coverUrl = d.coverUrl ?? "";
  form.listed = d.shelfStatus === "on";
  form.ownerIds = (d.owners ?? []).map((o) => Number(o.id)).filter((id) => id > 0);
  knownOwners.value = (d.owners ?? []).map((o) => ({
    id: Number(o.id),
    userName: o.userName,
    avatar: o.avatar,
  }));
  form.coursewares = (d.materials ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    url: m.url ?? "",
    fileSize: m.fileSize,
    mimeType: m.mimeType,
    accessPermission: m.accessPermission,
  }));
  form.coursewareMaterialIds = form.coursewares.map((c) => c.id);
}

function sameIdList(a: Array<string | number>, b: Array<string | number>): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => String(id) === String(b[i]));
}

function sameMaterials(
  a: Array<{ id: string; accessPermission?: number }>,
  b: Array<{ id: string; accessPermission?: number }>,
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.id === b[i].id
      && (row.accessPermission ?? CourseMaterialAccess.PREVIEW_DOWNLOAD)
        === (b[i].accessPermission ?? CourseMaterialAccess.PREVIEW_DOWNLOAD),
  );
}

const hasEdits = computed(() => {
  const d = props.detail;
  const detailHtml = (form.detailHtml?.trim() || "") === "<p><br></p>"
    ? ""
    : (form.detailHtml?.trim() || "");
  const baseHtml = (d.detailHtml ?? "").trim();
  return !(
    form.name.trim() === (d.title ?? "").trim()
    && form.intro.trim() === (d.introduction ?? "").trim()
    && detailHtml === baseHtml
    && form.coverMaterialId === (d.coverMaterialId ?? "")
    && form.listed === (d.shelfStatus === "on")
    && sameIdList(form.ownerIds, (d.owners ?? []).map((o) => o.id))
    && sameMaterials(
      form.coursewares.map((c) => ({
        id: c.id,
        accessPermission: c.accessPermission,
      })),
      (d.materials ?? []).map((m) => ({
        id: m.id,
        accessPermission: m.accessPermission,
      })),
    )
  );
});

const canSave = computed(() => hasEdits.value);

watch(
  () => props.detail,
  (d) => {
    applyDetail(d);
    leave.markClean();
  },
  { immediate: true },
);

watch(
  hasEdits,
  (v) => {
    if (v) leave.markDirty();
    else leave.markClean();
  },
  { flush: "sync" },
);

async function onSave() {
  const err = validateCourseBasicForm(form);
  if (err) {
    if (!form.name.trim()) formRef.value?.onNameBlur();
    ElMessage.warning(err);
    return;
  }
  if (!hasEdits.value) {
    ElMessage.info("没有修改");
    return;
  }
  submitting.value = true;
  try {
    const intro = form.intro.trim();
    const detail = form.detailHtml.trim();
    await updateCourse(props.courseId, {
      title: form.name.trim(),
      coverMaterialId: form.coverMaterialId,
      listed: form.listed,
      ownerIds: [...form.ownerIds],
      introduction: intro || undefined,
      detailHtml: detail && detail !== "<p><br></p>" ? detail : undefined,
      materials: form.coursewares.map((row) => ({
        id: row.id,
        accessPermission: (row.accessPermission
          ?? CourseMaterialAccess.PREVIEW_DOWNLOAD) as CourseMaterialAccessPermission,
      })),
    });
    ElMessage.success("保存成功");
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
    <div class="tab-scroll hover-scrollbar">
      <CourseBasicForm
        ref="formRef"
        :form="form"
        :known-owners="knownOwners"
        embedded
        @dirty="leave.markDirty()"
      />
      <div
        class="tab-scroll__spacer"
        aria-hidden="true"
      />
    </div>

    <div class="save-bar">
      <UiButton
        :variant="canSave ? 'primary' : 'default'"
        :disabled="!canSave || submitting"
        :loading="submitting"
        @click="onSave"
      >
        保存
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tab-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.tab-scroll__spacer {
  height: 72px;
}
.save-bar {
  flex-shrink: 0;
  padding: 12px 24px;
  border-top: 1px solid #eef0f3;
  background: #fff;
}
</style>
