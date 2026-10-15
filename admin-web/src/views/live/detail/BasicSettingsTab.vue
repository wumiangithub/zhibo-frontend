<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { ActivityDetail, ActivityId } from "@/api/activity";
import BasicInfoSettingsTab from "./BasicInfoSettingsTab.vue";
import PlaybackSettingsTab from "./PlaybackSettingsTab.vue";
import SalesSettingsTab from "./SalesSettingsTab.vue";

type SubTab = "info" | "playback" | "sales";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "info", label: "基本信息" },
  { key: "playback", label: "回放设置" },
  { key: "sales", label: "售卖设置" },
];

const props = defineProps<{
  activityId: ActivityId;
  detail: ActivityDetail;
}>();

const emit = defineEmits<{ refreshed: [] }>();

const route = useRoute();
const router = useRouter();

const infoRef = ref<InstanceType<typeof BasicInfoSettingsTab> | null>(null);
const playbackRef = ref<InstanceType<typeof PlaybackSettingsTab> | null>(null);
const salesRef = ref<InstanceType<typeof SalesSettingsTab> | null>(null);

const activeSub = computed<SubTab>(() => {
  const q = String(route.query.sub ?? "");
  if (q === "playback" || q === "sales" || q === "info") return q;
  return "info";
});

function currentTabApi() {
  if (activeSub.value === "playback") return playbackRef.value;
  if (activeSub.value === "sales") return salesRef.value;
  return infoRef.value;
}

async function confirmLeaveCurrent(): Promise<boolean> {
  const tab = currentTabApi() as
    | { isDirty: () => boolean; confirmLeave: () => Promise<boolean> }
    | null
    | undefined;
  if (!tab?.isDirty?.()) return true;
  return tab.confirmLeave();
}

async function setSub(key: SubTab) {
  if (key === activeSub.value) return;
  if (!(await confirmLeaveCurrent())) return;
  const query: Record<string, string> = { tab: "basic" };
  if (key !== "info") query.sub = key;
  void router.replace({ path: route.path, query });
}

watch(
  () => props.activityId,
  () => {
    /* sub tabs remount via key on parent if needed */
  },
);

defineExpose({
  isDirty: () => {
    const tab = currentTabApi() as { isDirty?: () => boolean } | null | undefined;
    return !!tab?.isDirty?.();
  },
  confirmLeave: confirmLeaveCurrent,
});
</script>

<template>
  <div class="basic-settings">
    <div class="sub-tabs">
      <button
        v-for="t in SUB_TABS"
        :key="t.key"
        type="button"
        class="sub-tab"
        :class="{ 'is-active': activeSub === t.key }"
        @click="setSub(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <BasicInfoSettingsTab
      v-if="activeSub === 'info'"
      ref="infoRef"
      :activity-id="activityId"
      :detail="detail"
      @refreshed="emit('refreshed')"
    />
    <PlaybackSettingsTab
      v-else-if="activeSub === 'playback'"
      ref="playbackRef"
      :activity-id="activityId"
      :detail="detail"
      @refreshed="emit('refreshed')"
    />
    <SalesSettingsTab
      v-else
      ref="salesRef"
      :activity-id="activityId"
      :detail="detail"
      @refreshed="emit('refreshed')"
    />
  </div>
</template>

<style scoped>
.basic-settings {
  min-height: 320px;
}
.sub-tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border-light);
}
.sub-tab {
  position: relative;
  border: 0;
  background: transparent;
  padding: 0 0 12px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
}
.sub-tab:hover {
  color: var(--color-primary);
}
.sub-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
}
.sub-tab.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--color-primary);
}
</style>
