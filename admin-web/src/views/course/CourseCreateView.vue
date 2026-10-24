<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElButton, ElInput, ElMessage, ElOption, ElSelect } from "element-plus";
import { listEmployees, type ActivityCourseware, type EmployeeItem } from "@/api/activity";
import {
  CourseMaterialAccess,
  createCourse,
  type CourseMaterialAccessPermission,
} from "@/api/course";
import { useAuthStore } from "@/stores/auth";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { resolveDefaultOwner } from "@/views/live/composables/useLiveForm";
import MaterialCoverPicker from "@/components/MaterialCoverPicker.vue";
import FormRow from "@/views/live/components/FormRow.vue";
import RichTextEditor from "@/views/live/components/RichTextEditor.vue";
import CoursewareSection from "@/views/live/sections/CoursewareSection.vue";
import AutoListSection from "@/views/live/sections/AutoListSection.vue";

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
const knownOwners: EmployeeItem[] = (defaults.knownOwners ?? []).map((item) => ({
  ...item,
  id: Number(item.id),
}));

const form = reactive({
  name: "",
  intro: "",
  detailHtml: "",
  coverMaterialId: "",
  coverUrl: "",
  autoList: true,
  ownerIds: [...defaultOwnerIds] as number[],
  coursewareMaterialIds: [] as string[],
  coursewares: [] as ActivityCourseware[],
});
const nameError = ref("");
const submitting = ref(false);
const brokenAvatar = ref<Record<number, boolean>>({});
const ownerLoading = ref(false);
const ownerOptions = ref<EmployeeItem[]>([...knownOwners]);

function visibleTextLength(html: string) {
  return html.replace(/<[^>]+>/gi, "").replace(/&nbsp;/g, " ").replace(/&[a-zA-Z#0-9]+;/g, "").length;
}

function onNameBlur() {
  nameError.value = form.name.trim() ? "" : "请输入课程名称";
}

async function loadEmployees(keyword?: string) {
  ownerLoading.value = true;
  try {
    const data = await listEmployees(keyword);
    const map = new Map<number, EmployeeItem>();
    for (const item of data.list ?? []) map.set(item.id, item);
    for (const item of knownOwners) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    for (const id of form.ownerIds) {
      if (!map.has(id)) map.set(id, { id, userName: String(id) });
    }
    ownerOptions.value = [...map.values()];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载员工失败");
  } finally {
    ownerLoading.value = false;
  }
}

function onOwnersChange(ids: number[] | null | undefined) {
  form.ownerIds = [...new Set(ids ?? [])].slice(0, 20);
  leave.markDirty();
}

function removeOwner(id: number) {
  form.ownerIds = form.ownerIds.filter((item) => item !== id);
  leave.markDirty();
}

function ownerOf(id: number): EmployeeItem {
  return ownerOptions.value.find((item) => item.id === id)
    || knownOwners.find((item) => item.id === id)
    || { id, userName: String(id) };
}

function deptOf(emp: EmployeeItem) {
  return emp.departmentName?.trim() || "";
}

function avatarOf(emp: EmployeeItem) {
  const url = emp.avatar?.trim();
  if (!url || brokenAvatar.value[emp.id]) return "";
  return url;
}

function onAvatarError(id: number) {
  brokenAvatar.value = { ...brokenAvatar.value, [id]: true };
}

function onCoverUrl(url: string) {
  form.coverUrl = url;
  leave.markDirty();
}

function onCoverMaterialId(id: string) {
  form.coverMaterialId = id;
  leave.markDirty();
}

function onDetailHtml(html: string) {
  form.detailHtml = html;
  leave.markDirty();
}

function validate(): string {
  const name = form.name.trim();
  if (!name) return "请输入课程名称";
  if (name.length > 45) return "课程名称不能超过45个字";
  if (!form.coverMaterialId) return "请选择课程封面";
  if (form.intro.trim().length > 256) return "课程简介不能超过256个字";
  const detail = form.detailHtml.trim();
  if (detail.length > 200000) return "课程详情内容过长";
  if (visibleTextLength(detail) > 10000) return "课程详情不能超过10000个字";
  if (!form.ownerIds.length) return "请选择归属人";
  if (form.coursewareMaterialIds.length > 100) return "课件资料最多 100 个";
  return "";
}

async function onCancel() {
  if (!(await leave.confirmLeave())) return;
  leave.allowNextNavigation();
  void router.push("/course");
}

async function onSave() {
  const err = validate();
  if (err) {
    if (!form.name.trim()) nameError.value = "请输入课程名称";
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const intro = form.intro.trim();
    const detail = form.detailHtml.trim();
    await createCourse({
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
    void router.push("/course");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "课程创建失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadEmployees();
});
</script>

<template>
  <div class="course-create">
    <div class="course-create__form">
      <div class="card">
        <div class="section">
          <div class="section__title">基本信息</div>

          <FormRow
            label="课程名称:"
            required
            label-width="90px"
          >
            <div class="field">
              <ElInput
                v-model="form.name"
                maxlength="45"
                show-word-limit
                placeholder="请输入课程名称(建议字数在14字以内，不超过45个字)"
                style="width: 360px"
                @blur="onNameBlur"
                @input="leave.markDirty()"
              />
              <p
                v-if="nameError"
                class="field-error"
              >
                {{ nameError }}
              </p>
            </div>
          </FormRow>

          <FormRow
            label="课程封面:"
            required
            label-width="90px"
          >
            <MaterialCoverPicker
              :cover-url="form.coverUrl"
              :material-id="form.coverMaterialId"
              required
              hint="建议尺寸750*422px，16:9,小于5M的JPG、PNG格式图片"
              @update:cover-url="onCoverUrl"
              @update:material-id="onCoverMaterialId"
            />
          </FormRow>

          <FormRow
            label="课程简介:"
            label-width="90px"
          >
            <ElInput
              v-model="form.intro"
              type="textarea"
              :rows="4"
              maxlength="256"
              show-word-limit
              placeholder="请输入课程简介"
              style="width: 480px"
              @input="leave.markDirty()"
            />
          </FormRow>

          <FormRow
            label="课程详情:"
            label-width="90px"
          >
            <div class="detail">
              <RichTextEditor
                :model-value="form.detailHtml"
                class="detail__editor"
                :height="'340px'"
                :max-length="10000"
                placeholder="请输入内容"
                @update:model-value="onDetailHtml"
              />
              <div class="detail-hints">
                <p>1.支持从第三方编辑器粘贴内容</p>
                <p>2.图片宽高自适应显示(推荐宽度分辨率750px)</p>
                <p>3.图片支持jpg、png、gif格式，每张图片大小不超过5M</p>
              </div>
            </div>
          </FormRow>
        </div>

        <div class="related-business">
          <div class="related-business__title">关联业务配置</div>
          <div class="related-business__body">
            <FormRow
              label="归属人:"
              required
              info="新建时默认选中当前登录用户，可改选。指定负责数据的员工"
            >
              <div class="owner-wrap">
                <ElSelect
                  :model-value="form.ownerIds"
                  multiple
                  filterable
                  remote
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  :remote-method="loadEmployees"
                  :loading="ownerLoading"
                  placeholder="+ 选择员工"
                  style="width: 320px"
                  :fit-input-width="false"
                  @update:model-value="onOwnersChange"
                  @visible-change="(open: boolean) => open && loadEmployees()"
                >
                  <ElOption
                    v-for="emp in ownerOptions"
                    :key="emp.id"
                    :label="emp.userName"
                    :value="emp.id"
                  >
                    <span class="owner-option">
                      <span class="owner-avatar">
                        <img
                          v-if="avatarOf(emp)"
                          :src="avatarOf(emp)"
                          alt=""
                          @error="onAvatarError(emp.id)"
                        >
                        <svg
                          v-else
                          class="owner-avatar__icon"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
                        </svg>
                      </span>
                      <span>{{ emp.userName }}</span>
                      <span
                        v-if="deptOf(emp)"
                        class="owner-dept"
                      >{{ deptOf(emp) }}</span>
                    </span>
                  </ElOption>
                </ElSelect>
                <div
                  v-if="form.ownerIds.length"
                  class="owner-tags"
                >
                  <span
                    v-for="id in form.ownerIds"
                    :key="id"
                    class="owner-tag"
                  >
                    <span class="owner-avatar">
                      <img
                        v-if="avatarOf(ownerOf(id))"
                        :src="avatarOf(ownerOf(id))"
                        alt=""
                        @error="onAvatarError(id)"
                      >
                      <svg
                        v-else
                        class="owner-avatar__icon"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
                      </svg>
                    </span>
                    <span>{{ ownerOf(id).userName }}</span>
                    <span
                      v-if="deptOf(ownerOf(id))"
                      class="owner-dept"
                    >{{ deptOf(ownerOf(id)) }}</span>
                    <i @click="removeOwner(id)">×</i>
                  </span>
                </div>
              </div>
            </FormRow>

            <CoursewareSection
              :form="form"
              enable-access-permission
            />
            <AutoListSection
              :form="form"
              info="若选是，合规风控部门审核课程信息及课程资料通过后，课程/子课程/小节会自动上架"
            />
          </div>
        </div>
      </div>
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
.card {
  padding: 20px 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.section__title,
.related-business__title {
  margin-bottom: 18px;
  padding-left: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  border-left: 3px solid var(--color-primary);
}
.related-business {
  margin: 20px 0 0;
  padding: 18px 20px 4px;
  background: #fafbfc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}
.related-business__title {
  margin-bottom: 16px;
}
.related-business__body :deep(.form-row:last-child) {
  margin-bottom: 14px;
}
.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #f5222d;
}
.detail {
  max-width: 640px;
}
.detail__editor {
  width: 100%;
}
.detail-hints {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #999;
}
.detail-hints p {
  margin: 0;
}
.owner-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.owner-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
  width: fit-content;
  padding: 10px 12px;
  background: #f5f6f8;
  border-radius: 6px;
}
.owner-option,
.owner-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.owner-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  overflow: hidden;
  color: #fff;
  background: #d9d9d9;
  border-radius: 50%;
  flex-shrink: 0;
}
.owner-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.owner-avatar__icon {
  width: 12px;
  height: 12px;
}
.owner-dept {
  color: #999;
  font-size: 12px;
}
.owner-tag {
  padding: 4px 10px 4px 4px;
  font-size: 13px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
}
.owner-tag i {
  cursor: pointer;
  color: #999;
  font-style: normal;
}
.owner-tag i:hover {
  color: #f5222d;
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
