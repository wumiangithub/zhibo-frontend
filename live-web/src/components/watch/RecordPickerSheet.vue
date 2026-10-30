<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import type { WatchRecordItem } from "@/api/replayWatch";

const props = defineProps<{
  open: boolean;
  records: WatchRecordItem[];
}>();

const emit = defineEmits<{
  close: [];
  select: [record: WatchRecordItem];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      document.addEventListener("keydown", onKeydown);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", onKeydown);
      document.body.style.overflow = "";
    }
  },
);

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[90] flex flex-col justify-end md:items-center md:justify-center"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/60"
        aria-label="关闭"
        @click="emit('close')"
      />
      <div
        class="relative flex max-h-[70dvh] w-full flex-col rounded-t-2xl bg-gray-900 text-white shadow-xl md:max-h-[80dvh] md:max-w-lg md:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="选择回放"
      >
        <div class="flex flex-none items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 class="text-base font-semibold">
            选择回放
          </h2>
          <button
            type="button"
            class="rounded-md bg-transparent px-2 py-1 text-sm text-gray-400 hover:text-white"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>

        <ul class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <li
            v-for="row in records"
            :key="row.id"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-800/80 active:bg-gray-800"
              @click="emit('select', row)"
            >
              <div
                class="h-14 w-24 flex-none overflow-hidden rounded-md bg-gray-800"
              >
                <img
                  v-if="row.coverUrl"
                  :src="row.coverUrl"
                  alt=""
                  class="h-full w-full object-cover"
                >
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-white">
                  {{ row.title || `回放 ${row.id}` }}
                </p>
                <p class="mt-1 text-xs text-gray-400">
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
      </div>
    </div>
  </Teleport>
</template>
