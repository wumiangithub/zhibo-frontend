<script setup lang="ts">
/** 播放器底栏选项（倍速 / 清晰度）：居中大字 + 选中主题色，对齐主流 App action sheet */
export type SheetOption = {
  key: string | number;
  label: string;
  selected?: boolean;
};

defineProps<{
  options: SheetOption[];
}>();

const emit = defineEmits<{
  select: [key: string | number];
}>();
</script>

<template>
  <ul class="sheet-option-list m-0 list-none px-0 pb-2 pt-1">
    <li
      v-for="opt in options"
      :key="String(opt.key)"
      class="m-0"
    >
      <button
        type="button"
        class="sheet-option-item flex w-full items-center justify-center px-4 py-[14px] text-center text-[16px] leading-snug transition-colors active:bg-[var(--lw-bg-elevated)]"
        :class="
          opt.selected
            ? 'font-medium text-[var(--lw-text-primary)]'
            : 'font-normal text-[var(--lw-text-secondary)]'
        "
        @click="emit('select', opt.key)"
      >
        {{ opt.label }}
      </button>
    </li>
  </ul>
</template>
