<script setup lang="ts">
import { computed } from "vue";
import UiBottomSheet from "@/components/UiBottomSheet.vue";
import { useWatchTheme } from "@/composables/useWatchTheme";
import type { WatchRecordItem } from "@/api/replayWatch";

defineProps<{
  open: boolean;
  records: WatchRecordItem[];
}>();

const emit = defineEmits<{
  close: [];
  select: [record: WatchRecordItem];
}>();

const { theme } = useWatchTheme();
const isDark = computed(() => theme.value === "dark");
</script>

<template>
  <UiBottomSheet
    :open="open"
    title="选择回放"
    center-on-desktop
    z-index-class="z-[220]"
    :z-index="50000"
    @close="emit('close')"
  >
    <ul
      class="record-picker-list"
      :class="{ 'is-dark': isDark }"
    >
      <li
        v-for="row in records"
        :key="row.id"
      >
        <button
          type="button"
          class="record-picker-item"
          @click="emit('select', row)"
        >
          <div class="record-picker-cover">
            <img
              v-if="row.coverUrl"
              :src="row.coverUrl"
              alt=""
              class="record-picker-cover-img"
            >
          </div>
          <div class="record-picker-meta">
            <p class="record-picker-title">
              {{ row.title || `回放 ${row.id}` }}
            </p>
            <p class="record-picker-sub">
              <span v-if="row.duration">{{ row.duration }}</span>
              <span
                v-if="row.duration && row.createdTime"
                class="record-picker-dot"
              >·</span>
              <span v-if="row.createdTime">{{ row.createdTime }}</span>
            </p>
          </div>
        </button>
      </li>
    </ul>
  </UiBottomSheet>
</template>

<style scoped>
.record-picker-list {
  margin: 0;
  padding: 8px;
  list-style: none;
}

.record-picker-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #1f2329;
  text-align: left;
  cursor: pointer;
}

.record-picker-list.is-dark .record-picker-item {
  color: rgba(255, 255, 255, 0.92);
}

.record-picker-item:hover,
.record-picker-item:active {
  background: #eef1f6;
}

.record-picker-list.is-dark .record-picker-item:hover,
.record-picker-list.is-dark .record-picker-item:active {
  background: #222836;
}

.record-picker-cover {
  width: 96px;
  height: 56px;
  flex: none;
  overflow: hidden;
  border-radius: 8px;
  background: #eef1f6;
  border: 1px solid #e8ecf1;
}

.record-picker-list.is-dark .record-picker-cover {
  background: #222836;
  border-color: #2a3140;
}

.record-picker-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.record-picker-meta {
  min-width: 0;
  flex: 1;
}

.record-picker-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.record-picker-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a9199;
}

.record-picker-list.is-dark .record-picker-sub {
  color: rgba(255, 255, 255, 0.55);
}

.record-picker-dot {
  margin: 0 4px;
}
</style>
