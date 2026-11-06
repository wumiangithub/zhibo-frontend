<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRef } from "vue";
import { ElCheckbox, ElIcon } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import EmojiPanel from "./components/EmojiPanel.vue";
import { insertEmojiAtCursor } from "./composables/useEmojiInsert";
import { useDiscussFollowers } from "./composables/useDiscussFollowers";
import { splitEmojiText } from "./constants/emoji";
import type { ChatController } from "./composables/useChat";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";
import { formatChatShowTime } from "./utils/formatChatShowTime";
import { nicknameInitial } from "./utils/nicknameInitial";
import { vhallChatRoleBadge } from "./utils/vhallChatRole";
import { questionAnswerText } from "./utils/vhallQuestion";


type DiscussTab = "all" | "user" | "mine" | "host" | "follower";

const props = defineProps<{
  chat: ChatController;
  /** 本场活动 UUID；用于拉观众名单做跟进人映射 */
  activityId: string;
  /** 是否已进房可发消息（直播中） */
  active: boolean;
  /** 页壳已就绪（含预告/结束）；用于展示历史列表，不依赖直播态 */
  shellReady?: boolean;
}>();

const { toast } = useToast();
const auth = useAuthStore();
const { followers, followerIdOfChatSender } = useDiscussFollowers(toRef(props, "activityId"));

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
const selectedFollower = ref<{ id: number; name: string } | null>(null);
const brokenAvatars = reactive<Record<string, true>>({});

function avatarSrc(msg: ChatMessage): string {
  const url = msg.avatar?.trim();
  if (!url || brokenAvatars[url]) return "";
  return url;
}

function onAvatarError(url: string | undefined) {
  const key = url?.trim();
  if (key) brokenAvatars[key] = true;
}

function roleBadge(msg: ChatMessage): string | undefined {
  return vhallChatRoleBadge(msg.role_name);
}

function nameToneClass(msg: ChatMessage): string {
  if (msg.role_name === 1) return "is-host";
  if (msg.role_name === 3) return "is-assistant";
  if (msg.role_name === 4) return "is-guest";
  return "";
}

function badgeToneClass(msg: ChatMessage): string {
  if (msg.role_name === 3) return "is-assistant";
  if (msg.role_name === 4) return "is-guest";
  return "is-host";
}

function isLecturerRole(role: ChatMessage["role_name"]): boolean {
  return role === 1 || role === 3 || role === 4;
}

const filteredMessages = computed(() => {
  let list = props.chat.chatMessages as ChatMessage[];
  /** 与 importerId / employeeInviterId 比：统一成 number，避免本地会话 id 偶发字符串 */
  const myId = auth.user?.id != null ? Number(auth.user.id) : NaN;

  switch (tab.value) {
    case "user":
      list = list.filter((m) => !isLecturerRole(m.role_name));
      break;
    case "host":
      list = list.filter((m) => isLecturerRole(m.role_name));
      break;
    case "mine":
      list = list.filter((m) => {
        if (!Number.isFinite(myId)) return false;
        return followerIdOfChatSender({
          viewerUserId: m.viewerUserId,
          nickname: m.sender_name,
        }) === myId;
      });
      break;
    case "follower": {
      const fid = selectedFollower.value?.id;
      if (fid == null) return [];
      list = list.filter(
        (m) =>
          followerIdOfChatSender({
            viewerUserId: m.viewerUserId,
            nickname: m.sender_name,
          }) === fid,
      );
      break;
    }
    default:
      break;
  }

  if (onlyQa.value) {
    list = list.filter((m) => m.kind === "question");
  }
  return list;
});

/** 对齐 demo：相对上一条同日同小时不显示；首条/跨小时显示 HH:mm */
const messageShowTimes = computed(() => {
  const list = filteredMessages.value;
  return list.map((m, i) =>
    formatChatShowTime(i > 0 ? list[i - 1]?.timestamp : null, m.timestamp),
  );
});

const tabs: { key: DiscussTab; label: string; dropdown?: boolean }[] = [
  { key: "all", label: "全部" },
  { key: "user", label: "用户消息" },
  { key: "mine", label: "我的用户" },
  { key: "host", label: "讲师" },
  { key: "follower", label: "指定跟进人", dropdown: true },
];

/** 页壳就绪 / 直播中 / 已有历史时展示列表；指定跟进人未选人时不展示 */
const roomReady = computed(
  () =>
    !!props.shellReady ||
    props.active ||
    (props.chat.chatMessages as ChatMessage[]).length > 0,
);
const showRealList = computed(() => {
  if (!roomReady.value) return false;
  if (tab.value === "follower" && !selectedFollower.value) return false;
  return true;
});
const showTabArrows = computed(() => canScrollLeft.value || canScrollRight.value);
const followerTabLabel = computed(() => selectedFollower.value?.name || "指定跟进人");
const filteredFollowers = computed(() => {
  const q = followerKeyword.value.trim();
  if (!q) return followers.value;
  return followers.value.filter((item) => item.name.includes(q));
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
    if (selectedFollower.value) tab.value = "follower";
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
  tab.value = key;
}

function pickFollower(item: { id: number; name: string }) {
  selectedFollower.value = item;
  tab.value = "follower";
  closeFollowerMenu();
}

function onKeywordToggle() {
  keywordOn.value = false;
  toastSoon("关键词高亮");
}

/** 未进房 / 禁言时不可编辑（对齐直播间 muted+disabled 控台） */
const composerLocked = computed(() => !props.active || props.chat.isChatMuted);

function onAskChange(val: string | number | boolean) {
  if (composerLocked.value) {
    askMode.value = false;
    return;
  }
  if (val) props.chat.requestChatFocus(inputEl.value);
}

function onEmojiToggle() {
  if (composerLocked.value) return;
  showEmoji.value = !showEmoji.value;
}

function insertEmoji(name: string) {
  if (composerLocked.value) return;
  const next = insertEmojiAtCursor(inputEl.value, props.chat.chatInput, name, 140);
  if (next !== null) props.chat.chatInput = next;
  showEmoji.value = false;
}

function send() {
  if (composerLocked.value) return;
  if (askMode.value) {
    void props.chat.sendQuestion();
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
            <ElIcon
              v-if="item.dropdown"
              class="caret"
              :class="{ 'is-open': followerOpen }"
              :size="12"
            >
              <ArrowDown />
            </ElIcon>
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
      <ElCheckbox
        v-model="onlyQa"
        size="small"
        class="discuss-check"
      >
        只看问答
      </ElCheckbox>
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
          v-if="!filteredMessages.length"
          class="empty"
        >
          暂无评论
        </p>
        <template
          v-for="(msg, idx) in filteredMessages"
          :key="msg.msgId || idx"
        >
          <div
            v-if="messageShowTimes[idx]"
            class="msg-time"
          >
            {{ messageShowTimes[idx] }}
          </div>
          <article class="msg">
            <span
              class="avatar"
              :class="nameToneClass(msg)"
            >
              <img
                v-if="avatarSrc(msg)"
                :src="avatarSrc(msg)"
                alt=""
                @error="onAvatarError(msg.avatar)"
              >
              <template v-else>{{ nicknameInitial(msg.sender_name) }}</template>
            </span>
            <div class="msg-body">
              <div class="msg-meta">
                <span
                  class="name"
                  :class="nameToneClass(msg)"
                >{{ msg.sender_name }}</span>
                <span
                  v-if="roleBadge(msg)"
                  class="badge"
                  :class="badgeToneClass(msg)"
                >{{ roleBadge(msg) }}</span>
                <span
                  v-if="msg.kind === 'question'"
                  class="badge is-question"
                >问</span>
              </div>
              <div
                v-if="msg.reply || msg.msg?.trim() || msg.answer"
                class="msg-text"
              >
                <div
                  v-if="msg.reply"
                  class="msg-reply"
                >
                  <span class="msg-reply-body">{{ msg.reply.nickname ? `${msg.reply.nickname} ${msg.reply.content}` : msg.reply.content }}</span>
                </div>
                <p
                  v-if="msg.msg?.trim()"
                  class="msg-body-text"
                >
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
                <p
                  v-if="questionAnswerText(msg)"
                  class="msg-answer"
                >
                  {{ questionAnswerText(msg) }}
                </p>
              </div>
              <div
                v-if="msg.imageUrls?.length"
                class="msg-images"
              >
                <a
                  v-for="(src, imgIdx) in msg.imageUrls"
                  :key="`${msg.msgId || idx}-img-${imgIdx}`"
                  :href="src.startsWith('//') ? `https:${src}` : src"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="msg-image-link"
                >
                  <img
                    :src="src"
                    alt="聊天图片"
                    class="msg-image"
                    loading="lazy"
                  >
                </a>
              </div>
            </div>
          </article>
        </template>
      </template>
      <p
        v-else-if="!roomReady"
        class="empty"
      >
        加载讨论中…
      </p>
      <p
        v-else-if="tab === 'follower' && !selectedFollower"
        class="empty"
      >
        请选择跟进人
      </p>
      <p
        v-else
        class="empty"
      >
        暂无评论
      </p>
    </div>

    <!-- 原中控台竖排：表情 → 大圆角 textarea → 提问 checkbox + 发送 -->
    <div class="composer">
      <div class="tools">
        <div class="tools-left">
          <div class="emoji-wrap">
            <button
              type="button"
              class="icon-btn"
              title="表情"
              :disabled="composerLocked"
              @click="onEmojiToggle"
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
        </div>
      </div>

      <textarea
        id="console-chat-input"
        ref="inputEl"
        v-model="chat.chatInput"
        class="input"
        rows="2"
        maxlength="140"
        name="zhibo-console-chat-message"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="askMode ? '发起提问' : '说点什么吧~'"
        :disabled="composerLocked"
        @focus="chat.requestChatFocus(inputEl)"
        @keydown.enter.exact.prevent="send"
      />

      <div class="composer-foot">
        <ElCheckbox
          v-model="askMode"
          size="small"
          class="discuss-check"
          :disabled="composerLocked"
          @change="onAskChange"
        >
          提问
        </ElCheckbox>
        <div class="composer-actions">
          <button
            type="button"
            class="send"
            :disabled="composerLocked || !chat.chatInput.trim()"
            @click="send"
          >
            发送
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showEmoji"
      class="emoji-mask"
      @click="showEmoji = false"
    />
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
  color: var(--color-primary);
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
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.caret {
  margin-left: 2px;
  vertical-align: -1px;
  transition: transform 0.15s ease;
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
  border-color: var(--color-primary);
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
  color: var(--color-primary);
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

.discuss-check {
  display: inline-flex;
  align-items: center;
  height: 14px;
  margin-right: 0;
  line-height: 14px;
  color: #666;
  font-size: 12px;
  --el-checkbox-font-size: 12px;
  --el-checkbox-input-height: 14px;
  --el-checkbox-input-width: 14px;
}

.discuss-check :deep(.el-checkbox__input) {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 14px;
  line-height: 14px;
  transform: translateY(1px); /* 中文光学居中 */
}

.discuss-check :deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
}

.discuss-check :deep(.el-checkbox__label) {
  display: inline-flex;
  align-items: center;
  height: 14px;
  padding-left: 6px;
  line-height: 14px;
  font-size: 12px;
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
  background: var(--color-primary);
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

.msg-time {
  display: block;
  padding: 12px 0;
  color: #999;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
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
  overflow: hidden;
  border-radius: 50%;
  background: #f5f6f8;
  color: #666;
  font-size: 13px;
  font-weight: 600;
}

/* 文字头像字色与昵称同色：主持主色 / 助理黄 / 嘉宾紫 / 观众灰 */
.avatar.is-host {
  color: var(--color-primary);
}

.avatar.is-assistant {
  color: #d48806;
}

.avatar.is-guest {
  color: #722ed1;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  min-width: 0;
  overflow: hidden;
  color: #666;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 角色昵称色与角标同系：主持用主色（非危险红）/ 助理黄 / 嘉宾紫；观众保持默认灰 */
.name.is-host {
  color: var(--color-primary);
}

.name.is-assistant {
  color: #d48806;
}

.name.is-guest {
  color: #722ed1;
}

.badge {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
}

.badge.is-host {
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
}

.badge.is-assistant {
  background: #fff7e6;
  color: #d48806;
}

.badge.is-guest {
  background: #f9f0ff;
  color: #722ed1;
}

.badge.is-question {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.msg-text {
  margin: 4px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f5f6f8;
  color: #333;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

/* 同气泡内引用：仅竖条+浅灰小字，不做分离卡片底 */
.msg-reply {
  margin-bottom: 8px;
  padding: 0 0 0 8px;
  /* 气泡底 #f5f6f8：#bfbfbf 对比偏弱，加深竖条 */
  border-left: 2px solid #8c8c8c;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 18px;
}

.msg-reply-body {
  word-break: break-all;
}

.msg-body-text {
  margin: 0;
  color: #1a1a1a;
  font-size: 14px;
  line-height: 20px;
  word-break: break-word;
}

.msg-answer {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid #e5e5e5;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 18px;
  word-break: break-all;
}

.msg-images {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.msg-image-link {
  display: block;
  overflow: hidden;
  border-radius: 8px;
  background: #f0f0f0;
}

.msg-image {
  display: block;
  max-width: 160px;
  max-height: 160px;
  object-fit: contain;
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
  border-color: var(--color-primary);
}

.input:disabled {
  background: #f5f5f5;
  color: #999;
}

.input::placeholder {
  color: #999;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.composer-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.send {
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 4px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.send:hover:not(:disabled) {
  background: var(--color-primary-hover);
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
</style>
