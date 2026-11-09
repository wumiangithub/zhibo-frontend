<script setup lang="ts">
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import type { WatchRecordItem } from "@/api/replayWatch";

defineProps<{
  open: boolean;
  records: WatchRecordItem[];
}>();

const emit = defineEmits<{
  close: [];
  select: [record: WatchRecordItem];
}>();
</script>

<template>
  <UiBottomSheet
    :open="open"
    title="选择回放"
    center-on-desktop
    @close="emit('close')"
  >
    <ul class="px-2 py-2">
      <li
        v-for="row in records"
        :key="row.id"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--lw-bg-elevated)] active:bg-[var(--lw-bg-elevated)]"
          @click="emit('select', row)"
        >
          <div class="h-14 w-24 flex-none overflow-hidden rounded-md bg-[var(--lw-bg-elevated)]">
            <img
              v-if="row.coverUrl"
              :src="row.coverUrl"
              alt=""
              class="h-full w-full object-cover"
            >
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-[var(--lw-text-primary)]">
              {{ row.title || `回放 ${row.id}` }}
            </p>
            <p class="mt-1 text-xs text-[var(--lw-text-secondary)]">
              <span v-if="row.duration">{{ row.duration }}</span>
              <span
                v-if="row.duration && row.createdTime"
                class="mx-1"
              >·</span>
              <span v-if="row.createdTime">{{ row.createdTime }}</span>
            </p>
          </div>
        </button>
      </li>
    </ul>
  </UiBottomSheet>
</template>
