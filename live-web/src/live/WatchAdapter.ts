import type { WatchSdkData } from "@/api/watch";

export interface WatchAdapterHandlers {
  onError: (msg: unknown) => void;
  onRetryableError: (text: string) => void;
  onLiveEnded: () => void;
  onAutoplayFailed: () => void;
  onLiveStart: () => void;
  onChatMsg: (msg: VhallChatMsgMessage) => void;
  onChatDelete: (msg: unknown) => void;
  onDisableChat: () => void;
  onPermitChat: () => void;
  onAnnouncement: (msg: unknown) => void;
  onOnlinePopulation: (msg: unknown) => void;
  onPraiseTotal: (msg: unknown) => void;
  onUserOnline: (msg: VhallUserPresenceMessage) => void;
  onUserOffline: (msg: VhallUserPresenceMessage) => void;
  /** 用于 chat.loadHistory / stats.scheduleRoomId / player polls */
  afterInit: () => void;
  /**
   * 脚本加载等异步间隙后仍应继续 init 时返回 true。
   * 上层换场次 / 重入 load 时应失效，避免对已卸载的 #player 执行 new。
   */
  isInitCurrent?: () => boolean;
}

export interface WatchAdapter {
  /** 返回底层 SDK 实例，供现有 useChat/useBarrage 等 getSdk 使用；未接入可为 null */
  getSdk(): VhallSdkInstance | null;
  init(data: WatchSdkData, handlers: WatchAdapterHandlers): Promise<void>;
  destroy(): void;
}
