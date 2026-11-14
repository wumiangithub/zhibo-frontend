/** 微吼 SDK 类型（对照 live-web/src/vite-env.d.ts；中控台播放器/聊天用） */
interface VhallSdkOptions {
  app_key: string;
  signedat: string;
  webinar_id: string | number;
  email: string;
  username: string;
  /** 观众头像 URL；无头像为 ""。仅非空参与签名；init 原样传（空串即可） */
  head: string;
  sign: string;
  sign_type?: number;
  videoContent: string;
  docContent: string;
}

interface ChatMessage {
  sender_id: string;
  sender_name: string;
  /** 文本正文；纯图片消息可为空串 */
  msg: string;
  msgId?: string;
  /** 本站 room_comment.id；本次发送上报成功后才有，供本场软删 */
  commentId?: number;
  /** 聊天附带图片（微吼 data.image_urls / img_urls，已规范化） */
  imageUrls?: string[];
  /** 发送者头像 URL；空则 UI 用占位 */
  avatar?: string;
  /**
   * 微吼聊天角色 role_name：1 主持人 / 2 观众 / 3 助理 / 4 嘉宾。
   * 与 get-role-url 的 type 枚举不同。
   */
  role_name?: 1 | 2 | 3 | 4;
  /** @deprecated 用 role_name === 1；保留给旧模板兼容 */
  is_host?: boolean;
  timestamp: number;
  /**
   * 本站观众数字 id（由聊天 email / 第三方账号按 D85 邮箱规则解析）。
   * 仅观众形态；员工 e… / 游客不设。用于讨论区「我的用户 / 指定跟进人」映射。
   */
  viewerUserId?: string;
  /**
   * 回复引用（被回复人）。来自 context.replyMsg / reply_msg；
   * 无有效 content 时不设。纯图片原文用「[图片]」。
   * msgId：被回复消息 id，昵称缺失时可在列表内回填。
   */
  reply?: { nickname: string; content: string; msgId?: string };
  /** 提问 / 优惠券 / 系统消息。普通聊天不设。 */
  kind?: "question" | "coupon" | "system";
  /** 主持人对该提问的回复 */
  answer?: { nickname: string; content: string; roleLabel?: string };
  /** 优惠券卡片（kind=coupon；D113） */
  coupon?: {
    couponId: number;
    couponNo?: string;
    couponName: string;
    couponAmount: string;
    couponStartDate?: string;
    couponEndDate?: string;
    employeeId?: number;
    deptId?: number;
    deptName?: string;
  };
}

interface ChatModule {
  sendChat(msg: string): void;
  /** 官方文档：发送自定义消息，返回 Promise */
  sendCustomEvent(msg: { type: string; data: unknown }): Promise<unknown>;
  /**
   * 3.x demo 的提问入口。本站优先调实例上的 sendQuestion，没有再走这里。
   * 参数为提问文本，≤140。
   */
  sendQuestion?(content: string): Promise<unknown> | void;
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

/**
 * 官方 demo 竖屏播控用的内部模块（未全文档化）。
 * 本站：play/pause + state.isPlaying；清晰度优先 getQualitys/setQuality
 *（原生控制条已 removeChild，文档 setPlayerDefinition 会写空 DOM）。
 */
interface VhallPlayerServerState {
  isPlaying?: boolean;
  isMuted?: boolean;
}

/** playerServer.getQualitys / setQuality 项；至少含 def（same / 720p / a …） */
interface VhallQualityItem {
  def: string;
  [key: string]: unknown;
}

interface VhallPlayerServer {
  state?: VhallPlayerServerState;
  play?(): void;
  pause?(): void;
  getQualitys?(): VhallQualityItem[];
  getCurrentQuality?(): VhallQualityItem | null | undefined;
  setQuality?(item: VhallQualityItem, onError?: (err: unknown) => void): void;
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
 * 本站认人读顶层 `email`（D85），不读 `sender_id`（微吼访客 id，样例 `visit_v…`）。
 * 时间：`date_time`（yyyy-MM-dd HH:mm:ss）；昵称/头像在 `context`。
 * 进入看 `data.type === "Join"`，离开看 `data.type === "Leave"`。
 * 这些推送只给中控台本地改名单展示；落库走微吼回调，不由前端上报。
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
  /** 观看签名邮箱。中控台据此解析 userId；缺失或对不上三种形态则忽略本条。 */
  email?: string;
  service_type: "service_online";
  uv: number;
  pv: number;
}

/**
 * 微吼回复引用体（context.replyMsg / reply_msg）。
 * get-list 样例：nick_name + content.text_content；空回复为 {} 或 []。
 * chatServer 归一化后多为 camelCase replyMsg，顶层也可能挂同形对象。
 */
interface VhallChatReplyMsg {
  nick_name?: string;
  nickname?: string;
  /** chatServer / 部分实时包 camelCase */
  nickName?: string;
  user_name?: string;
  type?: string;
  content?:
    | string
    | {
        text_content?: string;
        barrage_txt?: string;
        barrageTxt?: string;
        type?: string;
        nick_name?: string;
        nickname?: string;
        nickName?: string;
        image_urls?: string[];
        img_urls?: string[];
      };
  image_urls?: string[];
  img_urls?: string[];
  [key: string]: unknown;
}

/** 微吼 `$on("chatMsg")` 的 context。样例里 nickname 与 nick_name 同值。 */
interface VhallChatMsgContext {
  atList: unknown[];
  /** 实时 chatMsg / chatServer 多为 camelCase；历史 get-list 常见 reply_msg */
  replyMsg: VhallChatReplyMsg | Record<string, unknown> | unknown[];
  reply_msg?: VhallChatReplyMsg | Record<string, unknown> | unknown[];
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
  /** 观看签名邮箱；历史 get-list / 实时包偶发带，供讨论区跟进人映射 */
  email?: string;
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
  /** 发送自定义消息回执（官方：$on('sendCustomEvent')） */
  $on(event: "sendCustomEvent", handler: (data: unknown) => void): void;
  /** 自定义广播（官方：$on('customEvent')，与 chat.sendCustomEvent 对应） */
  $on(event: "customEvent", handler: (data: unknown) => void): void;
  $on(event: string, handler: (data: unknown) => void): void;
  destroy?(): void;
  player?: VhallPlayerModule;
  /**
   * demo Stream/Player 播控主路径（play / state.isPlaying）。
   * 可选；缺失时回退 `player.play/pause` 再回退 HTMLMediaElement。
   */
  playerServer?: VhallPlayerServer;
  chat: ChatModule;
  openBarrage?(): void;
  closeBarrage?(): void;
  sendBarrage?(text: string): void;
  setBarrageInfo?(opt: BarrageInfo): void;
  vhall_get_live_history_chat_msg(opt: { page: number }): Promise<{ code: number | string; msg?: string; data: VhallHistoryChatItem[] }>;
  /** 提交问答提问。文本 ≤140，返回 Promise */
  sendQuestion?(content: string): Promise<unknown>;
  /** 直播中的历史提问。demo 无参，成功体为列表或 { data: 列表 } */
  vhall_get_live_history_question_msg?(): Promise<unknown>;
  vhall_get_history_notice(page: number): Promise<{ code: number | string; data: { data: VhallNoticeItem[] } }>;
  interactTools: InteractTools;
  /** 官方 Praise demo：`jssdk.config.lssRoomId` 即互动 room_id */
  config?: { lssRoomId?: string };
  /** 进房后 watchInit 里也可能带 interact.room_id（chat 等同路径） */
  roomBaseServer?: { state?: { watchInitData?: { interact?: { room_id?: string } } } };
  getRoominfo?(): Promise<{ room_id?: string; roomId?: string; interact?: { room_id?: string } }>;
}

interface VhallSdkConstructor {
  new (options: VhallSdkOptions): VhallSdkInstance;
}

interface Window {
  VhallSDK?: VhallSdkConstructor;
}
