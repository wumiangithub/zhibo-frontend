<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "@/composables/useEmojiInsert";
import { splitEmojiText } from "@/constants/emoji";
import type { ChatController } from "@/composables/useChat";
import { useToast } from "@/composables/useToast";

type DiscussTab = "all" | "user" | "mine" | "host" | "follower";

const props = defineProps<{
  chat: ChatController;
  /** 是否已进房可发消息 */
  active: boolean;
}>();

const { toast } = useToast();

const tab = ref<DiscussTab>("all");
const onlyQa = ref(false);
const keywordOn = ref(false);
const askMode = ref(false);
const showEmoji = ref(false);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const tabsTrack = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const followerOpen = ref(false);
const followerKeyword = ref("");
const selectedFollower = ref<{ id: string; name: string } | null>(null);

/** 跟进人下拉 Mock，筛选消息能力后续再接 */
const MOCK_FOLLOWERS = [
  { id: "1", name: "徐龙森" },
  { id: "2", name: "超管" },
  { id: "3", name: "邓晓颖" },
  { id: "4", name: "张西娜" },
  { id: "5", name: "杨进茹" },
  { id: "6", name: "李明轩" },
  { id: "7", name: "王晓彤" },
  { id: "8", name: "陈思远" },
];

const tabs: { key: DiscussTab; label: string; dropdown?: boolean }[] = [
  { key: "all", label: "全部" },
  { key: "user", label: "用户消息" },
  { key: "mine", label: "我的用户" },
  { key: "host", label: "讲师" },
  { key: "follower", label: "指定跟进人", dropdown: true },
];

const showRealList = computed(() => props.active && tab.value === "all");
const showTabArrows = computed(() => canScrollLeft.value || canScrollRight.value);
const followerTabLabel = computed(() => selectedFollower.value?.name || "指定跟进人");
const filteredFollowers = computed(() => {
  const q = followerKeyword.value.trim();
  if (!q) return MOCK_FOLLOWERS;
  return MOCK_FOLLOWERS.filter((item) => item.name.includes(q));
});

function updateTabScroll() {
  const el = tabsTrack.value;
  if (!el) {
    canScrollLeft.value = false;
    canScrollRight.value = false;
    return;
  }
  const max = el.scrollWidth - el.clientWidth;
  canScrollLeft.value = el.scrollLeft > 2;
  canScrollRight.value = max - el.scrollLeft > 2;
}

function scrollTabs(dir: -1 | 1) {
  const el = tabsTrack.value;
  if (!el) return;
  el.scrollBy({ left: dir * Math.max(120, Math.floor(el.clientWidth * 0.6)), behavior: "smooth" });
}

function toastSoon(label: string) {
  toast(`「${label}」暂未开放`);
}

function closeFollowerMenu() {
  followerOpen.value = false;
  followerKeyword.value = "";
}

function setTab(key: DiscussTab) {
  if (key === "follower") {
    followerOpen.value = !followerOpen.value;
    if (followerOpen.value) {
      void nextTick(() => {
        const el = tabsTrack.value?.querySelector(".tab.is-follower") as HTMLElement | null;
        el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
      });
    }
    return;
  }
  closeFollowerMenu();
  if (key === "all") {
    tab.value = key;
    return;
  }
  toastSoon(tabs.find((t) => t.key === key)?.label || key);
}

function pickFollower(item: { id: string; name: string }) {
  selectedFollower.value = item;
  tab.value = "follower";
  closeFollowerMenu();
  toast("按跟进人筛选消息暂未开放");
}

function onOnlyQa(e: Event) {
  const el = e.target as HTMLInputElement;
  onlyQa.value = false;
  el.checked = false;
  toastSoon("只看问答");
}

function onKeywordToggle() {
  keywordOn.value = false;
  toastSoon("关键词高亮");
}

function onAskToggle(e: Event) {
  const el = e.target as HTMLInputElement;
  askMode.value = false;
  el.checked = false;
  toastSoon("提问");
}

function insertEmoji(name: string) {
  const next = insertEmojiAtCursor(inputEl.value, props.chat.chatInput, name, 140);
  if (next !== null) props.chat.chatInput = next;
  showEmoji.value = false;
}

function send() {
  if (!showRealList.value) {
    toastSoon("发送");
    return;
  }
  props.chat.sendChat();
}

let resizeObs: ResizeObserver | undefined;

onMounted(() => {
  void nextTick(updateTabScroll);
  const el = tabsTrack.value;
  if (!el || typeof ResizeObserver === "undefined") return;
  resizeObs = new ResizeObserver(() => updateTabScroll());
  resizeObs.observe(el);
});

onBeforeUnmount(() => {
  resizeObs?.disconnect();
});
</script>

<template>
  <section class="discuss">
    <header class="head">
      讨论区
    </header>

    <div class="tabs-wrap">
      <div class="tabs-bar">
        <button
          v-show="showTabArrows"
          type="button"
          class="tabs-arrow"
          :disabled="!canScrollLeft"
          aria-label="向左"
          @click="scrollTabs(-1)"
        >
          ‹
        </button>
        <div
          ref="tabsTrack"
          class="tabs-track"
          @scroll="updateTabScroll"
        >
          <button
            v-for="item in tabs"
            :key="item.key"
            type="button"
            class="tab"
            :class="{
              'is-active': tab === item.key || (item.key === 'follower' && followerOpen),
              'is-follower': item.key === 'follower',
            }"
            @click="setTab(item.key)"
          >
            {{ item.key === 'follower' ? followerTabLabel : item.label }}
            <span
              v-if="item.dropdown"
              class="caret"
              :class="{ 'is-open': followerOpen }"
            >▾</span>
          </button>
        </div>
        <button
          v-show="showTabArrows"
          type="button"
          class="tabs-arrow"
          :disabled="!canScrollRight"
          aria-label="向右"
          @click="scrollTabs(1)"
        >
          ›
        </button>
      </div>

      <div
        v-if="followerOpen"
        class="follower-menu"
      >
        <div class="follower-search">
          <svg
            class="search-ico"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
            />
          </svg>
          <input
            v-model="followerKeyword"
            type="search"
            class="search-input"
            placeholder="请输入"
          >
        </div>
        <ul class="follower-list">
          <li
            v-for="item in filteredFollowers"
            :key="item.id"
          >
            <button
              type="button"
              class="follower-item"
              :class="{ 'is-picked': selectedFollower?.id === item.id }"
              @click="pickFollower(item)"
            >
              {{ item.name }}
            </button>
          </li>
          <li
            v-if="!filteredFollowers.length"
            class="follower-empty"
          >
            无匹配跟进人
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="followerOpen"
      class="follower-mask"
      @click="closeFollowerMenu"
    />

    <div class="filters">
      <label class="check">
        <input
          type="checkbox"
          :checked="onlyQa"
          @change="onOnlyQa"
        >
        只看问答
      </label>
      <button
        type="button"
        class="toggle"
        :class="{ 'is-on': keywordOn }"
        @click="onKeywordToggle"
      >
        <span class="toggle-track">
          <span class="toggle-thumb" />
        </span>
        关键词高亮
      </button>
    </div>

    <div
      v-if="chat.isChatMuted"
      class="muted"
    >
      主持人已禁言
    </div>

    <div
      :ref="chat.attachListEl"
      class="list"
    >
      <template v-if="showRealList">
        <p
          v-if="!chat.chatMessages.length"
          class="empty"
        >
          暂无评论
        </p>
        <article
          v-for="(msg, idx) in chat.chatMessages"
          :key="msg.msgId || idx"
          class="msg"
        >
          <span class="avatar">{{ (msg.sender_name || "?").charAt(0) }}</span>
          <div class="msg-body">
            <div class="msg-meta">
              <span
                class="name"
                :class="{ 'is-host': msg.is_host }"
              >{{ msg.sender_name }}</span>
              <span
                v-if="msg.is_host"
                class="badge"
              >主持人</span>
            </div>
            <p class="msg-text">
              <template
                v-for="(seg, segIdx) in splitEmojiText(msg.msg)"
                :key="segIdx"
              >
                <img
                  v-if="seg.kind === 'emoji'"
                  :src="seg.src"
                  :alt="seg.name"
                  :title="seg.name"
                  class="emoji"
                >
                <span v-else>{{ seg.value }}</span>
              </template>
            </p>
          </div>
        </article>
      </template>
      <p
        v-else-if="!active"
        class="empty"
      >
        进房后显示讨论
      </p>
      <p
        v-else-if="tab === 'follower'"
        class="empty"
      >
        {{ selectedFollower ? `已选「${selectedFollower.name}」，按跟进人筛选暂未开放` : "请选择跟进人" }}
      </p>
      <p
        v-else
        class="empty"
      >
        请选择「全部」查看消息，其它分类暂未开放
      </p>
    </div>

    <div class="composer">
      <div class="tools">
        <div class="tools-left">
          <div class="emoji-wrap">
            <button
              type="button"
              class="icon-btn"
              title="表情"
              :disabled="!active || chat.isChatMuted"
              @click="showEmoji = !showEmoji"
            >
              <svg
                class="ico"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <EmojiPanel
              v-if="showEmoji"
              @insert="insertEmoji"
            />
          </div>
          <button
            type="button"
            class="icon-btn"
            title="文件"
            @click="toastSoon('文件')"
          >
            <svg
              class="ico"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn"
            title="位置"
            @click="toastSoon('位置')"
          >
            <svg
              class="ico"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="ops"
          @click="toastSoon('操作')"
        >
          操作
        </button>
      </div>

      <textarea
        ref="inputEl"
        v-model="chat.chatInput"
        class="input"
        rows="2"
        maxlength="140"
        placeholder="说点什么吧~"
        :disabled="!active || chat.isChatMuted"
        @focus="chat.requestChatFocus(inputEl as unknown as HTMLInputElement)"
        @keydown.enter.exact.prevent="send"
      />

      <div class="composer-foot">
        <label class="check">
          <input
            type="checkbox"
            :checked="askMode"
            @change="onAskToggle"
          >
          提问
        </label>
        <button
          type="button"
          class="send"
          :disabled="!active || chat.isChatMuted || !chat.chatInput.trim()"
          @click="send"
        >
          发送
        </button>
      </div>
    </div>

    <div
      v-if="showEmoji"
      class="emoji-mask"
      @click="showEmoji = false"
    />

    <div
      v-if="chat.showVerifyDialog"
      class="verify-mask"
    >
      <div class="verify-card">
        <h3>参与聊天需要验证</h3>
        <p>输入任意内容即可完成验证</p>
        <input
          v-model="chat.verifyInput"
          type="text"
          placeholder="输入任意内容..."
          @keyup.enter="chat.completeVerify(inputEl as unknown as HTMLInputElement)"
        >
        <div class="verify-actions">
          <button
            type="button"
            class="ghost"
            @click="chat.showVerifyDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="send"
            :disabled="!chat.verifyInput.trim()"
            @click="chat.completeVerify(inputEl as unknown as HTMLInputElement)"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.discuss {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: visible;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}

.head {
  flex: none;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.tabs-wrap {
  position: relative;
  flex: none;
  z-index: 5;
}

.tabs-bar {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #f0f0f0;
}

.tabs-arrow {
  flex: none;
  width: 28px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: #fff;
  color: #666;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.tabs-arrow:hover:not(:disabled) {
  color: #1677ff;
}

.tabs-arrow:disabled {
  color: #d9d9d9;
  cursor: default;
}

.tabs-track {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-track::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.tab {
  flex: none;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #666;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.tab.is-active {
  border-bottom-color: #1677ff;
  color: #1677ff;
  font-weight: 600;
}

.caret {
  display: inline-block;
  margin-left: 2px;
  font-size: 10px;
  transition: transform 0.15s;
}

.caret.is-open {
  transform: rotate(180deg);
}

.follower-mask {
  position: fixed;
  inset: 0;
  z-index: 4;
}

.follower-menu {
  position: absolute;
  top: calc(100% - 1px);
  right: 8px;
  z-index: 6;
  width: min(220px, calc(100% - 16px));
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.follower-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px;
  padding: 0 8px;
  height: 32px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
}

.follower-search:focus-within {
  border-color: #1677ff;
}

.search-ico {
  flex: none;
  width: 14px;
  height: 14px;
  color: #999;
}

.search-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #333;
  font-size: 12px;
}

.follower-list {
  max-height: 220px;
  margin: 0;
  padding: 0 0 8px;
  overflow-y: auto;
  list-style: none;
}

.follower-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: 0;
  background: transparent;
  color: #333;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.follower-item:hover,
.follower-item.is-picked {
  background: #f5f6f8;
  color: #1677ff;
}

.follower-empty {
  padding: 16px;
  color: #999;
  font-size: 12px;
  text-align: center;
}

.filters {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f5f5f5;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #666;
  font-size: 12px;
  cursor: pointer;
}

.toggle-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: #d9d9d9;
}

.toggle.is-on .toggle-track {
  background: #1677ff;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s;
}

.toggle.is-on .toggle-thumb {
  left: 14px;
}

.muted {
  flex: none;
  padding: 6px 12px;
  background: #fff7e6;
  color: #ad6800;
  font-size: 12px;
  text-align: center;
}

.list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.empty {
  display: flex;
  height: 100%;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: #999;
  font-size: 13px;
}

.msg {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 13px;
  font-weight: 600;
}

.msg-body {
  min-width: 0;
  flex: 1;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name {
  overflow: hidden;
  color: #666;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name.is-host {
  color: #cf1322;
}

.badge {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  background: #fff1f0;
  color: #cf1322;
  font-size: 10px;
}

.msg-text {
  margin: 4px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f6f8;
  color: #333;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.emoji {
  display: inline-block;
  width: 18px;
  height: 18px;
  vertical-align: text-bottom;
}

.composer {
  flex: none;
  padding: 10px 12px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tools-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.emoji-wrap {
  position: relative;
  z-index: 20;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  cursor: pointer;
}

.ico {
  width: 18px;
  height: 18px;
}

.icon-btn:hover:not(:disabled) {
  background: #eee;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.ops {
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  font-size: 12px;
  cursor: pointer;
}

.ops:hover {
  background: #eee;
  color: #1677ff;
}

.input {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.input:focus {
  border-color: #1677ff;
}

.input:disabled {
  background: #f5f5f5;
  color: #999;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.send {
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 4px;
  background: #1677ff;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.send:hover:not(:disabled) {
  background: #4096ff;
}

.send:disabled {
  opacity: 0.45;
  cursor: default;
}

.emoji-mask {
  position: fixed;
  inset: 0;
  z-index: 15;
}

.verify-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 16px;
}

.verify-card {
  width: 100%;
  max-width: 360px;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
}

.verify-card h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.verify-card p {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
}

.verify-card input {
  box-sizing: border-box;
  width: 100%;
  height: 36px;
  margin-bottom: 12px;
  padding: 0 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.verify-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ghost {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  cursor: pointer;
}
</style>
