<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
} from "element-plus";
import {
  createViewerTag,
  getViewerTag,
  listViewerTagGroups,
  updateViewerTag,
  ViewerTagType,
  type ViewerTagGroupItem,
} from "@/api/viewerTag";
import { ApiError } from "@/api/http";

const route = useRoute();
const router = useRouter();

const editingId = computed(() => {
  const raw = route.params.id;
  if (typeof raw !== "string" || !raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
const isDetail = computed(() => route.name === "user-tags-detail");
const isEdit = computed(() => route.name === "user-tags-edit");
const isCreate = computed(() => !isDetail.value && !isEdit.value);
const readonly = computed(() => isDetail.value);

const name = ref("");
const type = ref<number>(ViewerTagType.MANUAL);
const groupId = ref<number | undefined>();
const groups = ref<ViewerTagGroupItem[]>([]);
const submitting = ref(false);
const pageReady = ref(false);
/** 编辑页初始快照；未改内容时不点亮保存 */
const initialName = ref("");
const initialGroupId = ref<number | undefined>();

const isDirty = computed(() => {
  if (!isEdit.value) return true;
  return (
    name.value.trim() !== initialName.value || groupId.value !== initialGroupId.value
  );
});

const formValid = computed(
  () =>
    name.value.trim().length > 0 &&
    name.value.trim().length <= 20 &&
    (isCreate.value ? type.value === ViewerTagType.MANUAL : true),
);

const canSave = computed(
  () =>
    !readonly.value &&
    pageReady.value &&
    !submitting.value &&
    formValid.value &&
    isDirty.value,
);

function errMsg(err: unknown, fallback: string) {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

function goBack() {
  void router.push({ name: "user-tags" });
}

async function loadGroupsAndDefault() {
  groups.value = await listViewerTagGroups();
  const def = groups.value.find((g) => g.isDefault) ?? groups.value[0];
  if (def) groupId.value = def.id;
}

onMounted(async () => {
  try {
    await loadGroupsAndDefault();
    if (editingId.value > 0) {
      const detail = await getViewerTag(editingId.value);
      name.value = detail.name;
      type.value = detail.type;
      groupId.value = detail.groupId;
      initialName.value = detail.name;
      initialGroupId.value = detail.groupId;
    }
  } catch (err: unknown) {
    ElMessage.error(
      errMsg(err, editingId.value > 0 ? "加载标签失败" : "加载分组失败"),
    );
  } finally {
    pageReady.value = true;
  }
});

async function onSave() {
  if (readonly.value || !canSave.value) {
    if (isCreate.value && type.value === ViewerTagType.AUTO) {
      ElMessage.info("本轮不支持创建自动标签");
    }
    return;
  }
  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateViewerTag(editingId.value, {
        name: name.value.trim(),
        groupId: groupId.value,
      });
      ElMessage.success("保存成功");
    } else {
      await createViewerTag({
        name: name.value.trim(),
        type: ViewerTagType.MANUAL,
        groupId: groupId.value,
      });
      ElMessage.success("创建成功");
    }
    goBack();
  } catch (err: unknown) {
    ElMessage.error(errMsg(err, "保存失败"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="tag-form">
    <div class="form-card">
      <div class="form-row">
        <label
          class="label"
          :class="{ required: !readonly }"
        >标签名称</label>
        <ElInput
          v-model="name"
          maxlength="20"
          :show-word-limit="!readonly"
          placeholder="请输入标签名称"
          style="max-width: 420px"
          :disabled="readonly"
        />
      </div>

      <div class="form-row">
        <label
          class="label"
          :class="{ required: !readonly }"
        >标签类型</label>
        <div class="type-block">
          <ElRadioGroup
            v-model="type"
            :disabled="readonly || isEdit"
          >
            <ElRadio :value="ViewerTagType.MANUAL">手动标签</ElRadio>
            <ElRadio :value="ViewerTagType.AUTO">
              自动标签
              <span class="type-hint">
                （符合条件将对用户打上标签，不符合条件将移除用户标签，请1小时后再查看变更进度。）
              </span>
            </ElRadio>
          </ElRadioGroup>
          <div
            v-if="type === ViewerTagType.AUTO"
            class="auto-placeholder"
          >
            自动标签条件配置即将开放
          </div>
        </div>
      </div>

      <div class="form-row">
        <label class="label">所属分组</label>
        <ElSelect
          v-model="groupId"
          style="width: 220px"
          :disabled="readonly"
        >
          <ElOption
            v-for="g in groups"
            :key="g.id"
            :label="g.name"
            :value="g.id"
          />
        </ElSelect>
      </div>
    </div>

    <div class="footer">
      <template v-if="readonly">
        <ElButton
          type="primary"
          @click="goBack"
        >
          返回
        </ElButton>
      </template>
      <template v-else>
        <ElButton @click="goBack">取消</ElButton>
        <ElButton
          :type="canSave ? 'primary' : 'default'"
          :disabled="!canSave"
          :loading="submitting"
          @click="onSave"
        >
          保存
        </ElButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tag-form {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100dvh - 92px);
}
.form-card {
  background: #fff;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.label {
  flex: none;
  width: 88px;
  line-height: 32px;
  font-size: 14px;
  color: #333;
  text-align: right;
}
.label.required::before {
  content: "*";
  color: #f56c6c;
  margin-right: 4px;
}
.type-block {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.type-hint {
  color: #999;
  font-size: 12px;
}
.auto-placeholder {
  margin-top: 12px;
  padding: 16px;
  background: #f7f8fa;
  border-radius: 4px;
  color: #999;
  font-size: 13px;
}
.footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 8px;
}
</style>
