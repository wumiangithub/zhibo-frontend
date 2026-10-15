<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { MaterialListItem } from "@/api/materials";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import MaterialPickerDialog from "../components/MaterialPickerDialog.vue";
import UiButton from "@/components/ui/UiButton.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const form = props.form;
const markDirty = useMarkDirty();
const pickerVisible = ref(false);

function onConfirm(items: MaterialListItem[]) {
  if (items.length > 100) {
    ElMessage.warning("课件资料最多 100 个");
    return;
  }
  const prev = new Map(form.coursewares.map((c) => [c.id, c]));
  form.coursewareMaterialIds = items.map((i) => i.id);
  form.coursewares = items.map((i) => {
    const old = prev.get(i.id);
    if (!i.name || i.name === i.id) {
      return old ?? { id: i.id, name: i.name, type: i.type, url: i.url };
    }
    return { id: i.id, name: i.name, type: i.type, url: i.url };
  });
  markDirty();
}

function removeAt(index: number) {
  form.coursewareMaterialIds.splice(index, 1);
  form.coursewares.splice(index, 1);
  markDirty();
}

function move(index: number, delta: number) {
  const next = index + delta;
  if (next < 0 || next >= form.coursewares.length) return;
  const ids = form.coursewareMaterialIds;
  const rows = form.coursewares;
  ;[ids[index], ids[next]] = [ids[next], ids[index]];
  ;[rows[index], rows[next]] = [rows[next], rows[index]];
  markDirty();
}
</script>

<template>
  <FormRow
    label="课件资料:"
    info="最多 100 个文件。学员获得课程后，可作为配套资料下载或预览。从素材中心绑定已登记素材。"
  >
    <div class="cw-wrap">
      <UiButton
        class="cw-add-btn"
        variant="outline"
        @click="pickerVisible = true"
      >
        + 添加资料
      </UiButton>
      <ul
        v-if="form.coursewares.length"
        class="cw-list"
      >
        <li
          v-for="(item, i) in form.coursewares"
          :key="item.id"
          class="cw-item"
        >
          <span class="cw-name">{{ item.name }}</span>
          <span class="cw-type">{{ item.type }}</span>
          <a
            class="cw-link"
            @click.prevent="move(i, -1)"
          >上移</a>
          <a
            class="cw-link"
            @click.prevent="move(i, 1)"
          >下移</a>
          <a
            class="cw-link is-danger"
            @click.prevent="removeAt(i)"
          >删除</a>
        </li>
      </ul>
    </div>
    <MaterialPickerDialog
      v-model="pickerVisible"
      :selected-ids="form.coursewareMaterialIds"
      :max="100"
      @confirm="onConfirm"
    />
  </FormRow>
</template>

<style scoped>
.cw-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cw-add-btn {
  align-self: flex-start;
  width: auto;
}
.cw-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cw-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 6px;
  font-size: 13px;
}
.cw-name {
  flex: 1;
  min-width: 120px;
  color: var(--color-text);
  font-weight: 500;
}
.cw-type {
  color: #999;
  font-size: 12px;
}
.cw-link {
  color: var(--color-primary);
  cursor: pointer;
  font-size: 12px;
}
.cw-link.is-danger {
  color: #cf1322;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
