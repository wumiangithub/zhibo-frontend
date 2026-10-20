<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElButton, ElCheckbox, ElInput, ElMessage, ElOption, ElSelect } from "element-plus";
import { listEmployees, type EmployeeItem } from "@/api/activity";
import { createCourse } from "@/api/course";
import type { MaterialListItem } from "@/api/materials";
import { useAuthStore } from "@/stores/auth";
import { useLeaveConfirm } from "@/composables/useLeaveConfirm";
import { resolveDefaultOwner } from "@/views/live/composables/useLiveForm";
import MaterialCoverPicker from "@/components/MaterialCoverPicker.vue";
import FormRow from "@/views/live/components/FormRow.vue";
import MaterialPickerDialog from "@/views/live/components/MaterialPickerDialog.vue";
import RichTextEditor from "@/views/live/components/RichTextEditor.vue";
import { formatUploadSize } from "@/views/settings/materials/materialUploadFormat";

const router = useRouter();
const auth = useAuthStore();
const leave = useLeaveConfirm({
  message: "确定放弃当前编辑内容吗？",
  title: "放弃编辑",
});

const defaults = resolveDefaultOwner(auth.user);
const form = ref({
  name: "",
  intro: "",
  detailHtml: "",
  coverMaterialId: "",
  coverUrl: "",
  autoList: true,
  ownerIds: [...defaults.ownerIds],
  materials: [] as MaterialListItem[],
});
const nameError = ref("");
const submitting = ref(false);
const materialPicker = ref(false);
const brokenAvatar = ref<Record<number, boolean>>({});
const ownerLoading = ref(false);
const ownerOptions = ref<EmployeeItem[]>([...defaults.knownOwners]);
const knownOwners = defaults.knownOwners;

const TYPE_LABEL: Record<string, string> = {
  image: "图片",
  video: "视频",
  document: "文档",
};

function visibleTextLength(html: string) {
  return html.replace(/<[^>]+>/gi, "").replace(/&nbsp;/g, " ").replace(/&[a-zA-Z#0-9]+;/g, "").length;
}

function onNameBlur() {
  nameError.value = form.value.name.trim() ? "" : "请输入课程名称";
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
    for (const id of form.value.ownerIds) {
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
  form.value.ownerIds = [...new Set(ids ?? [])].slice(0, 20);
  leave.markDirty();
}

function removeOwner(id: number) {
  form.value.ownerIds = form.value.ownerIds.filter((item) => item !== id);
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
  form.value.coverUrl = url;
  leave.markDirty();
}

function onCoverMaterialId(id: string) {
  form.value.coverMaterialId = id;
  leave.markDirty();
}

function onDetailHtml(html: string) {
  form.value.detailHtml = html;
  leave.markDirty();
}

function onMaterialConfirm(items: MaterialListItem[]) {
  const next = items.filter((item) => String(item.type) !== "article");
  if (next.length !== items.length) {
    ElMessage.warning("课件不支持文档");
  }
  if (next.length > 100) {
    ElMessage.warning("课件资料最多 100 个");
    return;
  }
  form.value.materials = next;
  leave.markDirty();
}

function removeMaterial(id: string) {
  form.value.materials = form.value.materials.filter((item) => item.id !== id);
  leave.markDirty();
}

function setAuto(value: boolean) {
  if (form.value.autoList === value) return;
  form.value.autoList = value;
  leave.markDirty();
}

function validate(): string {
  const name = form.value.name.trim();
  if (!name) return "请输入课程名称";
  if (name.length > 45) return "课程名称不能超过45个字";
  if (!form.value.coverMaterialId) return "请选择课程封面";
  if (form.value.intro.trim().length > 256) return "课程简介不能超过256个字";
  const detail = form.value.detailHtml.trim();
  if (detail.length > 200000) return "课程详情内容过长";
  if (visibleTextLength(detail) > 10000) return "课程详情不能超过10000个字";
  if (!form.value.ownerIds.length) return "请选择归属人";
  if (form.value.materials.length > 100) return "课件资料最多 100 个";
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
    if (!form.value.name.trim()) nameError.value = "请输入课程名称";
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const intro = form.value.intro.trim();
    const detail = form.value.detailHtml.trim();
    await createCourse({
      title: form.value.name.trim(),
      coverMaterialId: form.value.coverMaterialId,
      autoList: form.value.autoList,
      ownerIds: [...form.value.ownerIds],
      ...(intro ? { introduction: intro } : {}),
      ...(detail && detail !== "<p><br></p>" ? { detailHtml: detail } : {}),
      ...(form.value.materials.length ? { materialIds: form.value.materials.map((item) => item.id) } : {}),
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
    <div class="crumb">课程 / 课程管理 / 新建课程</div>
    <div class="card">
      <FormRow
        label="课程名称"
        required
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
        label="课程封面"
        required
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

      <FormRow label="课程简介">
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

      <FormRow label="课程详情">
        <div class="detail">
          <RichTextEditor
            :model-value="form.detailHtml"
            counter="fraction"
            tip=""
            placeholder=""
            @update:model-value="onDetailHtml"
          />
          <div class="detail-hints">
            <p>1.支持从第三方编辑器粘贴内容</p>
            <p>2.图片宽高自适应显示(推荐宽度分辨率750px)</p>
            <p>3.图片支持jpg、png、gif格式，每张图片大小不超过5M</p>
          </div>
        </div>
      </FormRow>

      <FormRow
        label="归属人"
        required
      >
        <div class="owner-wrap">
          <ElSelect
            :model-value="form.ownerIds"
            multiple
            filterable
            remote
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

      <FormRow
        label="课件资料"
        info="最多可上传 100 个文件。学员获得该课程后，课件资料作为该课程的配套资料供学员下载或预览"
      >
        <div class="materials">
          <ElButton @click="materialPicker = true">+ 添加资料</ElButton>
          <ul v-if="form.materials.length">
            <li
              v-for="item in form.materials"
              :key="item.id"
            >
              <span class="mat-name">{{ item.name }}</span>
              <span>{{ formatUploadSize(item.fileSize || 0) }}</span>
              <span>{{ TYPE_LABEL[item.type] || item.type }}</span>
              <a @click.prevent="removeMaterial(item.id)">删除</a>
            </li>
          </ul>
        </div>
      </FormRow>

      <FormRow
        label="是否自动上架"
        required
      >
        <div class="auto-list">
          <ElCheckbox
            :model-value="form.autoList"
            @change="setAuto(true)"
          >
            是
          </ElCheckbox>
          <ElCheckbox
            :model-value="!form.autoList"
            @change="setAuto(false)"
          >
            否
          </ElCheckbox>
          <span class="hint">若选是，合规风控部门审核课程信息及课程资料通过后，课程/子课程/小节会自动上架</span>
        </div>
      </FormRow>
    </div>

    <div class="footer">
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

    <MaterialPickerDialog
      v-model="materialPicker"
      :selected-ids="form.materials.map((item) => item.id)"
      :max="100"
      @confirm="onMaterialConfirm"
    />
  </div>
</template>

<style scoped>
.course-create {
  padding-bottom: 80px;
}
.crumb {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}
.card {
  padding: 20px 24px 8px;
  background: #fff;
  border-radius: 8px;
}
.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #f5222d;
}
.materials a {
  color: var(--color-primary);
  cursor: pointer;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
.detail {
  max-width: 640px;
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
.owner-wrap,
.materials {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.owner-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
.materials ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.materials li {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  background: #f7f8fa;
  border-radius: 4px;
}
.mat-name {
  flex: 1;
  min-width: 0;
}
.auto-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.auto-list .hint {
  margin: 0;
}
.footer {
  position: fixed;
  left: 176px;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  height: 64px;
  padding: 0 32px;
  align-items: center;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
