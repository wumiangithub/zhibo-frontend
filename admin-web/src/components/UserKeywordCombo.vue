<script lang="ts">
export type UserKeywordOption = {
  label: string;
  value: string;
  /** 未传时用「请输入{label}」 */
  placeholder?: string;
};

const DEFAULT_OPTIONS: UserKeywordOption[] = [
  { label: "用户昵称", value: "nickname", placeholder: "请输入用户昵称" },
  { label: "用户ID", value: "username", placeholder: "请输入用户ID" },
  { label: "手机号", value: "phone", placeholder: "请输入手机号" },
];
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 字段下拉选项；默认昵称 / 用户ID / 手机号 */
    options?: UserKeywordOption[];
    /** 整组宽度；空字符串表示不设固定宽（如学员列表撑满） */
    width?: string;
    /** 左侧类型下拉宽度 */
    typeWidth?: string;
    clearable?: boolean;
  }>(),
  {
    options: () => DEFAULT_OPTIONS,
    width: "290px",
    typeWidth: "110px",
    clearable: true,
  },
);

const keywordType = defineModel<string>("keywordType", { required: true });
const keyword = defineModel<string>("keyword", { required: true });

const emit = defineEmits<{
  enter: [];
  clear: [];
  input: [value: string];
  typeChange: [value: string];
}>();

const placeholder = computed(() => {
  const opt = props.options.find((o) => o.value === keywordType.value);
  if (!opt) return "请输入";
  return opt.placeholder ?? `请输入${opt.label}`;
});

function onInput(value: string) {
  emit("input", value);
}

function onClear() {
  emit("clear");
}

function onEnter() {
  emit("enter");
}

function onTypeChange(value: string) {
  emit("typeChange", value);
}
</script>

<template>
  <ElInput
    v-model="keyword"
    class="user-keyword-combo"
    :style="width ? { width } : undefined"
    :clearable="clearable"
    :placeholder="placeholder"
    @input="onInput"
    @clear="onClear"
    @keyup.enter="onEnter"
  >
    <template #prepend>
      <ElSelect
        v-model="keywordType"
        class="user-keyword-combo__type"
        :style="{ width: typeWidth }"
        placeholder="类型"
        @change="onTypeChange"
      >
        <ElOption
          v-for="opt in options"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </ElSelect>
    </template>
  </ElInput>
</template>

<style scoped>
.user-keyword-combo {
  min-width: 0;
}

.user-keyword-combo :deep(.el-input__wrapper) {
  min-height: 32px;
}

.user-keyword-combo :deep(.el-input-group__prepend) {
  padding: 0;
  background: #fff;
}

.user-keyword-combo :deep(.user-keyword-combo__type) {
  margin: -1px 0;
}

.user-keyword-combo :deep(.user-keyword-combo__type .el-select__wrapper) {
  box-shadow: none !important;
  background: transparent;
}
</style>
