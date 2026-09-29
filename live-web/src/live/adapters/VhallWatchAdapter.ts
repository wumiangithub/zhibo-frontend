import type { WatchSdkData } from "@/api/watch";
import {
  formatSdkError,
  isHardFatalSdkError,
  isRetryableSdkError,
  loadScript,
} from "@/utils/sdk";
import type { WatchAdapter, WatchAdapterHandlers } from "../WatchAdapter";

/** 微吼观看适配器：脚本加载、VhallSDK init/destroy、事件绑定 */
export class VhallWatchAdapter implements WatchAdapter {
  private sdk: VhallSdkInstance | null = null;

  getSdk(): VhallSdkInstance | null {
    return this.sdk;
  }

  async init(data: WatchSdkData, handlers: WatchAdapterHandlers): Promise<void> {
    if (data.sdk.jqueryUrl) {
      await loadScript(data.sdk.jqueryUrl);
    }
    await loadScript(data.sdk.scriptUrl);

    if (!window.VhallSDK) {
      throw new Error("SDK 加载异常，未找到 VhallSDK（需 3.9.1）");
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
    this.sdk.$on("live_over", handlers.onLiveEnded);
    this.sdk.$on("streamOver", handlers.onLiveEnded);

    this.sdk.$on("vhallplay_AUTOPLAY_FAILED", handlers.onAutoplayFailed);
    this.sdk.$on("chatMsg", handlers.onChatMsg);
    this.sdk.$on("chatDelete", handlers.onChatDelete);
    this.sdk.$on("disableChat", handlers.onDisableChat);
    this.sdk.$on("permitChat", handlers.onPermitChat);
    this.sdk.$on("room_announcement", handlers.onAnnouncement);
    this.sdk.$on("live_start", handlers.onLiveStart);
    this.sdk.$on("onlinePopulation", handlers.onOnlinePopulation);
    this.sdk.$on("EVENT_PRAISE_TOTAL", handlers.onPraiseTotal);

    // 调试：进出房事件，看微吼回调结构（正式逻辑后续再接）
    this.sdk.$on("userOnline", (data: unknown) => {
      console.log("[vhall] userOnline", data);
    });
    this.sdk.$on("userOffline", (data: unknown) => {
      console.log("[vhall] userOffline", data);
    });

    handlers.afterInit();
  }

  destroy(): void {
    if (this.sdk?.destroy) {
      try {
        this.sdk.destroy();
      } catch {
        /* ignore */
      }
    }
    this.sdk = null;
  }
}
