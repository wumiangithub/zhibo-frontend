<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  getWatchSdk,
  getStoredGuestId,
  storeGuestId,
  getStoredNickname,
  storeNickname,
  type WatchSdkData,
} from "@/api/watch";
import EmojiPanel from "@/components/EmojiPanel.vue";
import { splitEmojiText, normalizeEmojiText } from "@/constants/emoji";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(true);
const error = ref("");
const data = ref<WatchSdkData | null>(null);
const sdkReady = ref(false);
const sdkFailed = ref(false);
const useFallback = ref(false);

const nicknameInput = ref(getStoredNickname());
const showNicknameForm = ref(!getStoredNickname());
const nicknameSaving = ref(false);

const announcement = ref("");
const activeTab = ref<"chat" | "intro" | "barrage">("chat");

const chatMessages = ref<ChatMessage[]>([]);
const chatInput = ref("");
const chatInputEl = ref<HTMLInputElement | null>(null);
const chatListEl = ref<HTMLElement | null>(null);
const danmakuInputEl = ref<HTMLInputElement | null>(null);
// 同一时刻只开一个表情面板：'' 关 / 'chat' 聊天输入 / 'barrage' 弹幕输入
const emojiPanelFor = ref<"" | "chat" | "barrage">("");
const isChatMuted = ref(false);
const showVerifyDialog = ref(false);
const verifyInput = ref("");
const VERIFY_KEY = "zhibo.chatVerified";

// 自建弹幕：SDK 自带渲染器在本布局不绘制，且设置触发器 .v-c-right 被压成 0 宽（图标/面板都不可达），
// 所以弹幕的显示与设置全部由前端自己实现，值域对齐微吼参考面板。
interface DanmakuItem {
  id: number;
  text: string;
  color: string;
  fontSize: number;
  top: number; // px，相对浮层顶部
  travel: number; // px，横向位移（负值，从右侧穿到左侧）
  duration: number; // ms
}
const danmakuList = ref<DanmakuItem[]>([]);
const danmakuInput = ref("");
const danmakuLayerEl = ref<HTMLElement | null>(null);
const barrageOn = ref(true);
const barrageSettings = reactive({
  area: 0, // 0 全屏 / 1 1/4屏 / 2 上半屏 / 3 下半屏
  opacity: 100, // 0-100
  fontSize: 16, // 大 20 / 中 16 / 小 12
  color: "#ffffff",
  speed: 10000, // 慢 20000 / 标准 10000 / 快 5000 (ms)
});
const AREA_RANGES: [number, number][] = [
  [0, 1],
  [0, 0.25],
  [0, 0.5],
  [0.5, 1],
];
const AREA_OPTIONS = ["全屏", "1/4屏", "上半屏", "下半屏"];
const FONT_OPTIONS = [
  { label: "大", value: 20 },
  { label: "中", value: 16 },
  { label: "小", value: 12 },
];
const SPEED_OPTIONS = [
  { label: "慢", value: 20000 },
  { label: "标准", value: 10000 },
  { label: "快", value: 5000 },
];
const BARRAGE_COLORS = ["#ffffff", "#fb2626", "#ffb201", "#16c973", "#3552ea", "#dc12d2"];
let danmakuSeq = 0;
const trackFreeAt: number[] = [];
// 同一条文本可能被乐观上屏 + 多次回声重复送达；记录近期已渲染文本，窗口内不再重复滚
const recentDanmaku: { text: string; t: number }[] = [];

const showLiveStartPopup = ref(false);

function handleLiveStart() {
  if (isPreview.value) {
    showLiveStartPopup.value = true;
  }
}

function enterLive() {
  showLiveStartPopup.value = false;
  void load();
}

function isVerified(): boolean {
  return localStorage.getItem(VERIFY_KEY) === "1";
}

function openChatInput() {
  if (isChatMuted.value) return;
  if (isVerified()) {
    chatInputEl.value?.focus();
  } else {
    chatInputEl.value?.blur();
    showVerifyDialog.value = true;
  }
}

function completeVerify() {
  localStorage.setItem(VERIFY_KEY, "1");
  showVerifyDialog.value = false;
  verifyInput.value = "";
  setTimeout(() => {
    const el = document.getElementById("chat-input");
    el?.focus();
  }, 100);
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg || !sdkInstance || isChatMuted.value) return;
  if (msg.length > 140) return;
  try {
    sdkInstance.chat.sendChat(msg);
    // 乐观更新：立即添加到本地消息列表
    const localMsg: ChatMessage = {
      sender_id: data.value?.guestId || "",
      sender_name: data.value?.nickname || "我",
      msg,
      msgId: `local_${Date.now()}`,
      is_host: false,
      timestamp: Date.now(),
    };
    chatMessages.value.push(localMsg);
    if (chatMessages.value.length > 200) {
      chatMessages.value = chatMessages.value.slice(-100);
    }
    chatInput.value = "";
    scrollChatToBottom();
  } catch (e) {
    console.error("发送聊天失败", e);
  }
}

function scrollChatToBottom() {
  nextTick(() => {
    const el = chatListEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function insertEmoji(target: "chat" | "barrage", name: string) {
  const model = target === "chat" ? chatInput : danmakuInput;
  const max = target === "chat" ? 140 : 60;
  const el = target === "chat" ? chatInputEl.value : danmakuInputEl.value;
  const pos = el?.selectionStart ?? model.value.length;
  const next = model.value.slice(0, pos) + name + model.value.slice(pos);
  if (next.length > max) return;
  model.value = next;
  emojiPanelFor.value = "";
  // 收起面板后把光标放回令牌之后，方便继续打字
  nextTick(() => {
    el?.focus();
    el?.setSelectionRange(pos + name.length, pos + name.length);
  });
}

function normalizeChatItem(raw: Record<string, any>): ChatMessage | null {
  // 历史消息：{ content, nickname, user_id, id, user_role, role_name, create_timestamp }
  // 实时 chatMsg：{ context: 发送者, data: { type, text_content } }
  const ctx = raw.context || {};
  const payload = raw.data || {};
  if (payload.type && payload.type !== "text" && payload.type !== "image") return null;
  if (raw.event && raw.event !== "msg") return null;

  const text = raw.content || payload.text_content || "";
  const name = raw.nickname || raw.nick_name || ctx.nickname || ctx.nick_name || "";
  if (!text || !name) return null;

  const role = raw.role_name ?? ctx.role_name;
  return {
    sender_id: String(raw.user_id || ctx.third_account_id || ctx.user_id || ""),
    sender_name: name,
    msg: text,
    msgId: raw.id != null ? String(raw.id) : payload.msg_id != null ? String(payload.msg_id) : undefined,
    is_host: (raw.user_role || ctx.user_role) === "host" || String(role) === "1",
    timestamp: raw.create_timestamp ? Number(raw.create_timestamp) * 1000 : Date.now(),
  };
}

function pushChatMessage(msg: ChatMessage) {
  // 自己发的消息会先乐观插入 local_ 占位（sender_id=guestId），随后服务端回声 chatMsg 用真实 user_id 再来一次，
  // 两者 sender_id 不同，只能按内容匹配把占位替换成带真实 msgId 的回声，避免本地出现两条。
  const placeholderIdx = chatMessages.value.findIndex(
    (m) =>
      typeof m.msgId === "string" &&
      m.msgId.startsWith("local_") &&
      normalizeEmojiText(m.msg) === normalizeEmojiText(msg.msg) &&
      Math.abs(m.timestamp - Date.now()) < 15000,
  );
  if (placeholderIdx !== -1) {
    chatMessages.value.splice(placeholderIdx, 1, msg);
    return;
  }
  // 他人消息或无占位命中时的常规去重：近 5 秒内相同发送者 + 内容视为同一条
  const isDuplicate = chatMessages.value
    .slice(-20)
    .some(
      (m) =>
        m.sender_id === msg.sender_id &&
        normalizeEmojiText(m.msg) === normalizeEmojiText(msg.msg) &&
        Math.abs(m.timestamp - Date.now()) < 5000,
    );
  if (isDuplicate) return;
  chatMessages.value.push(msg);
  if (chatMessages.value.length > 200) {
    chatMessages.value = chatMessages.value.slice(-100);
  }
}

function handleChatMessage(data: unknown) {
  const msg = normalizeChatItem(data as Record<string, any>);
  if (!msg) return;
  pushChatMessage(msg);
  // 微吼 openBarrage 语义：收到聊天信息也显示为弹幕；重复回声/乐观上屏由 spawnDanmaku 内部去重
  spawnDanmaku(msg.msg);
}

/** 生成一条弹幕：按显示区域选轨道，估算文本宽度算出完整穿屏位移，动画结束后自动移除 */
function spawnDanmaku(text: string) {
  const now = Date.now();
  // 去重：乐观上屏与重复回声会在几秒内送同一条文本多次（令牌/img HTML 两种形态），窗口内只滚一次
  const key = normalizeEmojiText(text);
  while (recentDanmaku.length && now - recentDanmaku[0].t > 5000) recentDanmaku.shift();
  if (recentDanmaku.some((r) => r.text === key)) return;
  recentDanmaku.push({ text: key, t: now });

  const layer = danmakuLayerEl.value;
  if (!layer || !barrageOn.value) return;
  const layerW = layer.clientWidth;
  const layerH = layer.clientHeight;
  if (!layerW || !layerH) return;

  const fontSize = barrageSettings.fontSize;
  const [topFrac, bottomFrac] = AREA_RANGES[barrageSettings.area] || AREA_RANGES[0];
  const areaTop = layerH * topFrac;
  const areaHeight = layerH * (bottomFrac - topFrac);
  const trackH = fontSize + 10;
  const trackCount = Math.max(1, Math.floor(areaHeight / trackH));

  const textW =
    Math.ceil(
      splitEmojiText(text).reduce(
        (w, seg) => w + (seg.kind === "emoji" ? fontSize : seg.value.length * fontSize * 0.6),
        0,
      ),
    ) + 20;
  const duration = barrageSettings.speed;
  const distance = layerW + textW;

  // 选轨：优先已空闲的，否则挑最空的，避免弹幕重叠
  let track = -1;
  for (let i = 0; i < trackCount; i++) {
    if (!trackFreeAt[i] || trackFreeAt[i] <= now) {
      track = i;
      break;
    }
  }
  if (track === -1) {
    track = 0;
    let min = trackFreeAt[0] || 0;
    for (let i = 1; i < trackCount; i++) {
      if ((trackFreeAt[i] || 0) < min) {
        min = trackFreeAt[i] || 0;
        track = i;
      }
    }
  }
  // 该轨道下一条要等这条的尾部进入屏幕后再发，粗略按文本占比 + 间隔估算
  trackFreeAt[track] = now + duration * Math.min(0.6, textW / distance + 0.18);

  const item: DanmakuItem = {
    id: ++danmakuSeq,
    text,
    color: barrageSettings.color,
    fontSize,
    top: areaTop + track * trackH,
    travel: -distance,
    duration,
  };
  danmakuList.value.push(item);
  window.setTimeout(() => {
    const idx = danmakuList.value.findIndex((d) => d.id === item.id);
    if (idx !== -1) danmakuList.value.splice(idx, 1);
  }, duration + 400);
}

function sendDanmaku() {
  const text = danmakuInput.value.trim();
  if (!text || text.length > 60 || !sdkInstance) return;
  danmakuInput.value = "";
  // 互动弹幕的传输通道就是聊天（微吼文档：openBarrage 后用发送聊天接口发弹幕），浮层只负责本地样式
  spawnDanmaku(text);
  try {
    sdkInstance.chat.sendChat(text);
  } catch (e) {
    console.error("发送弹幕失败", e);
  }
}

function toggleBarrage() {
  barrageOn.value = !barrageOn.value;
  if (!barrageOn.value) danmakuList.value = [];
}

function handleChatDelete(data: unknown) {
  const { msgId } = data as { msgId?: string };
  if (msgId) {
    chatMessages.value = chatMessages.value.filter((m) => m.msgId !== msgId);
  }
}

async function loadChatHistory() {
  if (!sdkInstance) return;
  try {
    // SDK 读 opt.page；page>1 会切到回放历史，直播历史固定传 1
    const res = await sdkInstance.vhall_get_live_history_chat_msg({ page: 1 });
    const raw = res as Record<string, any>;
    const list: Record<string, any>[] = Array.isArray(raw) ? raw : raw.data || raw.list || [];
    const items = list
      .map(normalizeChatItem)
      .filter((m): m is ChatMessage => m !== null);
    // 接口返回新→旧，列表展示旧→新
    chatMessages.value = items.reverse();
    scrollChatToBottom();
  } catch (e) {
    console.warn("加载聊天历史失败", e);
  }
}

function handleAnnouncement(data: unknown) {
  const notice = data as { content?: string; announcement?: string };
  const text = notice.content || notice.announcement || "";
  if (text) {
    announcement.value = text;
  }
}

async function loadAnnouncementHistory() {
  if (!sdkInstance) return;
  try {
    const res = await sdkInstance.vhall_get_history_notice(1);
    // SDK 把列表放在 data.data
    const raw = res as Record<string, any>;
    const list: Record<string, any>[] = Array.isArray(raw)
      ? raw
      : raw.data?.data || raw.data || [];
    if (list.length > 0) {
      const latest = list[0] as { content?: string; announcement?: string };
      const text = latest.content || latest.announcement || "";
      if (text) {
        announcement.value = text;
      }
    }
  } catch (e) {
    console.warn("加载公告历史失败", e);
  }
}

const likeCount = ref(0);
const onlineCount = ref(0);
const roomId = ref("");

/** SDK 把 room_id 塞在 interact_token(JWT) 的 payload 里，getRoominfo 不可用时兜底解码 */
function roomIdFromToken(): string {
  const token =
    (window as unknown as { vhsdklInfo?: { interact_token?: string } }).vhsdklInfo?.interact_token ||
    (window as unknown as { interact_token?: string }).interact_token ||
    "";
  const seg = token.split(".")[1];
  if (!seg) return "";
  try {
    const bin = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { room_id?: string };
    return payload.room_id || "";
  } catch {
    return "";
  }
}

async function loadRoomId() {
  // interact_token 同步可得且稳定，优先用它；getRoominfo 偶发挂起会卡死轮询，故只作超时兜底
  roomId.value = roomIdFromToken();
  if (roomId.value || !sdkInstance?.getRoominfo) return;
  try {
    const info = await Promise.race([
      sdkInstance.getRoominfo(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    if (info) roomId.value = info.room_id || info.roomId || info.interact?.room_id || "";
  } catch (e) {
    console.warn("获取房间信息失败", e);
  }
}

async function loadLikeCount() {
  if (!sdkInstance || !roomId.value) return;
  try {
    const res = await sdkInstance.interactTools.getRoomLike(roomId.value);
    // SDK 把整个响应 {code, data} resolve 出来，总数在 data.total
    likeCount.value = res.data?.total ?? res.total ?? 0;
  } catch (e) {
    console.warn("获取点赞数失败", e);
  }
}

/** getRoominfo 在 sdk-init 完成前返回空对象，轮询等到房间 id 出现再拉点赞总数 */
function scheduleRoomId(tries = 0) {
  void loadRoomId().then(() => {
    if (roomId.value) {
      void loadLikeCount();
      return;
    }
    if (tries < 9) window.setTimeout(() => scheduleRoomId(tries + 1), 1000);
  });
}

function handleLike() {
  if (!sdkInstance || !roomId.value) return;
  try {
    // SDK 实现读 room_id，文档写 roomid，两个都传保险
    sdkInstance.interactTools.praise.userLike({ roomid: roomId.value, room_id: roomId.value, num: 1 });
    // 乐观更新：本地点完立刻 +1，服务端 customPraiseTotal 推回真实总数时再覆盖校正
    likeCount.value += 1;
  } catch (e) {
    console.error("点赞失败", e);
  }
}

function handleOnlinePopulation(data: unknown) {
  const info = data as { uv?: number; total?: number };
  onlineCount.value = info.uv || info.total || 0;
}

function handlePraiseTotal(data: unknown) {
  const info = data as { num?: number; total?: number; count?: number };
  // 推送的是当前总数，但批量下发有延迟，可能还没算进本地点赞；
  // 直播点赞只增不减，用 max 夹住，服务端总数只能往上抬、不能把乐观更新压回去
  const value = info.num ?? info.total ?? info.count;
  if (typeof value === "number") likeCount.value = Math.max(likeCount.value, value);
}

async function shareWatch() {
  const url = `${window.location.origin}/watch/${id}`;
  try {
    await navigator.clipboard.writeText(url);
    alert("观看链接已复制");
  } catch {
    prompt("复制观看链接：", url);
  }
}

function showGiftPlaceholder() {
  alert("礼物功能即将上线");
}

const countdown = ref("");
let countdownTimer: ReturnType<typeof setInterval> | null = null;

let sdkInstance: VhallSdkInstance | null = null;

async function switchToEndedFromLive() {
  stopPlayPoll();
  needsTapToPlay.value = false;
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
    sdkInstance = null;
  }
  sdkReady.value = false;
  try {
    const guestId = getStoredGuestId();
    const nickname = getStoredNickname() || undefined;
    const params: Record<string, string> = {};
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    const res = await getWatchSdk(id, params);
    // 微吼状态可能略慢一拍；先强制进结束 UI，时间字段用最新接口
    data.value = {
      ...res,
      state: res.state === 1 ? 3 : res.state,
    };
  } catch {
    if (data.value) {
      data.value = { ...data.value, state: 3 };
    } else {
      // API 也失败时，给一个最小 data 让结束态 UI 能渲染
      data.value = { id, state: 3, title: "", nickname: "", guestId: "" } as WatchSdkData;
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(el);
  });
}

const SDK_ERROR_MAP: Record<number, string> = {
  20001: "房间不存在",
  20002: "房间未开始",
  20003: "房间已结束",
  20004: "房间已关闭",
  20005: "活动不存在或已结束",
  20006: "签名验证失败",
  20007: "参数错误",
};

function formatSdkError(msg: unknown): string {
  let type: number | undefined;
  let msgText: string | undefined;

  if (typeof msg === "string") {
    try {
      const parsed = JSON.parse(msg) as { type?: number; msg?: string; data?: unknown };
      type = parsed.type;
      msgText = parsed.msg;
      if (type && SDK_ERROR_MAP[type]) return SDK_ERROR_MAP[type];
      if (msgText) return msgText;
      return msg;
    } catch {
      return msg;
    }
  }
  if (msg && typeof msg === "object") {
    const obj = msg as { type?: number; msg?: string };
    type = obj.type;
    msgText = obj.msg;
    if (type && SDK_ERROR_MAP[type]) return SDK_ERROR_MAP[type];
    if (msgText) return msgText;
  }
  if (msg != null) {
    return JSON.stringify(msg);
  }
  return "SDK 错误";
}

function startCountdown(startTime: string) {
  stopCountdown();
  const target = new Date(startTime.replace(" ", "T")).getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) {
      countdown.value = "即将开播";
      stopCountdown();
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (hours > 0) {
      countdown.value = `${hours}时${minutes}分${seconds}秒`;
    } else if (minutes > 0) {
      countdown.value = `${minutes}分${seconds}秒`;
    } else {
      countdown.value = `${seconds}秒`;
    }
  }

  update();
  countdownTimer = setInterval(update, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

const isLive = computed(() => data.value?.state === 1);
const isPreview = computed(() => data.value?.state === 2);
const isEnded = computed(() => data.value?.state === 3);
const isReplay = computed(() => data.value?.state === 4 || data.value?.state === 5);
/** type=1 音频直播：浏览器常因自动播放策略把音轨挂起 */
const isAudioLive = computed(() => data.value?.type === 1);

const needsTapToPlay = ref(false);
let playPollTimer: ReturnType<typeof setInterval> | null = null;

function findPlayerMedia(): HTMLMediaElement | null {
  return (
    document.querySelector<HTMLMediaElement>("#player video") ||
    document.querySelector<HTMLMediaElement>("#player audio") ||
    document.querySelector<HTMLMediaElement>("#player-vhall-video")
  );
}

/**
 * SDK 的全屏按钮直接对 #player 调 requestFullscreen，
 * 内嵌浏览器 / 无 fullscreen 权限的 iframe 会静默拒绝，按钮看起来“没反应”，
 * 此时用 fixed 铺满视口兜底。
 */
const pseudoFullscreen = ref(false);

function applyPseudoFullscreen(on: boolean) {
  if (pseudoFullscreen.value === on) return;
  pseudoFullscreen.value = on;
  // 容器尺寸变了，通知播放器重新布局（弹幕层等按 window resize 计算）
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

function handlePlayerClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest("#vhExitFullScreen")) {
    applyPseudoFullscreen(false);
    return;
  }
  if (target.closest("#vhFullScreen")) {
    window.setTimeout(() => {
      if (!document.fullscreenElement) applyPseudoFullscreen(true);
    }, 200);
  }
  // 切清晰度后 SDK 只更新按钮文字，下拉里的选中态需要我们自己标
  window.setTimeout(() => {
    reapplyQualityLabels();
    syncQualityActive();
  }, 300);
}

/** SDK 文案（480p 等）→ 展示文案（高清 等），loadQualityLabels 填充 */
const qualityLabelMap: Record<string, string> = {};

/** SDK 控制栏 DOM，异步生成；Teleport 把互动按钮挂进去 */
const controllerEl = ref<HTMLElement | null>(null);

function syncControllerEl() {
  controllerEl.value = document.querySelector<HTMLElement>("#player .vh-player-controller");
}

/** 按文档 canPlayDefinitions 的码值改写下拉文案：same=原画、a=音频，其余按档位叫 高清/标清/流畅 */
function loadQualityLabels() {
  const playerMod = sdkInstance?.player;
  if (!playerMod?.canPlayDefinitions) return;
  // 播放器未就绪时 SDK 内部会抛错，由调用方重试
  playerMod.canPlayDefinitions((list: string[]) => {
    if (!Array.isArray(list)) return;
    const items = document.querySelectorAll("#player .vh-quality-item");
    if (items.length !== list.length) return;
    // 码值形如 same / a / 480p，先抽出数字位再排档位
    const numeric = list
      .map((c) => c.replace(/\D/g, ""))
      .filter((n) => n !== "")
      .sort((a, b) => Number(b) - Number(a));
    const rankNames = ["高清", "标清", "流畅"];
    list.forEach((code, i) => {
      const el = items[i];
      let sdkLabel = el.getAttribute("data-sdk-label");
      if (!sdkLabel) {
        sdkLabel = (el.textContent || "").trim();
        el.setAttribute("data-sdk-label", sdkLabel);
      }
      const digits = code.replace(/\D/g, "");
      let label: string;
      if (code === "same") label = "原画";
      else if (code === "a") label = "音频";
      else if (digits) label = rankNames[numeric.indexOf(digits)] || `${digits}p`;
      else label = code;
      if (!qualityLabelMap[sdkLabel]) qualityLabelMap[sdkLabel] = label;
      el.textContent = label;
    });
    syncQualityActive();
  });
}

/** SDK 可能重渲染下拉，按已记录的映射把文案刷回来 */
function reapplyQualityLabels() {
  document.querySelectorAll("#player .vh-quality-item").forEach((el) => {
    const sdkLabel = el.getAttribute("data-sdk-label");
    if (sdkLabel && qualityLabelMap[sdkLabel]) {
      el.textContent = qualityLabelMap[sdkLabel];
    }
  });
}

/** 播放器就绪前 canPlayDefinitions 会抛错/不回调，轮询重试直到拿到码值 */
function scheduleQualityLabels(tries = 0) {
  window.setTimeout(() => {
    syncControllerEl();
    try {
      loadQualityLabels();
    } catch {
      /* 播放器未就绪 */
    }
    if (Object.keys(qualityLabelMap).length === 0 && tries < 9) {
      scheduleQualityLabels(tries + 1);
    } else {
      syncQualityActive();
    }
  }, 1500);
}

/** 把清晰度按钮上的当前档同步成下拉条目的高亮 */
function syncQualityActive() {
  const btn = document.querySelector("#player .vh-definition-btn");
  if (!btn) return;
  let current = (btn.textContent || "").trim();
  if (qualityLabelMap[current]) {
    btn.textContent = qualityLabelMap[current];
    current = qualityLabelMap[current];
  }
  document.querySelectorAll("#player .vh-quality-item").forEach((el) => {
    el.classList.toggle("is-active", (el.textContent || "").trim() === current);
  });
}

function handleFullscreenChange() {
  if (document.fullscreenElement) applyPseudoFullscreen(false);
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") applyPseudoFullscreen(false);
}

function stopPlayPoll() {
  if (playPollTimer) {
    clearInterval(playPollTimer);
    playPollTimer = null;
  }
}

function startPlayPoll() {
  stopPlayPoll();
  let tries = 0;
  playPollTimer = setInterval(() => {
    tries += 1;
    const media = findPlayerMedia();
    if (media) {
      // 进房默认不播放：用户没点过之前，SDK 若自行起播（通常静音）也暂停并保留遮罩
      if (!playRequested) {
        if (!media.paused) media.pause();
        needsTapToPlay.value = true;
        stopPlayPoll();
        return;
      }
      // readyState>=2 有数据但仍 paused → 多半被自动播放策略拦住
      if (media.paused && media.readyState >= 2) {
        needsTapToPlay.value = true;
        stopPlayPoll();
        return;
      }
      if (!media.paused) {
        needsTapToPlay.value = false;
        stopPlayPoll();
        return;
      }
    }
    if (tries >= 40) {
      // 约 20s 仍无播放，仍提示点击（语音直播尤其需要）
      needsTapToPlay.value = true;
      stopPlayPoll();
    }
  }, 500);
}

let playInProgress = false;
// 用户是否主动点过播放；进房默认不播放，SDK 自行起播也要暂停等用户点击
let playRequested = false;

async function resumePlayback() {
  if (playInProgress) return;
  playInProgress = true;
  playRequested = true;
  try {
    let media = findPlayerMedia();
    // 播放器由 SDK 异步创建，点得太早 media 还不存在；等它出现再播，避免“点了没反应”
    for (let i = 0; i < 20 && !media; i++) {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      media = findPlayerMedia();
    }
    if (!media) {
      needsTapToPlay.value = true;
      return;
    }
    // 源还在加载时 play() 会被随后的 load 打断（AbortError），等有了源再播
    for (let i = 0; i < 30 && media.readyState === 0 && !media.currentSrc; i++) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    media.muted = false;
    media.volume = Math.max(media.volume, 0.5);
    await media.play();
    needsTapToPlay.value = false;
  } catch (e) {
    needsTapToPlay.value = true;
    // 自动播放被策略拦截、或 play 被换源打断都是可重试的常态，只出“点击播放”遮罩，不弹错误横幅
    const benign =
      e instanceof DOMException
        ? e.name === "AbortError" || e.name === "NotAllowedError"
        : e instanceof Error && e.message.includes("interrupted");
    if (!benign) {
      error.value = e instanceof Error ? e.message : "无法自动播放，请再点一次「点击收听」";
    }
  } finally {
    playInProgress = false;
  }
}

async function initSdk() {
  if (!data.value) return;
  const res = data.value;

  loading.value = false;
  needsTapToPlay.value = false;
  await nextTick();

  if (res.sdk.jqueryUrl) {
    await loadScript(res.sdk.jqueryUrl);
  }
  await loadScript(res.sdk.scriptUrl);

  if (!window.VhallSDK) {
    throw new Error("SDK 加载异常，未找到 VhallSDK（需 3.9.1）");
  }

  sdkInstance = new window.VhallSDK({
    app_key: res.sdk.appKey,
    signedat: res.sdk.signedAt,
    webinar_id: res.sdk.webinarId,
    email: res.sdk.email,
    username: res.sdk.username,
    sign: res.sdk.sign,
    sign_type: res.sdk.signType ?? 0,
    videoContent: "#player",
    docContent: "#docWrap",
  });

  sdkInstance.$on("error", (msg: unknown) => {
    // SDK 运行时错误（如 20005）可能是临时连接问题，不显示错误页面
    // 只记录日志，让 SDK 自行恢复
    console.warn("SDK 运行时错误:", formatSdkError(msg));
  });

  // 官方：H5 活动直播结束 → live_over（见 Apifox 全局事件）
  // streamOver 为旧 Flash 事件，一并听作兜底
  const onLiveEnded = () => {
    void switchToEndedFromLive();
  };
  sdkInstance.$on("live_over", onLiveEnded);
  sdkInstance.$on("streamOver", onLiveEnded);

  // 自动播放失败时直接出「点击收听/播放」（比轮询更准）
  sdkInstance.$on("vhallplay_AUTOPLAY_FAILED", () => {
    needsTapToPlay.value = true;
  });

  // 聊天事件
  sdkInstance.$on("chatMsg", handleChatMessage);
  sdkInstance.$on("chatDelete", handleChatDelete);
  sdkInstance.$on("disableChat", () => {
    isChatMuted.value = true;
  });
  sdkInstance.$on("permitChat", () => {
    isChatMuted.value = false;
  });

  // 公告事件
  sdkInstance.$on("room_announcement", handleAnnouncement);

  // SDK 的 JSONP 回调名按毫秒时间戳生成，并发调用会同名互踩，
  // 导致先发起的请求 Promise 永不 settle，必须串行加载
  void loadChatHistory().then(() => loadAnnouncementHistory());

  // 开播引导事件
  sdkInstance.$on("live_start", handleLiveStart);

  // 在线人数事件
  sdkInstance.$on("onlinePopulation", handleOnlinePopulation);

  // 点赞总数事件
  sdkInstance.$on("EVENT_PRAISE_TOTAL", handlePraiseTotal);

  // 加载房间信息和点赞数
  scheduleRoomId();

  sdkReady.value = true;
  // 控制栏由 SDK 异步生成，等播放器就绪后改写下拉文案并标初始选中态
  scheduleQualityLabels();
  // 进房默认不播放：直接出「点击播放」遮罩，等用户点击（手势链内）才 resumePlayback 出声
  needsTapToPlay.value = true;
  startPlayPoll();
}

async function load() {
  loading.value = true;
  error.value = "";
  sdkReady.value = false;
  sdkFailed.value = false;
  useFallback.value = false;
  data.value = null;
  stopCountdown();
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
    sdkInstance = null;
  }
  try {
    const guestId = getStoredGuestId();
    const nickname = getStoredNickname() || undefined;
    const params: Record<string, string> = {};
    if (guestId) params.guestId = guestId;
    if (nickname) params.nickname = nickname;
    const res = await getWatchSdk(id, params);
    storeGuestId(res.guestId);
    data.value = res;

    if (res.state === 2 && res.startTime) {
      startCountdown(res.startTime);
      await initSdk();
    } else if (res.state === 1) {
      await initSdk();
    } else {
      loading.value = false;
    }
  } catch (e) {
    sdkFailed.value = true;
    error.value = e instanceof Error ? e.message : "加载失败";
    loading.value = false;
  }
}

function switchToFallback() {
  useFallback.value = true;
  error.value = "";
}

async function saveNickname() {
  const name = nicknameInput.value.trim();
  if (!name) return;
  nicknameSaving.value = true;
  storeNickname(name.slice(0, 50));
  showNicknameForm.value = false;
  nicknameSaving.value = false;
  await load();
}

function changeNickname() {
  nicknameInput.value = getStoredNickname();
  showNicknameForm.value = true;
}

watch(() => data.value?.state, (newState) => {
  if (newState === 2 && data.value?.startTime) {
    startCountdown(data.value.startTime);
  } else {
    stopCountdown();
  }
});

onMounted(() => {
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("keydown", handleGlobalKeydown);
  if (!showNicknameForm.value) {
    load();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  document.removeEventListener("keydown", handleGlobalKeydown);
  stopCountdown();
  stopPlayPoll();
  if (sdkInstance?.destroy) {
    try {
      sdkInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  sdkInstance = null;
});
</script>

<template>
  <div class="flex h-dvh flex-col bg-black text-white">
    <!-- 表情面板打开时的全屏遮罩：点面板外任意处关闭 -->
    <div
      v-if="emojiPanelFor"
      class="fixed inset-0 z-40"
      @click="emojiPanelFor = ''"
    ></div>
    <div
      class="flex min-h-0 flex-1 flex-col"
    >
      <div
        v-if="showNicknameForm"
        class="flex flex-1 flex-col items-center justify-center gap-4 p-6"
      >
        <h2 class="text-lg font-semibold text-green-400">进入观看</h2>
        <p class="text-sm text-gray-400">设置你的昵称（可选，默认「观众」）</p>
        <div class="flex items-center gap-2">
          <input
            v-model="nicknameInput"
            type="text"
            maxlength="50"
            placeholder="观众"
            class="w-48 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            @keyup.enter="saveNickname"
          />
          <button
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            :disabled="nicknameSaving"
            @click="saveNickname"
          >
            进入
          </button>
        </div>
        <button
          class="bg-transparent text-sm text-gray-500 hover:text-gray-300"
          @click="() => { showNicknameForm = false; load(); }"
        >
          跳过，使用默认昵称
        </button>
      </div>

      <template v-else>
        <div class="flex flex-none items-center justify-between gap-4 border-b border-gray-800 px-4 py-2">
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="truncate text-sm font-semibold text-white">
              {{ data?.title || '直播' }}
            </h1>
            <span
              v-if="data && isLive"
              class="inline-flex flex-none items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
              直播中
            </span>
          </div>
          <div class="flex flex-none items-center gap-3">
            <span class="flex items-center gap-1 text-xs text-gray-300">
              <span class="h-2 w-2 rounded-full bg-green-500"></span>
              {{ onlineCount }}
            </span>
            <p class="text-xs text-gray-400">
              昵称：<span class="text-gray-200">{{ data?.nickname || getStoredNickname() || '观众' }}</span>
            </p>
            <button
              class="bg-transparent text-xs text-gray-500 hover:text-gray-300"
              @click="changeNickname"
            >
              修改
            </button>
          </div>
        </div>

        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          加载中…
        </div>

        <div
          v-else-if="error && !useFallback"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
          <div class="flex gap-3">
            <button
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="load"
            >
              重试
            </button>
            <button
              v-if="sdkFailed && data?.embedUrl"
              class="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              @click="switchToFallback"
            >
              切换嵌入模式
            </button>
          </div>
        </div>

        <div
          v-else-if="data && useFallback"
          class="flex flex-1 items-center justify-center"
        >
          <iframe
            :src="data.embedUrl"
            class="h-full w-full flex-1 border-0"
            allowfullscreen
            allow="fullscreen; microphone; camera; autoplay; display-capture"
          />
        </div>

        <div
          v-else-if="data && isPreview"
          class="relative flex flex-1 flex-col"
        >
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center">
            <p class="text-lg font-semibold text-amber-400">距离开播还有</p>
            <p class="text-3xl font-mono font-bold text-white">{{ countdown }}</p>
            <p class="text-sm text-gray-400">
              开始时间：{{ data.startTime }}
            </p>
          </div>

          <!-- 开播引导弹窗 -->
          <div
            v-if="showLiveStartPopup"
            class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4"
          >
            <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6 text-center">
              <div class="mb-4 flex justify-center">
                <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-sm font-medium text-red-400">
                  <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                  直播已开始
                </span>
              </div>
              <h3 class="mb-2 text-lg font-semibold text-white">直播已开始，请观看直播吧</h3>
              <p class="mb-6 text-sm text-gray-400">点击下方按钮进入直播</p>
              <button
                class="w-full rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
                @click="enterLive"
              >
                立即观看
              </button>
            </div>
          </div>

          <div
            id="player"
            class="min-h-0 w-full flex-1 opacity-0"
          />
          <div
            id="docWrap"
            class="hidden"
          />
        </div>

        <div
          v-else-if="data && (isEnded || isReplay)"
          class="relative flex flex-1 flex-col"
        >
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center">
            <div class="flex flex-col items-center gap-2">
              <span class="inline-flex items-center gap-2 rounded-full bg-gray-700/50 px-3 py-1 text-xs font-medium text-gray-400">
                <span class="h-2 w-2 rounded-full bg-gray-500"></span>
                直播已结束
              </span>
              <h2 class="mt-2 text-xl font-semibold text-white">{{ data.title }}</h2>
            </div>

            <div class="mt-4 rounded-lg bg-gray-800/50 px-6 py-4">
              <p class="text-sm text-gray-400">
                直播时间
              </p>
              <p class="mt-1 text-base font-medium text-gray-200">
                {{ data.startTime }}
              </p>
              <template v-if="data.endTime">
                <p class="text-xs text-gray-500">至</p>
                <p class="text-base font-medium text-gray-200">
                  {{ data.endTime }}
                </p>
              </template>
            </div>

            <p class="text-xs text-gray-500">
              感谢观看
            </p>
          </div>

          <div
            id="player"
            class="min-h-0 w-full flex-1 opacity-0"
          />
          <div
            id="docWrap"
            class="hidden"
          />
        </div>

        <div
          v-else-if="data && isLive"
          class="flex min-h-0 flex-1 flex-col"
        >
          <!-- 公告横幅 (T11.3) -->
          <div
            v-if="announcement"
            class="flex flex-none items-center gap-2 bg-amber-600/90 px-4 py-2 text-sm text-white"
          >
            <span class="font-medium">公告</span>
            <span class="flex-1 truncate">{{ announcement }}</span>
            <button
              class="bg-transparent text-white/70 hover:text-white"
              @click="announcement = ''"
            >
              ✕
            </button>
          </div>

          <div class="flex min-h-0 flex-1 flex-row">
            <!-- 播放器区域 -->
            <div class="relative min-h-0 min-w-0 flex-1 bg-black">
              <button
                v-if="needsTapToPlay"
                type="button"
                class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center"
                @click="resumePlayback"
              >
                <span class="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium hover:bg-green-700">
                  {{ isAudioLive ? '点击收听' : '点击播放' }}
                </span>
                <span class="text-xs text-gray-300">
                  {{ isAudioLive ? '浏览器限制自动出声，点一下即可听见直播' : '浏览器限制自动播放，点一下开始观看' }}
                </span>
              </button>

              <div
                v-if="isAudioLive"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6"
              >
                <div class="flex flex-col items-center gap-2">
                  <span class="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                    直播中
                  </span>
                  <h2 class="mt-2 text-xl font-semibold text-white">{{ data.title }}</h2>
                </div>

                <div class="flex items-end gap-1">
                  <span v-for="i in 5" :key="i" class="w-1.5 rounded-full bg-green-500" :style="{ height: `${20 + Math.random() * 40}px`, animation: `audioWave 1s ease-in-out ${i * 0.1}s infinite alternate` }"></span>
                </div>

                <p class="text-sm text-gray-400">
                  正在播放音频直播
                </p>
              </div>

              <div
                id="player"
                class="h-full w-full"
                :class="{
                  'opacity-0': isAudioLive,
                  'player-fallback-fullscreen': pseudoFullscreen,
                }"
                @click="handlePlayerClick"
              />
              <div
                id="docWrap"
                class="hidden"
              />

              <!-- 自建弹幕浮层：覆盖在播放器上，pointer-events:none 不挡控制栏点击 -->
              <div
                v-show="barrageOn"
                ref="danmakuLayerEl"
                class="danmaku-layer"
                :style="{ opacity: barrageSettings.opacity / 100 }"
              >
                <span
                  v-for="d in danmakuList"
                  :key="d.id"
                  class="danmaku-item"
                  :style="{
                    top: d.top + 'px',
                    color: d.color,
                    fontSize: d.fontSize + 'px',
                    animationDuration: d.duration + 'ms',
                    '--travel': d.travel + 'px',
                  }"
                >
                  <template v-for="(seg, segIdx) in splitEmojiText(d.text)" :key="segIdx">
                    <img
                      v-if="seg.kind === 'emoji'"
                      :src="seg.src"
                      :alt="seg.name"
                      class="inline-block align-text-bottom"
                      :style="{ width: d.fontSize + 'px', height: d.fontSize + 'px' }"
                    >
                    <span v-else>{{ seg.value }}</span>
                  </template>
                </span>
              </div>
            </div>

            <!-- 礼物/点赞/在线/分享：Teleport 进 SDK 控制栏，靠右对齐 -->
            <Teleport v-if="controllerEl" :to="controllerEl">
              <div class="player-bar-actions">
                <!-- 弹幕开关：点击切换显示，长按无需，设置在弹幕 tab 内 -->
                <button
                  type="button"
                  :title="barrageOn ? '关弹幕' : '开弹幕'"
                  :class="{ 'is-off': !barrageOn }"
                  @click="toggleBarrage"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 3V7a1 1 0 011-1z" />
                  </svg>
                </button>
                <!-- 礼物占位 (T11.5) -->
                <button
                  type="button"
                  title="礼物"
                  @click="showGiftPlaceholder"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </button>
                <!-- 点赞 (T11.5) -->
                <button
                  type="button"
                  title="点赞"
                  @click="handleLike"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.601 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span class="text-xs">{{ likeCount }}</span>
                </button>
                <!-- 分享 (T11.5) -->
                <button
                  type="button"
                  title="分享"
                  @click="shareWatch"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>

            </Teleport>

            <!-- 互动区域（PC） -->
            <div class="flex min-h-0 w-[360px] flex-none flex-col border-l border-gray-800 bg-gray-900">
              <!-- 标签栏 -->
              <div class="flex flex-none border-b border-gray-800">
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'chat' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'chat'"
                >
                  聊天
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'barrage' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'barrage'"
                >
                  弹幕
                </button>
                <button
                  class="flex-1 bg-transparent px-4 py-3 text-sm font-medium"
                  :class="activeTab === 'intro' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'"
                  @click="activeTab = 'intro'"
                >
                  简介
                </button>
              </div>

              <!-- 聊天 -->
              <template v-if="activeTab === 'chat'">
                <!-- 禁言提示 -->
                <div
                  v-if="isChatMuted"
                  class="flex flex-none items-center justify-center gap-2 bg-gray-800 px-4 py-2 text-xs text-gray-400"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                  <span>主持人已禁言</span>
                </div>

                <!-- 消息列表 -->
                <div ref="chatListEl" class="min-h-0 flex-1 overflow-y-auto p-3">
                  <div v-if="chatMessages.length === 0" class="flex h-full items-center justify-center text-xs text-gray-500">
                    暂无消息，快来聊两句吧
                  </div>
                  <div
                    v-for="(msg, idx) in chatMessages"
                    :key="msg.msgId || idx"
                    class="mb-3 flex gap-2"
                  >
                    <div class="h-8 w-8 flex-shrink-0 rounded-full bg-gray-700"></div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          class="truncate text-xs"
                          :class="msg.is_host ? 'text-red-400' : 'text-gray-400'"
                        >
                          {{ msg.sender_name }}
                        </span>
                        <span
                          v-if="msg.is_host"
                          class="flex-none rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400"
                        >
                          主持人
                        </span>
                      </div>
                      <div class="mt-1 inline-block max-w-full break-words rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200">
                        <template v-for="(seg, segIdx) in splitEmojiText(msg.msg)" :key="segIdx">
                          <img
                            v-if="seg.kind === 'emoji'"
                            :src="seg.src"
                            :alt="seg.name"
                            :title="seg.name"
                            class="inline-block h-5 w-5 align-text-bottom"
                          >
                          <span v-else>{{ seg.value }}</span>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 输入栏 -->
                <div class="flex-none border-t border-gray-800 p-3">
                  <div class="flex items-center gap-2">
                    <div class="relative z-50 flex-none">
                      <button
                        class="rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
                        title="表情"
                        :disabled="isChatMuted"
                        @click="emojiPanelFor = emojiPanelFor === 'chat' ? '' : 'chat'"
                      >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <EmojiPanel
                        v-if="emojiPanelFor === 'chat'"
                        @insert="insertEmoji('chat', $event)"
                      />
                    </div>
                    <input
                      id="chat-input"
                      ref="chatInputEl"
                      v-model="chatInput"
                      type="text"
                      maxlength="140"
                      placeholder="参与聊天"
                      class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
                      :disabled="isChatMuted"
                      @focus="openChatInput"
                      @keyup.enter="sendChat"
                    />
                    <button
                      class="flex-none rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      :disabled="isChatMuted || !chatInput.trim()"
                      @click="sendChat"
                    >
                      发送
                    </button>
                  </div>
                </div>
              </template>

              <!-- 弹幕 -->
              <template v-else-if="activeTab === 'barrage'">
                <div class="min-h-0 flex-1 overflow-y-auto p-4">
                  <!-- 弹幕开关 -->
                  <div class="mb-4 flex items-center justify-between">
                    <span class="text-sm text-gray-300">弹幕显示</span>
                    <button
                      type="button"
                      class="relative h-6 w-11 rounded-full transition-colors"
                      :class="barrageOn ? 'bg-red-500' : 'bg-gray-600'"
                      @click="toggleBarrage"
                    >
                      <span
                        class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                        :class="barrageOn ? 'left-[22px]' : 'left-0.5'"
                      ></span>
                    </button>
                  </div>

                  <div class="space-y-4 text-sm">
                    <!-- 显示区域 -->
                    <div>
                      <p class="mb-2 text-gray-400">显示区域</p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="(label, idx) in AREA_OPTIONS"
                          :key="label"
                          type="button"
                          class="rounded-md px-3 py-1.5 text-xs transition-colors"
                          :class="barrageSettings.area === idx ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
                          @click="barrageSettings.area = idx"
                        >
                          {{ label }}
                        </button>
                      </div>
                    </div>

                    <!-- 不透明度 -->
                    <div>
                      <p class="mb-2 text-gray-400">不透明度 <span class="text-gray-500">{{ barrageSettings.opacity }}%</span></p>
                      <input
                        v-model.number="barrageSettings.opacity"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        class="w-full accent-red-500"
                      />
                    </div>

                    <!-- 字体大小 -->
                    <div>
                      <p class="mb-2 text-gray-400">字体大小</p>
                      <div class="flex gap-2">
                        <button
                          v-for="opt in FONT_OPTIONS"
                          :key="opt.value"
                          type="button"
                          class="rounded-md px-3 py-1.5 text-xs transition-colors"
                          :class="barrageSettings.fontSize === opt.value ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
                          @click="barrageSettings.fontSize = opt.value"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>

                    <!-- 弹幕颜色 -->
                    <div>
                      <p class="mb-2 text-gray-400">弹幕颜色</p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="c in BARRAGE_COLORS"
                          :key="c"
                          type="button"
                          class="h-7 w-7 rounded-full border-2 transition-transform"
                          :class="barrageSettings.color === c ? 'scale-110 border-white' : 'border-transparent'"
                          :style="{ backgroundColor: c }"
                          @click="barrageSettings.color = c"
                        ></button>
                      </div>
                    </div>

                    <!-- 弹幕速度 -->
                    <div>
                      <p class="mb-2 text-gray-400">弹幕速度</p>
                      <div class="flex gap-2">
                        <button
                          v-for="opt in SPEED_OPTIONS"
                          :key="opt.value"
                          type="button"
                          class="rounded-md px-3 py-1.5 text-xs transition-colors"
                          :class="barrageSettings.speed === opt.value ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'"
                          @click="barrageSettings.speed = opt.value"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 弹幕输入栏 -->
                <div class="flex-none border-t border-gray-800 p-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="h-4 w-4 flex-none rounded-full border border-gray-600"
                      :style="{ backgroundColor: barrageSettings.color }"
                    ></span>
                    <div class="relative z-50 flex-none">
                      <button
                        class="rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                        title="表情"
                        @click="emojiPanelFor = emojiPanelFor === 'barrage' ? '' : 'barrage'"
                      >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <EmojiPanel
                        v-if="emojiPanelFor === 'barrage'"
                        @insert="insertEmoji('barrage', $event)"
                      />
                    </div>
                    <input
                      ref="danmakuInputEl"
                      v-model="danmakuInput"
                      type="text"
                      maxlength="60"
                      placeholder="发个弹幕…"
                      class="min-w-0 flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                      @keyup.enter="sendDanmaku"
                    />
                    <button
                      class="flex-none rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      :disabled="!danmakuInput.trim()"
                      @click="sendDanmaku"
                    >
                      发送
                    </button>
                  </div>
                </div>
              </template>

              <!-- 简介 -->
              <div v-else class="min-h-0 flex-1 overflow-y-auto p-4">
                <h3 class="mb-3 text-base font-semibold text-white">{{ data.title }}</h3>
                <div class="space-y-2 text-sm text-gray-400">
                  <p>
                    <span class="text-gray-500">开始时间：</span>
                    <span>{{ data.startTime }}</span>
                  </p>
                  <p v-if="data.endTime">
                    <span class="text-gray-500">结束时间：</span>
                    <span>{{ data.endTime }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 假验证弹窗 -->
          <div
            v-if="showVerifyDialog"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          >
            <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6">
              <h3 class="mb-2 text-lg font-semibold text-white">参与聊天需要验证</h3>
              <p class="mb-4 text-sm text-gray-400">输入任意内容即可完成验证</p>
              <input
                v-model="verifyInput"
                type="text"
                placeholder="输入任意内容..."
                class="mb-4 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                @keyup.enter="completeVerify"
              />
              <div class="flex justify-end gap-2">
                <button
                  class="rounded-md bg-transparent px-4 py-2 text-sm text-gray-400 hover:text-white"
                  @click="showVerifyDialog = false"
                >
                  取消
                </button>
                <button
                  class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  :disabled="!verifyInput.trim()"
                  @click="completeVerify"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* SDK 会给 #player 写内联 position: relative，这里必须 !important 才能覆盖 */
#player.player-fallback-fullscreen {
  position: fixed !important;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100dvh;
  /* video 的 letterbox 区域是透明的，不垫黑会透出底下的顶栏/聊天面板 */
  background: #000;
}

/* SDK 控制栏默认半透明黑，和黑色播放区糊在一起，改成灰底做区分 */
#player :deep(.vh-player-controller) {
  background: #1f2937;
}

/* SDK 默认把功能组（清晰度/音量/弹幕/全屏）float 到右边，改成跟在播放按钮后左对齐 */
#player :deep(.vh-player-right) {
  float: left;
  margin-right: 0;
}

/* Teleport 进控制栏的 3 个互动按钮：靠右、与栏同高，hover 只变色 */
.player-bar-actions {
  position: absolute;
  top: 0;
  right: 10px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.player-bar-actions button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: #fff;
}

.player-bar-actions button:hover {
  color: #ef4444;
}

/* 弹幕关闭态：图标变灰，hover 仍只变色 */
.player-bar-actions button.is-off {
  color: #6b7280;
}

/* 自建弹幕浮层 */
.danmaku-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  pointer-events: none;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  will-change: transform;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  animation-name: danmaku-move;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes danmaku-move {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--travel));
  }
}

/* SDK 控制栏按 content-box 计算高度（24 内容 + 13*2 padding = 50），
   全局 border-box 会把盒子压扁导致图标和胶囊按钮错位 */
#player :deep(*) {
  box-sizing: content-box;
}

/* 清晰度下拉：对齐参考稿的深灰面板 + 居中条目 + 选中标红 */
#player :deep(.vh-definition-list) {
  bottom: 54px;
  left: 50%;
  transform: translateX(-50%);
  width: 72px;
  padding: 4px 0;
  background: #262626;
  border-radius: 4px;
  overflow: hidden;
}

#player :deep(.vh-quality-item) {
  height: 44px;
  line-height: 44px;
  border-radius: 0;
  background: transparent;
  color: #fff;
  font-size: 14px;
}

/* hover 统一只变文字/图标颜色，不加背景 */
#player :deep(.vh-quality-item:hover) {
  background: transparent;
  color: #ef4444;
}

#player :deep(.vh-quality-item.is-active) {
  color: #ef4444;
}

/* 清晰度按钮对齐参考稿：红字、无胶囊底 */
#player :deep(.vh-definition-btn) {
  background: transparent;
  color: #ef4444;
}

#player :deep(.vh-definition-btn:hover) {
  background: transparent;
  color: #f87171;
}

/* 微吼自带弹幕按钮/下拉移除：弹幕统一走侧栏「弹幕」tab + 自建浮层，避免两套入口 */
#player :deep(.vh-barrage-btn),
#player :deep(.vh-barrage-list),
#player :deep(.vhallPlayer-brarage-btn),
#player :deep(.vhallPlayer-brarage-popup) {
  display: none;
}

#player :deep(.vh-speed-btn) {
  background: transparent;
  color: #fff;
}

#player :deep(.vh-speed-btn:hover) {
  background: transparent;
  color: #ef4444;
}

/* 音量滑杆弹层：SDK 默认纯黑块 + 浏览器蓝色滑杆，改成与下拉同色系面板 + 红滑杆 */
#player :deep(.vh-voice-list) {
  background: #262626;
  border-radius: 4px;
}

#player :deep(#vhVoiceSlide) {
  accent-color: #ef4444;
  background: #4b5563;
  border-radius: 3px;
}

/* 全屏图标是 PNG，SDK hover 会换蓝色图；改用 mask 着色，hover 变红 */
#player :deep(#vhFullScreen) {
  background-image: none !important;
  background-color: #fff;
  -webkit-mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAMFBMVEVHcEzu7u7////t7e34+Pjt7e3t7e3////y8vLt7e3t7e3t7e3u7u7v7+/t7e3t7e0duasSAAAAD3RSTlMAbQPGDZW4CBPQ7KJMTkjzr+TDAAAAv0lEQVQoz53SMQ6CMBTG8TdoGFy4QQkJOrC6Q3R0aaL3kMmZY3iCrj1Kj+ARGJqYOD37utB+jYtv/OUfKPQRlbNjGTMm5CJxnZD6Re8xJ39qG4LqmL9RsWU/Al0xU3wbIFOsz5AF2kAWiCB7hYNLNq3U+5kkq+F3VENBdDET/TtbMyMt/ERy/AlZl97CniVz6Wmqu2Tyfes8JMspZjnFDOgQMiDJLFB4GgNJllFn4y7ocod0dgvFDvXlDlEr09AXDGWMDVnjKjQAAAAASUVORK5CYII=");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 20px;
  mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAMFBMVEVHcEzu7u7////t7e34+Pjt7e3t7e3////y8vLt7e3t7e3t7e3u7u7v7+/t7e3t7e0duasSAAAAD3RSTlMAbQPGDZW4CBPQ7KJMTkjzr+TDAAAAv0lEQVQoz53SMQ6CMBTG8TdoGFy4QQkJOrC6Q3R0aaL3kMmZY3iCrj1Kj+ARGJqYOD37utB+jYtv/OUfKPQRlbNjGTMm5CJxnZD6Re8xJ39qG4LqmL9RsWU/Al0xU3wbIFOsz5AF2kAWiCB7hYNLNq3U+5kkq+F3VENBdDET/TtbMyMt/ERy/AlZl97CniVz6Wmqu2Tyfes8JMspZjnFDOgQMiDJLFB4GgNJllFn4y7ocod0dgvFDvXlDlEr09AXDGWMDVnjKjQAAAAASUVORK5CYII=");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 20px;
}

#player :deep(#vhExitFullScreen) {
  background-image: none !important;
  background-color: #fff;
  -webkit-mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAKlBMVEVHcEz19fXu7u7////t7e3t7e3t7e3////v7+/t7e3t7e3t7e3t7e3t7e3BLMSkAAAADXRSTlMAD20Dv5XMCUuz8qLol+ANWAAAAMFJREFUKM+N0TEKwkAQheHZhGBroblHXDyAlVUg4AmsJZDKi9gFPYIgpPAekiIG5y7OWO28jeKUX/6wySxRPLP2jpRw30TEGyJXdsGLNfdzeTAEWa7Zmh8BOc0yQ5rtgTRbWqIj8wHIlfwCogWzpdQXpSV3YYYq4W80mO2ojDf6b1KvAx+s0/0+JpumK48V0NYeqASXlcmGIJNd15AJ5ZAJyS08G0sEmRJkK/nwVLJT8Nvt7nOnAyzI5xFRca4mVvkGHmmBR0NR+YMAAAAASUVORK5CYII=");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 20px;
  mask-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkBAMAAAATLoWrAAAAKlBMVEVHcEz19fXu7u7////t7e3t7e3t7e3////v7+/t7e3t7e3t7e3t7e3t7e3BLMSkAAAADXRSTlMAD20Dv5XMCUuz8qLol+ANWAAAAMFJREFUKM+N0TEKwkAQheHZhGBroblHXDyAlVUg4AmsJZDKi9gFPYIgpPAekiIG5y7OWO28jeKUX/6wySxRPLP2jpRw30TEGyJXdsGLNfdzeTAEWa7Zmh8BOc0yQ5rtgTRbWqIj8wHIlfwCogWzpdQXpSV3YYYq4W80mO2ojDf6b1KvAx+s0/0+JpumK48V0NYeqASXlcmGIJNd15AJ5ZAJyS08G0sEmRJkK/nwVLJT8Nvt7nOnAyzI5xFRca4mVvkGHmmBR0NR+YMAAAAASUVORK5CYII=");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 20px;
}

#player :deep(#vhFullScreen:hover),
#player :deep(#vhExitFullScreen:hover) {
  background-color: #ef4444;
}

/* 音量图标是 PNG，SDK 没给 hover 态，用亮度模拟变色 */
#player :deep(.vh-voice-btn:hover) {
  filter: brightness(1.6);
}

@keyframes audioWave {
  0% {
    transform: scaleY(0.5);
  }
  100% {
    transform: scaleY(1);
  }
}
</style>
