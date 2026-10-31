<script setup lang="ts">
import { ref } from "vue";
import { ElDrawer, ElMessage } from "element-plus";
import { CENTER_TYPE_TABS } from "@/views/settings/materials/mock";
import type { MaterialCenterType } from "@/api/materials";
import AssociateLiveDialog from "./AssociateLiveDialog.vue";

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  courseId: string;
  parentId: number;
}>();

const emit = defineEmits<{ confirmed: [] }>();

const liveDialogOpen = ref(false);

type LessonPick =
  | { kind: "live" }
  | { kind: "material"; type: MaterialCenterType };

function onPick(pick: LessonPick) {
  if (pick.kind === "live") {
    liveDialogOpen.value = true;
    return;
  }
  const label = CENTER_TYPE_TABS.find((t) => t.key === pick.type)?.label ?? pick.type;
  ElMessage.info(`添加「${label}」小节下一期再做`);
}

function onLiveConfirmed() {
  visible.value = false;
  emit("confirmed");
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    title="添加小节"
    direction="rtl"
    size="400px"
    append-to-body
    class="add-lesson-drawer"
  >
    <section class="block">
      <h3 class="block__title">直播</h3>
      <div class="grid grid--one">
        <button
          type="button"
          class="pick"
          @click="onPick({ kind: 'live' })"
        >
          <span
            class="pick__icon is-live"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4 6.5A2.5 2.5 0 016.5 4h7A2.5 2.5 0 0116 6.5v11a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 014 17.5v-11z" />
              <path d="M17 9.2l3.2-1.8A1 1 0 0121.5 8.3v7.4a1 1 0 01-1.3.9L17 14.8V9.2z" />
            </svg>
          </span>
          <span class="pick__label">直播</span>
        </button>
      </div>
    </section>

    <section class="block">
      <h3 class="block__title">内容</h3>
      <div class="grid">
        <button
          v-for="tab in CENTER_TYPE_TABS"
          :key="tab.key"
          type="button"
          class="pick"
          @click="onPick({ kind: 'material', type: tab.key })"
        >
          <span
            class="pick__icon"
            :class="`is-${tab.key}`"
            aria-hidden="true"
          >
            <svg
              v-if="tab.key === 'image'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm1 13l3.5-4.5 2.5 3 3.5-4.5L19 17H6zm2.5-8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <svg
              v-else-if="tab.key === 'video'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11zm6.2 2.1v6.8c0 .5.5.8.9.6l5.4-3.4a.7.7 0 000-1.2l-5.4-3.4a.7.7 0 00-.9.6z" />
            </svg>
            <svg
              v-else-if="tab.key === 'document'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm8 1.5V8h3.5L14 4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5zm0-7h4V10H8V8.5z" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm2 3v2h10V7H7zm0 4v1.5h10V11H7zm0 3.5V16h7v-1.5H7z" />
            </svg>
          </span>
          <span class="pick__label">{{ tab.label }}</span>
        </button>
      </div>
    </section>

    <AssociateLiveDialog
      v-model="liveDialogOpen"
      :course-id="props.courseId"
      :parent-id="props.parentId"
      @confirmed="onLiveConfirmed"
    />
  </ElDrawer>
</template>

<style scoped>
.block {
  margin-bottom: 28px;
}
.block__title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid--one {
  grid-template-columns: 1fr;
}
.pick {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 14px;
  border: 0;
  border-radius: 8px;
  background: #f5f6f8;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.pick:hover {
  background: var(--color-primary-bg);
}
.pick__icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #fff;
}
.pick__icon svg {
  width: 16px;
  height: 16px;
}
.pick__icon.is-live {
  background: #7c5cfc;
}
.pick__icon.is-image {
  background: #13c2c2;
}
.pick__icon.is-video {
  background: #2f54eb;
}
.pick__icon.is-document {
  background: #36cfc9;
}
.pick__icon.is-article {
  background: #597ef7;
}
.pick__label {
  font-size: 14px;
  color: #303133;
}
</style>

<style>
.add-lesson-drawer.el-drawer .el-drawer__header {
  margin-bottom: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}
.add-lesson-drawer.el-drawer .el-drawer__title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.add-lesson-drawer.el-drawer .el-drawer__body {
  padding: 20px;
}
</style>
