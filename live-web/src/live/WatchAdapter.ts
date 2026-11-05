import type { WatchSdkSignData } from "@/api/watch";

export interface WatchAdapterHandlers {
  onError: (msg: unknown) => void;
  onRetryableError: (text: string) => void;
  onLiveEnded: () => void;
  onAutoplayFailed: () => void;
  onLiveStart: () => void;
  onChatMsg: (msg: VhallChatMsgMessage) => void;
  onChatDelete: (msg: unknown) => void;
  /** 微吼提问：question_answer_create / question_answer_commit */
  onQuestion?: (msg: unknown) => void;
  /** 微吼撤回提问回复：question_answer_backout */
  onQuestionBackout?: (msg: unknown) => void;
  onDisableChat: () => void;
  onPermitChat: () => void;
  onAnnouncement: (msg: unknown) => void;
  onOnlinePopulation: (msg: unknown) => void;
  onPraiseTotal: (msg: unknown) => void;
  onUserOnline: (msg: VhallUserPresenceMessage) => void;
  onUserOffline: (msg: VhallUserPresenceMessage) => void;
  /**
   * `new VhallSDK` 并完成事件绑定后的安全收尾（如 startPlayPoll）。
   * 不要在此拉聊天/公告历史、getRoominfo、canPlayDefinitions 等会碰房间信息的 API。
   */
  afterInit: () => void;
  /**
   * 官方 `moduleReady`：模块就绪后再拉历史/房间信息等（对齐 demo `isModuleReady`）。
   */
  onModuleReady?: () => void;
  /**
   * 官方 `playerReady`：播放器初始化成功（见微吼 events；demo 用它置 videoIsReady / 绑 isPlaying）。
   * 上层应优先据此推进自建底栏就绪，并尝试 watch `playerServer.state.isPlaying`；
   * 若当时 #player 内尚无 media，可短 burst 轮询找节点（非常驻扫 DOM）。
   */
  onPlayerReady?: () => void;
  /**
   * 微吼 `vhallplay_LOADED`：视频侧加载完成（demo 多用于关 loading）。
   * 作为 playerReady 的次要信号；无媒体节点时勿当成功。
   */
  onPlayerLoaded?: () => void;
  /**
   * 脚本加载等异步间隙后仍应继续 init 时返回 true。
   * 上层换场次 / 重入 load 时应失效，避免对已卸载的 #player 执行 new。
   */
  isInitCurrent?: () => boolean;
}

export interface WatchAdapter {
  /** 返回底层 SDK 实例，供现有 useChat/useBarrage 等 getSdk 使用；未接入可为 null */
  getSdk(): VhallSdkInstance | null;
  init(data: WatchSdkSignData, handlers: WatchAdapterHandlers): Promise<void>;
  destroy(): void;
}
