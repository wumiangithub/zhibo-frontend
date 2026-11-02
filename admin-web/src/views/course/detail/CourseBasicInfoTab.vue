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

/** 待审核或未写风控状态时，基本信息不可改。 */
const auditLocked = computed(() => {
  const status = props.detail.riskStatus;
  return !status || status === "pending";
});

function applyDetail(d: CourseDetail) {
  form.name = d.title ?? "";
  form.intro = d.introduction ?? "";
  form.detailHtml = d.detailHtml ?? "";
  form.coverMaterialId = d.coverMaterialId ?? "";
  form.coverUrl = d.coverUrl ?? "";
  form.autoList = d.autoList ?? true;
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
    && form.autoList === (d.autoList ?? true)
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

const canSave = computed(() => hasEdits.value && !auditLocked.value);

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
  if (auditLocked.value) {
    ElMessage.warning("审核中不可编辑");
    return;
  }
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
      autoList: form.autoList,
      ownerIds: [...form.ownerIds],
      introduction: intro || undefined,
      detailHtml: detail && detail !== "<p><br></p>" ? detail : undefined,
      materials: form.coursewares.map((row) => ({
        id: row.id,
        accessPermission: (row.accessPermission
          ?? CourseMaterialAccess.PREVIEW_DOWNLOAD) as CourseMaterialAccessPermission,
      })),
    });
    ElMessage.success("保存成功，重新进入审核");
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
    <!-- 实际滚动容器：overflow + hover-scrollbar；间隙必须进 scrollHeight，不能靠本层 padding -->
    <div class="tab-scroll hover-scrollbar">
      <p
        v-if="auditLocked"
        class="lock-tip"
      >
        审核中不可编辑
      </p>
      <CourseBasicForm
        ref="formRef"
        :form="form"
        :known-owners="knownOwners"
        :disabled="auditLocked"
        embedded
        @dirty="leave.markDirty()"
      />
      <!--
        直播 BasicInfoSettingsTab 的 padding-bottom 加在页滚内容流上，会进 scrollHeight。
        课程是 height:100% 内滚：padding 在 border-box 下多半变成视口内缩进，滚不到。
        用内容末尾 spacer 保证 scrollHeight 增加，滚到底时最后一项明显高于固定底栏。
      -->
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
  min-height: 0;
}
.tab-scroll {
  height: 100%;
  min-height: 0;
  overflow: auto;
}
/*
 * 64px 固定底栏 + ~56px 可见空隙（对齐直播 tab 88px 量级在 fill 布局下的观感）
 * 必须是滚动内容子节点，才会计入 scrollHeight。
 */
.tab-scroll__spacer {
  height: 120px;
  flex-shrink: 0;
  pointer-events: none;
}
.lock-tip {
  margin: 0 0 12px;
  padding: 10px 14px;
  font-size: 13px;
  color: #ad6800;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
}
/* 与直播设置 BasicInfoSettingsTab / 新建页 footer 同款：贴视口底，避开左侧 176px 导航 */
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
