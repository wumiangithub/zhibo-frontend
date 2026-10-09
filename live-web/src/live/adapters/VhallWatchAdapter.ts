import type { WatchSdkData } from "@/api/watch";
import {
  formatSdkError,
  isHardFatalSdkError,
  isRetryableSdkError,
  loadScript,
} from "@/utils/sdk";
import type { WatchAdapter, WatchAdapterHandlers } from "../WatchAdapter";

/** 微吼自带隐藏控制条 class（官方拼写即为 hiddne，非 typo） */
const HIDDNE_CONTROL_CLASS = "hiddneControl";

/** MutationObserver 兜底最长观察时间：容器异步插入后事件可能已错过 */
const HIDE_CONTROL_OBSERVER_MS = 8000;

/** 微吼观看适配器：脚本加载、VhallSDK init/destroy、事件绑定 */
export class VhallWatchAdapter implements WatchAdapter {
  private sdk: VhallSdkInstance | null = null;
  private hideControlObserver: MutationObserver | null = null;
  private hideControlTimer: ReturnType<typeof setTimeout> | null = null;

  getSdk(): VhallSdkInstance | null {
    return this.sdk;
  }

  async init(data: WatchSdkData, handlers: WatchAdapterHandlers): Promise<void> {
    if (data.sdk.jqueryUrl) {
      await loadScript(data.sdk.jqueryUrl);
    }
    await loadScript(data.sdk.scriptUrl);

    // loadScript 可能耗时数秒；期间 load/卸页会使容器消失，new 前必须再确认
    if (handlers.isInitCurrent && !handlers.isInitCurrent()) {
      return;
    }

    if (!window.VhallSDK) {
      throw new Error("SDK 加载异常，未找到 VhallSDK（需 3.9.1）");
    }

    if (!document.querySelector("#player") || !document.querySelector("#docWrap")) {
      throw new Error("播放器容器未就绪（#player / #docWrap）");
    }

    this.sdk = new window.VhallSDK({
      app_key: data.sdk.appKey,
      signedat: data.sdk.signedAt,
      webinar_id: data.sdk.webinarId,
      email: data.sdk.email,
      username: data.sdk.username,
      sign: data.sdk.sign,
      sign_type: data.sdk.signType ?? 0,
      videoContent: "#player",
      docContent: "#docWrap",
    });

    if (handlers.isInitCurrent && !handlers.isInitCurrent()) {
      this.destroy();
      return;
    }

    // 硬失败立刻提示；20005/20006 联调常为瞬时，交由上层重拉签名再 init
    this.sdk.$on("error", (msg: unknown) => {
      const text = formatSdkError(msg);
      console.warn("SDK 运行时错误:", text, msg);
      if (isHardFatalSdkError(msg)) {
        handlers.onError(msg);
        return;
      }
      if (isRetryableSdkError(msg)) {
        handlers.onRetryableError(text);
      }
    });

    // 官方：H5 活动直播结束 → live_over；streamOver 为旧 Flash 事件，一并听作兜底
    // 日志前缀统一 [vhall-sdk]，方便和控制台里的用户上下线推送对比先后
    this.sdk.$on("live_over", (data) => {
      console.log(`[vhall-sdk] live_over @ ${new Date().toISOString()}`, data);
      handlers.onLiveEnded();
    });
    this.sdk.$on("streamOver", (data) => {
      console.log(`[vhall-sdk] streamOver @ ${new Date().toISOString()}`, data);
      handlers.onLiveEnded();
    });

    this.sdk.$on("vhallplay_AUTOPLAY_FAILED", handlers.onAutoplayFailed);
    this.sdk.$on("chatMsg", (msg: VhallChatMsgMessage) => {
      console.log(`[vhall-sdk] chatMsg @ ${new Date().toISOString()}`, msg);
      handlers.onChatMsg(msg);
    });
    this.sdk.$on("chatDelete", handlers.onChatDelete);
    this.sdk.$on("disableChat", handlers.onDisableChat);
    this.sdk.$on("permitChat", handlers.onPermitChat);
    this.sdk.$on("room_announcement", handlers.onAnnouncement);
    this.sdk.$on("live_start", handlers.onLiveStart);
    this.sdk.$on("onlinePopulation", handlers.onOnlinePopulation);
    this.sdk.$on("EVENT_PRAISE_TOTAL", handlers.onPraiseTotal);

    this.sdk.$on("userOnline", (msg: VhallUserPresenceMessage) => {
      console.log(`[vhall-sdk] userOnline @ ${new Date().toISOString()}`, msg);
      handlers.onUserOnline(msg);
    });
    this.sdk.$on("userOffline", (msg: VhallUserPresenceMessage) => {
      console.log(`[vhall-sdk] userOffline @ ${new Date().toISOString()}`, msg);
      handlers.onUserOffline(msg);
    });

    // 隐藏控制条：SDK 自带 .hiddneControl（拼写即为 hiddne）+ 显式藏 .vh-player-controller。
    // moduleReady=模块就绪、vhallplay_LOADED=视频加载完；二者先后不定且可能只来其一，都听并幂等。
    // 容器/控制条由 SDK 异步插入，事件可能早于 DOM，故短时 MutationObserver 兜底；destroy 时断开防泄漏。
    this.sdk.$on("moduleReady", () => {
      this.applyHiddneControl();
      // 对齐 demo：isModuleReady 后再拉历史/房间信息；勿在 new 后立刻调
      handlers.onModuleReady?.();
    });
    this.sdk.$on("vhallplay_LOADED", () => {
      this.applyHiddneControl();
      handlers.onPlayerLoaded?.();
    });
    this.applyHiddneControl();
    this.armHideControlObserver();

    handlers.afterInit();
  }

  destroy(): void {
    this.stopHideControlObserver();
    if (this.sdk?.destroy) {
      try {
        this.sdk.destroy();
      } catch {
        /* ignore */
      }
    }
    this.sdk = null;
    // SPA 重入 init 前清空容器，避免残留节点叠在二次 new 上（整页刷新本身已干净）
    const playerEl = document.querySelector("#player");
    const docEl = document.querySelector("#docWrap");
    if (playerEl) playerEl.innerHTML = "";
    if (docEl) docEl.innerHTML = "";
  }

  /**
   * 1) 给壳 / shadow 加 SDK 自带 hiddneControl（不覆盖 .vh-player-controller）
   * 2) 显式 display:none 原生底栏（暂停时 SDK 常再插/再显该节点；PlayerStage 另有 :deep CSS）
   * classList / style 均幂等；持久隐藏靠 CSS，此处配合 MutationObserver 在 SDK 重插时再刷一次
   */
  private applyHiddneControl(): void {
    document
      .querySelectorAll("#player .vhallPlayer-container, #player .vhallPlayerh5-shadow")
      .forEach((el) => el.classList.add(HIDDNE_CONTROL_CLASS));
    document
      .querySelectorAll("#player .vh-player-controller, #player .vh-player-record-control")
      .forEach((el) => {
        (el as HTMLElement).style.setProperty("display", "none", "important");
      });
  }

  private armHideControlObserver(): void {
    this.stopHideControlObserver();
    const root = document.querySelector("#player");
    if (!root) return;
    this.hideControlObserver = new MutationObserver(() => this.applyHiddneControl());
    this.hideControlObserver.observe(root, { childList: true, subtree: true });
    // 固定观察窗口：勿在仅挂上 hiddneControl 后立刻停，控制条可能晚于壳插入
    this.hideControlTimer = setTimeout(() => this.stopHideControlObserver(), HIDE_CONTROL_OBSERVER_MS);
  }

  private stopHideControlObserver(): void {
    if (this.hideControlTimer) {
      clearTimeout(this.hideControlTimer);
      this.hideControlTimer = null;
    }
    this.hideControlObserver?.disconnect();
    this.hideControlObserver = null;
  }
}
