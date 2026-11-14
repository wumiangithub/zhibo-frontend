<script setup lang="ts">
import { computed, toRef } from "vue";
import { InfoFilled, Refresh } from "@element-plus/icons-vue";
import type { AttendeeBehavior, AttendeeKind, AttendeeTab } from "./api/console";
import { useToast } from "@/composables/useToast";
import { useAttendeeList } from "./useAttendeeList";
import { useDiscussFollowers } from "./composables/useDiscussFollowers";
import { nicknameInitial } from "./utils/nicknameInitial";

const props = defineProps<{
  activityId: string;
  /** state 3/4/5：结束/点播/回放，在线名单应为空 */
  activityEnded?: boolean;
}>();
const { toast } = useToast();

const kinds: { key: AttendeeKind; label: string }[] = [
  { key: "student", label: "学员" },
  { key: "assistant", label: "助教" },
];

const tabs: { key: AttendeeTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "online", label: "在线" },
  { key: "offline", label: "离线" },
];

const behaviors: { value: AttendeeBehavior; label: string }[] = [
  { value: "all", label: "全部行为" },
  { value: "comment", label: "发言" },
  { value: "coupon", label: "领券" },
  { value: "productClick", label: "点击商品" },
  { value: "pendingPay", label: "下单待支付" },
  { value: "purchase", label: "购买" },
];

const {
  kind,
  studentTotal,
  assistantTotal,
  allTotal,
  onlineTotal,
  offlineTotal,
  tab,
  keywordType,
  keyword,
  keywordPlaceholder,
  followerFilter,
  behavior,
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
  setKind,
  setTab,
  setFollowerFilter,
  setBehavior,
  scheduleSearch,
  searchNow,
} = useAttendeeList(toRef(props, "activityId"), toRef(props, "activityEnded"));

const { followers } = useDiscussFollowers(toRef(props, "activityId"));

const followerSelect = computed({
  get: () => followerFilter.value,
  set: (v: string) => setFollowerFilter(v || "all"),
});

const behaviorSelect = computed({
  get: () => behavior.value,
  set: (v: AttendeeBehavior) => setBehavior(v || "all"),
});

defineExpose({ patchOnline });

function shell(label: string) {
  toast(`「${label}」暂未开放`);
}

function kindCount(key: AttendeeKind): number {
  return key === "assistant" ? assistantTotal.value : studentTotal.value;
}

function tabCount(key: AttendeeTab): number {
  if (key === "online") return onlineTotal.value;
  if (key === "offline") return offlineTotal.value;
  return allTotal.value;
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
        {{ item.label }}({{ tabCount(item.key) }})
      </button>
    </div>
    <div class="kind-bar">
      <div class="kind-switch">
        <button
          v-for="item in kinds"
          :key="item.key"
          type="button"
          class="kind-btn"
          :class="{ 'is-active': kind === item.key }"
          @click="setKind(item.key)"
        >
          {{ item.label }}({{ kindCount(item.key) }})
        </button>
      </div>
      <ElTooltip
        content="在线助教：包含直播间讲师、助教及中控台角色"
        placement="bottom"
      >
        <el-icon
          class="kind-info"
          :size="14"
          aria-label="助教说明"
        >
          <InfoFilled />
        </el-icon>
      </ElTooltip>
    </div>
    <!-- 助教：无搜索、无跟进人/行为筛选（对齐产品） -->
    <div
      v-if="kind === 'student'"
      class="student-tools"
    >
      <div class="search">
        <ElInput
          v-model="keyword"
          class="keyword-combo"
          clearable
          :placeholder="keywordPlaceholder"
          @input="scheduleSearch"
          @clear="searchNow"
          @keyup.enter="searchNow"
        >
          <template #prepend>
            <ElSelect
              v-model="keywordType"
              class="keyword-type"
              placeholder="类型"
              @change="searchNow"
            >
              <ElOption
                label="用户昵称"
                value="nickname"
              />
              <ElOption
                label="用户ID"
                value="username"
              />
              <ElOption
                label="手机号"
                value="phone"
              />
            </ElSelect>
          </template>
        </ElInput>
        <button
          type="button"
          class="refresh"
          title="刷新"
          aria-label="刷新"
          :disabled="loading"
          @click="loadFirst"
        >
          <el-icon :size="16"><Refresh /></el-icon>
        </button>
      </div>
      <div class="filters">
        <div class="filter-selects">
          <ElSelect
            v-model="followerSelect"
            class="filter-select"
            filterable
            placeholder="全部跟进人"
          >
            <ElOption
              label="全部跟进人"
              value="all"
            />
            <ElOption
              label="无归属客户"
              value="none"
            />
            <ElOption
              v-for="item in followers"
              :key="item.id"
              :label="item.name"
              :value="String(item.id)"
            />
          </ElSelect>
          <ElSelect
            v-model="behaviorSelect"
            class="filter-select"
            placeholder="全部行为"
          >
            <ElOption
              v-for="item in behaviors"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </div>
        <button
          type="button"
          class="ops-link"
          @click="shell('操作')"
        >
          操作
        </button>
      </div>
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
        {{ kind === "assistant" ? "暂无助教" : "暂无学员" }}
      </p>
      <template v-else>
        <article
          v-for="item in list"
          :key="item.username"
          class="row"
        >
          <span class="avatar">
            <img
              v-if="avatarSrc(item)"
              :src="avatarSrc(item)"
              alt=""
              @error="markAvatarBroken(item.username)"
            >
            <template v-else>{{ nicknameInitial(displayName(item)) }}</template>
          </span>
          <div class="row-main">
            <div class="row-top">
              <span
                v-if="item.roleLabel"
                class="role-tag"
              >{{ item.roleLabel }}</span>
              <span class="name">{{ displayName(item) }}</span>
              <span
                class="dot"
                :class="item.online ? 'is-on' : 'is-off'"
                :title="item.online ? '在线' : '离线'"
              />
            </div>
            <p
              v-if="kind === 'student'"
              class="follower"
            >
              跟进人：{{ item.followerName?.trim() || "暂未分配" }}
            </p>
            <span
              v-if="kind === 'student'"
              class="speak-badge"
            >发言x{{ item.commentCount ?? 0 }}</span>
          </div>
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

.kind-bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
}

.kind-switch {
  display: inline-flex;
  padding: 2px;
  border-radius: 4px;
  background: #f5f5f5;
}

.kind-btn {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.kind-btn.is-active {
  background: #e8f3ff;
  color: var(--color-primary);
  font-weight: 600;
}

.kind-info {
  color: #c0c4cc;
  cursor: help;
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
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.student-tools {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 10px;
}

/* 两行共用 1fr + 动作列，红线 = 列1右缘，刷新/操作同列居中 */
.search,
.filters {
  display: grid;
  grid-template-columns: 1fr 32px;
  align-items: center;
  column-gap: 8px;
}

.keyword-combo {
  min-width: 0;
}

.keyword-combo :deep(.el-input__wrapper) {
  min-height: 32px;
}

.refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
}

.refresh:hover:not(:disabled) {
  background: var(--color-primary-bg);
}

.refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keyword-combo :deep(.el-input-group__prepend) {
  padding: 0;
  background: #fff;
}

.keyword-combo :deep(.keyword-type) {
  width: 100px;
  margin: -1px 0;
}

.keyword-combo :deep(.keyword-type .el-select__wrapper) {
  box-shadow: none !important;
  background: transparent;
}

.filter-selects {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.filter-select {
  min-width: 0;
  flex: 1;
}

.filter-select :deep(.el-select__wrapper) {
  min-height: 32px;
}

.ops-link {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  line-height: 32px;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
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
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #f0f0f0;
  color: #666;
  font-size: 13px;
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
  min-width: 0;
}

.role-tag {
  flex: none;
  padding: 0 4px;
  border: 1px solid #fa8c16;
  border-radius: 2px;
  color: #fa8c16;
  font-size: 11px;
  line-height: 18px;
}

.name {
  overflow: hidden;
  color: #333;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: #d9d9d9;
}

.dot.is-on {
  background: #52c41a;
}

.dot.is-off {
  background: #d9d9d9;
}

.follower {
  margin: 4px 0 0;
  overflow: hidden;
  color: #999;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speak-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 0 8px;
  border-radius: 2px;
  background: #e6f4ff;
  color: var(--color-primary);
  font-size: 12px;
  line-height: 20px;
}

.text-btn {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
}

.more {
  display: block;
  width: 100%;
  padding: 12px;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.more:disabled {
  color: #999;
  cursor: not-allowed;
}
</style>
