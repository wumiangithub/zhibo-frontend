<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ElButton, ElMessage } from "element-plus";
import {
  CourseMaterialAccess,
  createCourse,
  type CourseMaterialAccessPermission,
} from "@/api/course";
import { useAuthStore } from "@/stores/auth";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { resolveDefaultOwner } from "@/views/live/composables/useLiveForm";
import CourseBasicForm from "./components/CourseBasicForm.vue";
import {
  createEmptyCourseForm,
  validateCourseBasicForm,
} from "./composables/useCourseForm";

const router = useRouter();
const auth = useAuthStore();
const leave = useLeaveConfirm({
  message: "确定放弃当前编辑内容吗？",
  title: "放弃编辑",
});

const defaults = resolveDefaultOwner(auth.user);
const defaultOwnerIds = (defaults.ownerIds ?? [])
  .map((id) => Number(id))
  .filter((id) => Number.isFinite(id) && id > 0);
const knownOwners = (defaults.knownOwners ?? []).map((item) => ({
  ...item,
  id: Number(item.id),
}));

const form = createEmptyCourseForm({
  autoList: true,
  ownerIds: defaultOwnerIds,
});
const formRef = ref<InstanceType<typeof CourseBasicForm> | null>(null);
const submitting = ref(false);

async function onCancel() {
  if (!(await leave.confirmLeave())) return;
  leave.allowNextNavigation();
  void router.push("/course");
}

async function onSave() {
  const err = validateCourseBasicForm(form);
  if (err) {
    if (!form.name.trim()) formRef.value?.onNameBlur();
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const intro = form.intro.trim();
    const detail = form.detailHtml.trim();
    const created = await createCourse({
      title: form.name.trim(),
      coverMaterialId: form.coverMaterialId,
      autoList: form.autoList,
      ownerIds: [...form.ownerIds],
      ...(intro ? { introduction: intro } : {}),
      ...(detail && detail !== "<p><br></p>" ? { detailHtml: detail } : {}),
      ...(form.coursewares.length
        ? {
            materials: form.coursewares.map((row) => ({
              id: row.id,
              accessPermission: (row.accessPermission
                ?? CourseMaterialAccess.PREVIEW_DOWNLOAD) as CourseMaterialAccessPermission,
            })),
          }
        : {}),
    });
    ElMessage.success("课程创建成功");
    leave.allowNextNavigation();
    void router.push({
      path: `/course/${encodeURIComponent(created.id)}`,
      query: { tab: "catalog" },
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "课程创建失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="course-create">
    <div class="course-create__form">
      <CourseBasicForm
        ref="formRef"
        :form="form"
        :known-owners="knownOwners"
        @dirty="leave.markDirty()"
      />
    </div>

    <div class="course-create__footer">
      <div />
      <div class="flex items-center gap-3">
        <ElButton
          :disabled="submitting"
          @click="onCancel"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          @click="onSave"
        >
          确定
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-create {
  position: relative;
  padding-bottom: 80px;
}
.course-create__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.course-create__footer {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  height: 64px;
  padding: 0 32px;
  align-items: center;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
