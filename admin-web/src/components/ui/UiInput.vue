<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    /** 输入框宽度，默认 208px */
    width?: string;
  }>(),
  {
    placeholder: "",
    disabled: false,
    width: "208px",
  },
);

const model = defineModel<string>({ default: "" });
</script>

<template>
  <label class="ui-field">
    <span
      v-if="label"
      class="ui-field__label"
    >{{ label }}</span>
    <input
      v-model="model"
      type="text"
      class="ui-field__input"
      :placeholder="placeholder"
      :disabled="disabled"
      :style="{ width }"
    >
  </label>
</template>

<style scoped>
.ui-field {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.ui-field__label {
  flex: none;
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.ui-field__input {
  box-sizing: border-box;
  height: 32px;
  padding: 0 11px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #333;
  outline: none;
  transition: border-color 0.15s;
}

.ui-field__input::placeholder {
  color: #bfbfbf;
}

.ui-field__input:hover:not(:disabled) {
  border-color: #2f54eb;
}

.ui-field__input:focus {
  border-color: #2f54eb;
  box-shadow: 0 0 0 2px rgba(47, 84, 235, 0.12);
}

.ui-field__input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}
</style>
