<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { ActivityId } from "@/api/activity";
import UserManagePanel from "./UserManagePanel.vue";
import CommentManagePanel from "./CommentManagePanel.vue";

type SubTab = "users" | "comments";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "users", label: "用户管理" },
  { key: "comments", label: "评论管理" },
];

const props = defineProps<{
  activityId: ActivityId;
}>();

const route = useRoute();
const router = useRouter();

const activeSub = computed<SubTab>(() => {
  const q = String(route.query.sub ?? "");
  if (q === "comments") return "comments";
  return "users";
});

function setSub(key: SubTab) {
  if (key === activeSub.value) return;
  const query: Record<string, string> = { tab: "userOps" };
  if (key !== "users") query.sub = key;
  void router.replace({ path: route.path, query });
}

defineExpose({
  isDirty: () => false,
  confirmLeave: async () => true,
});
</script>

<template>
  <div class="user-ops">
    <div class="sub-tabs">
      <button
        v-for="t in SUB_TABS"
        :key="t.key"
        type="button"
        class="sub-tab"
        :class="{ active: activeSub === t.key }"
        @click="setSub(t.key)"
      >
        {{ t.label }}
      </button>
    </div>
    <UserManagePanel
      v-if="activeSub === 'users'"
      :key="`users-${props.activityId}`"
      :activity-id="props.activityId"
    />
    <CommentManagePanel
      v-else
      :key="`comments-${props.activityId}`"
      :activity-id="props.activityId"
    />
  </div>
</template>

<style scoped>
.user-ops {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sub-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
}
.sub-tab {
  border: 0;
  background: transparent;
  padding: 10px 16px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.sub-tab.active {
  color: #111827;
  font-weight: 600;
  border-bottom-color: #2563eb;
}
</style>
