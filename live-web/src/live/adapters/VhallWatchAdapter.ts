import type { WatchSdkSignData } from "@/api/watch";
import {
  formatSdkError,
  isHardFatalSdkError,
  isRetryableSdkError,
  loadScript,
} from "@/utils/sdk";
import type { WatchAdapter, WatchAdapterHandlers } from "../WatchAdapter";

/** 微吼 JSSDK 3.9.1 CDN（D93：前端常量，不进 /sdk-sign） */
const VHALL_SDK_SCRIPT_URL = "https://cnstatic01.e.vhall.com/jssdk/dist/3.9.1/VhallSDK.js";

/** 微吼自带隐藏控制条 class（官方拼写即为 hiddne，非 typo） */
const HIDDNE_CONTROL_CLASS = "hiddneControl";

/** 对齐 demo：playerReady 后再动 DOM，等控制条插完 */
const REMOVE_NATIVE_CONTROL_DELAY_MS = 50;

/** 微吼观看适配器：脚本加载、VhallSDK init/destroy、事件绑定 */
export class VhallWatchAdapter implements WatchAdapter {
  private sdk: VhallSdkInstance | null = null;
  /** playerReady 一次性拆条定时器；destroy 时清掉 */
  private removeNativeControlTimer: ReturnType<typeof setTimeout> | null = null;
  /** 本会话是否已按 demo 拆过原生底栏（一次性） */
  private nativeControlsRemoved = false;

  getSdk(): VhallSdkInstance | null {
    return this.sdk;
  }

  async init(data: WatchSdkSignData, handlers: WatchAdapterHandlers): Promise<void> {
    await loadScript(VHALL_SDK_SCRIPT_URL);

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
      // 签名里含 email。有观众 id 时已是 {id}@qkzb.com；换账号必须重新拉签名再 new，不能只改这一字段
      email: data.sdk.email,
      username: data.sdk.username,
      // 无头像也要传空串，且必须与签名时的 head 一致
      head: data.sdk.head ?? "",
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
    this.sdk.$on("question_answer_create", (msg: unknown) => {
      console.log(`[vhall-sdk] question_answer_create @ ${new Date().toISOString()}`, msg);
      handlers.onQuestion?.(msg);
    });
    this.sdk.$on("question_answer_commit", (msg: unknown) => {
      console.log(`[vhall-sdk] question_answer_commit @ ${new Date().toISOString()}`, msg);
      handlers.onQuestion?.(msg);
    });
    this.sdk.$on("question_answer_backout", (msg: unknown) => {
      console.log(`[vhall-sdk] question_answer_backout @ ${new Date().toISOString()}`, msg);
      handlers.onQuestionBackout?.(msg);
    });
    // 联调 chat.sendCustomEvent：官方文档回执 + 广播
    this.sdk.$on("sendCustomEvent", (msg: unknown) => {
      console.log(`[vhall-sdk] sendCustomEvent @ ${new Date().toISOString()}`, msg);
    });
    this.sdk.$on("customEvent", (msg: unknown) => {
      console.log(`[vhall-sdk] customEvent @ ${new Date().toISOString()}`, msg);
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

    // 藏原生控制条：对齐 demo Player — playerReady 后 setTimeout(50) 再 removeChild；
    // 次要：vhallplay_LOADED 若更早且尚未拆过则同路径一次。无 MutationObserver。
    // hiddneControl 作辅；PlayerStage :deep CSS 仅防闪。
    this.sdk.$on("moduleReady", () => {
      this.applyHiddneControl();
      // 对齐 demo：isModuleReady 后再拉历史/房间信息；勿在 new 后立刻调
      handlers.onModuleReady?.();
    });
    this.sdk.$on("playerReady", () => {
      this.scheduleRemoveNativeControls();
      handlers.onPlayerReady?.();
    });
    this.sdk.$on("vhallplay_LOADED", () => {
      this.scheduleRemoveNativeControls();
      handlers.onPlayerLoaded?.();
    });
    this.applyHiddneControl();

    handlers.afterInit();
  }

  destroy(): void {
    this.clearRemoveNativeControlTimer();
    this.nativeControlsRemoved = false;
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
   * 给壳 / shadow 加 SDK 自带 hiddneControl（辅路径；不覆盖 .vh-player-controller）。
   * 主路径仍是 removeNativeControls 拆节点。
   */
  private applyHiddneControl(): void {
    document
      .querySelectorAll("#player .vhallPlayer-container, #player .vhallPlayerh5-shadow")
      .forEach((el) => el.classList.add(HIDDNE_CONTROL_CLASS));
  }

  /** 对齐 demo：就绪后延迟再拆，幂等，会话内只跑一轮 */
  private scheduleRemoveNativeControls(): void {
    if (this.nativeControlsRemoved) return;
    this.clearRemoveNativeControlTimer();
    this.removeNativeControlTimer = setTimeout(() => {
      this.removeNativeControlTimer = null;
      this.removeNativeControls();
    }, REMOVE_NATIVE_CONTROL_DELAY_MS);
  }

  /**
   * 对齐官方 demo 竖屏路径：removeChild `.vh-player-controller` / `.vh-player-record-control`。
   * 本站底栏全自建，一律拆；CSS 仅兜底闪一下。
   */
  private removeNativeControls(): void {
    if (this.nativeControlsRemoved) return;
    this.applyHiddneControl();
    document
      .querySelectorAll("#player .vh-player-controller, #player .vh-player-record-control")
      .forEach((el) => {
        el.parentNode?.removeChild(el);
      });
    this.nativeControlsRemoved = true;
  }

  private clearRemoveNativeControlTimer(): void {
    if (this.removeNativeControlTimer) {
      clearTimeout(this.removeNativeControlTimer);
      this.removeNativeControlTimer = null;
    }
  }
}
