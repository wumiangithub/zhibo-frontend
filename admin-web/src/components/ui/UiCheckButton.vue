<script setup lang="ts">
/** 「选中本页」：灰框按钮 + 左侧 checkbox，贴合参考图 */
const checked = defineModel<boolean>("checked", { default: false });

const emit = defineEmits<{ change: [] }>();

function onToggle() {
  checked.value = !checked.value;
  emit("change");
}
</script>

<template>
  <button
    type="button"
    class="ui-check-btn"
    @click="onToggle"
  >
    <input
      type="checkbox"
      class="ui-check-btn__box"
      :checked="checked"
      tabindex="-1"
      @click.stop="onToggle"
    >
    <span><slot>选中本页</slot></span>
  </button>
</template>

<style scoped>
.ui-check-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, color 0.15s;
}

.ui-check-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ui-check-btn__box {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--color-primary);
  pointer-events: none;
}
</style>
