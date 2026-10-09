/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATTENDANCE_CLIENT_REPORT?: string;
  readonly VITE_ATTENDANCE_LEAVE_THROTTLE_MS?: string;
  readonly VITE_ATTENDANCE_LEAVE_LAST_VIEWER?: string;
  readonly VITE_ATTENDANCE_LEAVE_ASSISTANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface VhallSdkOptions {
  app_key: string;
  signedat: string;
  webinar_id: string | number;
  email: string;
  username: string;
  sign: string;
  sign_type?: number;
  videoContent: string;
  docContent: string;
}

interface ChatMessage {
  sender_id: string;
  sender_name: string;
  msg: string;
  msgId?: string;
  is_host?: boolean;
  timestamp: number;
}

interface ChatModule {
  sendChat(msg: string): void;
  sendCustomEvent(event: { type: string; data: unknown }): void;
}

interface PraiseModule {
  userLike(params: { roomid?: string; room_id?: string; num: number }): void;
}

interface GiftModule {
  getGiftList(): Promise<unknown>;
  sendGift(giftId: string): Promise<unknown>;
}

interface InteractTools {
  getRoomLike(roomId: string): Promise<{ total?: number; data?: { total?: number } }>;
  praise: PraiseModule;
  gift: GiftModule;
}

interface VhallHistoryChatItem {
  content: string;
  nickname: string;
  nick_name?: string;
  user_name?: string;
  user_id: string | number;
  id: string | number;
  user_role?: string;
  role_name?: string | number;
  avatar?: string;
  event?: string;
  create_timestamp?: number;
}

interface VhallNoticeItem {
  content?: string;
  announcement?: string;
  created_at?: string;
}

interface VhallPlayerModule {
  play?(): void;
  pause?(): void;
  canPlayDefinitions(cb: (list: string[]) => void): void;
  setPlayerDefinition?(value: string): void;
  /** 静音；文档 ≥3.5.4，设计给静音自动播放。自建底栏音量/静音钮不用此 API，走 HTMLMediaElement */
  setMute?(muted: boolean): Promise<void>;
  /** 音量 0～100；文档 ≥3.5.4。自建底栏不读此值（易陈旧/与 media 冲突），走 HTMLMediaElement */
  getVolume?(): number;
}

/** 微吼进出房推送的分组上下文 */
interface VhallUserPresenceGroupInit {
  isInGroup: boolean;
  switch_status: number;
}

/**
 * 微吼进出房推送的 context。上线、下线共用。
 * context.uv / platform / ver 只在上线样例里出现，下线样例没有这三项。
 * role_name、device_status 上线是字符串（"2" / "1"），下线是数字（2 / 1）。
 * 这里的 uv/pv 与消息顶层不是同一份数。
 */
interface VhallUserPresenceContext {
  nickname: string;
  avatar: string;
  pv: number;
  uv?: number;
  role_name: string | number;
  device_type: number;
  device_status: string | number;
  audience: boolean;
  kick_id: string;
  kick_mark: string;
  is_banned: number;
  privacies: string;
  groupInitData: VhallUserPresenceGroupInit;
  platform?: string;
  ver?: string;
}

/** Join 进入，Leave 离开 */
interface VhallUserPresenceData {
  type: "Join" | "Leave";
  hide: number;
  socket_id: string;
}

/**
 * 微吼 `$on("userOnline")` / `$on("userOffline")` 共用回调体。
 * 上线日志「用户上线消息」，下线日志「用户下线事件消息」；service_type 都是 service_online。
 * 用户 id：`sender_id`；时间：`date_time`（yyyy-MM-dd HH:mm:ss）；昵称/头像在 `context`。
 * 进入看 `data.type === "Join"`，离开看 `data.type === "Leave"`。
 * 辅通道 enter/leave 的 `mid` 由前端按 `{activityId}_{userId}_{enterTime|leaveTime到分}` 拼接（去掉秒），不用本消息的 `msg_id`。
 */
interface VhallUserPresenceMessage {
  app_id: string;
  /** 样例为字符串 "1" */
  bu: string;
  channel: string;
  client: string;
  context: VhallUserPresenceContext;
  data: VhallUserPresenceData;
  date_time: string;
  msg_id: string;
  msg_source: string;
  sender_id: string;
  service_type: "service_online";
  uv: number;
  pv: number;
}

/** 微吼 `$on("chatMsg")` 的 context。样例里 nickname 与 nick_name 同值。 */
interface VhallChatMsgContext {
  atList: unknown[];
  replyMsg: Record<string, unknown>;
  avatar: string;
  nickname: string;
  /** 样例为字符串 "2" */
  role_name: string | number;
  user_id: string | number;
  kick_id: string;
  kick_mark: string;
  nick_name: string;
}

/**
 * chatMsg 的 data。样例 type 为 text；现有归一化还接受 image。
 * 正文优先看 text_content，弹幕文案在 barrageTxt。
 */
interface VhallChatMsgData {
  type: "text" | "image" | string;
  image_urls: string[];
  barrageTxt: string;
  text_content: string;
  nick_name: string;
  avatar: string;
}

/**
 * 微吼 `$on("chatMsg")` 回调体（service_type 为 service_im）。
 * 发送者：`sender_id` / `context.user_id`；正文：`data.text_content`；消息 id：`msg_id`。
 */
interface VhallChatMsgMessage {
  app_id: string;
  /** 样例为字符串 "1" */
  bu: string;
  channel: string;
  client: string;
  context: VhallChatMsgContext;
  data: VhallChatMsgData;
  date_time: string;
  msg_id: string;
  msg_source: string;
  sender_id: string;
  service_type: "service_im";
  uv: number;
  pv: number;
}

/** 弹幕设置：positionRange 为 [上,下] 占比区间，speed 单位 ms，style.opacity 0-100 */
interface BarrageInfo {
  position?: 0 | 1 | 2 | 3;
  positionRange?: [number, number];
  speed?: number;
  style?: { fontSize?: number; opacity?: number; color?: string };
  alpha?: number;
  fontsize?: number;
  color?: string;
}

interface VhallSdkInstance {
  $on(event: "userOnline" | "userOffline", handler: (data: VhallUserPresenceMessage) => void): void;
  $on(event: "chatMsg", handler: (data: VhallChatMsgMessage) => void): void;
  $on(event: string, handler: (data: unknown) => void): void;
  destroy?(): void;
  player?: VhallPlayerModule;
  chat: ChatModule;
  openBarrage?(): void;
  closeBarrage?(): void;
  sendBarrage?(text: string): void;
  setBarrageInfo?(opt: BarrageInfo): void;
  vhall_get_live_history_chat_msg(opt: { page: number }): Promise<{ code: number | string; msg?: string; data: VhallHistoryChatItem[] }>;
  vhall_get_history_notice(page: number): Promise<{ code: number | string; data: { data: VhallNoticeItem[] } }>;
  interactTools: InteractTools;
  getRoominfo?(): Promise<{ room_id?: string; roomId?: string; interact?: { room_id?: string } }>;
}

interface VhallSdkConstructor {
  new (options: VhallSdkOptions): VhallSdkInstance;
}

interface Window {
  VhallSDK?: VhallSdkConstructor;
}
