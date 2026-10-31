<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";
import MaterialCoverPicker from "@/components/MaterialCoverPicker.vue";
import {
  createCatalogSubcourse,
  updateCatalogSubcourse,
  type CatalogNode,
} from "@/api/course";

const props = defineProps<{
  courseId: string;
  /** 首子课且根下有内容时传 true；编辑时忽略 */
  moveRootContents?: boolean;
  /** 传入则编辑该子课程 */
  editing?: CatalogNode | null;
}>();

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirmed: [id: number] }>();

const form = reactive({
  title: "",
  coverMaterialId: "",
  coverUrl: "",
});
const submitting = ref(false);

const isEdit = computed(() => props.editing != null && props.editing.id != null);
const dialogTitle = computed(() => (isEdit.value ? "编辑子课程" : "添加子课程"));

watch(visible, (open) => {
  if (!open) return;
  if (isEdit.value && props.editing) {
    form.title = props.editing.title ?? "";
    form.coverMaterialId = props.editing.coverMaterialId ?? "";
    form.coverUrl = props.editing.coverUrl ?? "";
    return;
  }
  form.title = "";
  form.coverMaterialId = "";
  form.coverUrl = "";
});

async function onConfirm() {
  const name = form.title.trim();
  if (!name) {
    ElMessage.warning("请输入子课程名称");
    return;
  }
  if (name.length > 30) {
    ElMessage.warning("子课程名称不能超过30个字");
    return;
  }
  if (!form.coverMaterialId) {
    ElMessage.warning("请选择子课程封面");
    return;
  }
  submitting.value = true;
  try {
    if (isEdit.value && props.editing) {
      const node = await updateCatalogSubcourse(props.courseId, {
        id: props.editing.id,
        title: name,
        coverMaterialId: form.coverMaterialId,
      });
      ElMessage.success("子课程已保存");
      visible.value = false;
      emit("confirmed", node.id);
      return;
    }
    const node = await createCatalogSubcourse(props.courseId, {
      title: name,
      coverMaterialId: form.coverMaterialId,
      ...(props.moveRootContents ? { moveRootContents: true } : {}),
    });
    ElMessage.success("子课程已添加");
    visible.value = false;
    emit("confirmed", node.id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : isEdit.value ? "保存失败" : "添加失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    append-to-body
    destroy-on-close
  >
    <div class="field">
      <div class="label"><i>*</i>子课程名称</div>
      <ElInput
        v-model="form.title"
        maxlength="30"
        show-word-limit
        placeholder="请输入子课程名称(建议字数在14字以内，不超过30个字)"
      />
    </div>
    <div class="field">
      <div class="label"><i>*</i>子课程封面</div>
      <MaterialCoverPicker
        :cover-url="form.coverUrl"
        :material-id="form.coverMaterialId"
        required
        hint=""
        @update:cover-url="(url) => (form.coverUrl = url)"
        @update:material-id="(id) => (form.coverMaterialId = id)"
      />
    </div>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="submitting"
        @click="onConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.field {
  margin-bottom: 18px;
}
.label {
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
}
.label i {
  margin-right: 2px;
  color: var(--color-danger);
  font-style: normal;
}
</style>
