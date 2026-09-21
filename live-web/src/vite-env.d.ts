/// <reference types="vite/client" />

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
  canPlayDefinitions(cb: (list: string[]) => void): void;
  setPlayerDefinition?(value: string): void;
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
