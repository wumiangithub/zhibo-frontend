<script setup lang="ts">
import { ElTooltip, ElIcon } from "element-plus";
import { InfoFilled } from "@element-plus/icons-vue";

defineProps<{
  label: string;
  required?: boolean;
  /** label 列宽度 */
  labelWidth?: string;
  /** 悬停提示文案（有值则显示图标） */
  info?: string;
}>();
</script>

<template>
  <div class="form-row">
    <div
      class="form-row__label"
      :style="labelWidth ? { width: labelWidth } : undefined"
    >
      <span
        v-if="required"
        class="form-row__star"
      >*</span>
      {{ label }}
      <ElTooltip
        v-if="info"
        :content="info"
        placement="top"
        effect="dark"
      >
        <ElIcon class="form-row__info">
          <InfoFilled />
        </ElIcon>
      </ElTooltip>
    </div>
    <div class="form-row__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 18px;
}
.form-row__label {
  flex: none;
  width: 110px;
  text-align: right;
  color: #333;
  font-size: 13px;
  line-height: 32px;
  padding-right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.form-row__star {
  color: var(--color-danger, #f5222d);
  margin-right: 2px;
}
.form-row__info {
  margin-left: 4px;
  font-size: 14px;
  color: #c0c4cc;
  cursor: pointer;
  vertical-align: middle;
  outline: none;
}
.form-row__info:hover {
  color: var(--color-primary);
}
.form-row__content {
  flex: 1;
  min-width: 0;
}
</style>
