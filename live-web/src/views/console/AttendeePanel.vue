<script setup lang="ts">
import { toRef } from "vue";
import type { AttendeeTab } from "@/api/attendees";
import { useToast } from "@/composables/useToast";
import { useAttendeeList } from "./useAttendeeList";

const props = defineProps<{
  activityId: string;
  /** state 3/4/5：结束/点播/回放，在线名单应为空 */
  activityEnded?: boolean;
}>();
const { toast } = useToast();

const tabs: { key: AttendeeTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "online", label: "在线" },
  { key: "offline", label: "离线" },
];

const {
  tab,
  keyword,
  list,
  loading,
  loadingMore,
  error,
  hasMore,
  displayName,
  avatarSrc,
  markAvatarBroken,
  patchOnline,
  loadFirst,
  loadMore,
  setTab,
  scheduleSearch,
  searchNow,
} = useAttendeeList(toRef(props, "activityId"), toRef(props, "activityEnded"));

defineExpose({ patchOnline });

function shell(label: string) {
  toast(`「${label}」暂未开放`);
}
</script>

<template>
  <section class="col">
    <div class="tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        class="tab"
        :class="{ 'is-active': tab === item.key }"
        @click="setTab(item.key)"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="search">
      <input
        v-model="keyword"
        class="search-input"
        type="search"
        placeholder="搜索昵称"
        @input="scheduleSearch"
        @keydown.enter="searchNow"
      >
    </div>
    <div class="list">
      <p
        v-if="loading"
        class="hint"
      >
        加载中…
      </p>
      <p
        v-else-if="error && !list.length"
        class="hint is-err"
      >
        {{ error }}
        <button
          type="button"
          class="text-btn"
          @click="loadFirst"
        >
          重试
        </button>
      </p>
      <p
        v-else-if="!list.length"
        class="hint"
      >
        暂无观众
      </p>
      <template v-else>
        <article
          v-for="item in list"
          :key="item.userId"
          class="row"
        >
          <span class="avatar">
            <img
              v-if="avatarSrc(item)"
              :src="avatarSrc(item)"
              alt=""
              @error="markAvatarBroken(item.userId)"
            >
            <template v-else>{{ displayName(item).charAt(0) }}</template>
          </span>
          <div class="row-main">
            <div class="row-top">
              <span class="name">{{ displayName(item) }}</span>
              <span
                class="dot"
                :class="item.online ? 'is-on' : 'is-off'"
                :title="item.online ? '在线' : '离线'"
              />
            </div>
            <p class="time">
              进入 {{ item.enterTime }}
            </p>
            <p
              v-if="!item.online && item.leaveTime"
              class="time"
            >
              离开 {{ item.leaveTime }}
            </p>
          </div>
          <button
            type="button"
            class="text-btn"
            @click="shell('企微联系')"
          >
            企微联系
          </button>
        </article>
        <p
          v-if="error"
          class="hint is-err"
        >
          {{ error }}
        </p>
        <button
          v-if="hasMore"
          type="button"
          class="more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? "加载中…" : "加载更多" }}
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.col {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}

.tabs {
  display: flex;
  flex: none;
  border-bottom: 1px solid #f0f0f0;
}

.tab {
  flex: 1;
  height: 40px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #666;
  font-size: 13px;
  cursor: pointer;
}

.tab.is-active {
  border-bottom-color: #1677ff;
  color: #1677ff;
  font-weight: 600;
}

.search {
  flex: none;
  padding: 12px;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #1677ff;
}

.list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.hint {
  margin: 0;
  padding: 24px 12px;
  color: #999;
  font-size: 13px;
  text-align: center;
}

.hint.is-err {
  color: #ff4d4f;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 50%;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 14px;
  font-weight: 600;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-main {
  min-width: 0;
  flex: 1;
}

.row-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name {
  overflow: hidden;
  color: #333;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.is-on {
  background: #52c41a;
}

.dot.is-off {
  background: #bfbfbf;
}

.time {
  margin: 4px 0 0;
  color: #666;
  font-size: 12px;
}

.text-btn,
.more {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.text-btn {
  flex: none;
  padding: 0;
  color: #1677ff;
  font-size: 12px;
}

.more {
  display: block;
  width: calc(100% - 24px);
  height: 32px;
  margin: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 13px;
}

.more:disabled {
  color: #999;
  cursor: default;
}

.text-btn:hover,
.more:hover:not(:disabled) {
  color: #1677ff;
}
</style>
