import { onBeforeUnmount, onMounted, reactive, ref } from "vue";

export interface PlayerControlsOptions {
  getSdk: () => VhallSdkInstance | null;
  /** 非自动播放类的真实错误交给页面显示 */
  onError: (msg: string) => void;
}

function findPlayerMedia(): HTMLMediaElement | null {
  return (
    document.querySelector<HTMLMediaElement>("#player video") ||
    document.querySelector<HTMLMediaElement>("#player audio") ||
    document.querySelector<HTMLMediaElement>("#player-vhall-video")
  );
}

/**
 * 播放器交互补丁：
 * - 进房默认不播放，等用户手势；被自动播放策略拦住时出「点击播放」遮罩
 * - SDK 全屏按钮在无 fullscreen 权限的环境里静默失败，用 fixed 铺满视口兜底
 * - 清晰度下拉文案按 canPlayDefinitions 码值改写，并自己维护选中态
 */
export function usePlayerControls(options: PlayerControlsOptions) {
  const { getSdk, onError } = options;

  const player = reactive({
    needsTapToPlay: false,
    /** SDK 的全屏被拒绝时的 CSS 兜底 */
    pseudoFullscreen: false,
    /** SDK 控制栏 DOM，异步生成；Teleport 把互动按钮挂进去 */
    controllerEl: ref<HTMLElement | null>(null),
  });

  let playPollTimer: ReturnType<typeof setInterval> | null = null;
  let playInProgress = false;
  // 用户是否主动点过播放；进房默认不播放，SDK 自行起播也要暂停等用户点击
  let playRequested = false;
  let disposed = false;
  /** SDK 文案（480p 等）→ 展示文案（高清 等），loadQualityLabels 填充 */
  const qualityLabelMap: Record<string, string> = {};

  function applyPseudoFullscreen(on: boolean) {
    if (player.pseudoFullscreen === on) return;
    player.pseudoFullscreen = on;
    // 容器尺寸变了，通知播放器重新布局（弹幕层等按 window resize 计算）
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
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

  /** 按文档 canPlayDefinitions 的码值改写下拉文案：same=原画、a=音频，其余按档位叫 高清/标清/流畅 */
  function loadQualityLabels() {
    const playerMod = getSdk()?.player;
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

  function syncControllerEl() {
    player.controllerEl = document.querySelector<HTMLElement>("#player .vh-player-controller");
  }

  /** 播放器就绪前 canPlayDefinitions 会抛错/不回调，轮询重试直到拿到码值 */
  function scheduleQualityLabels(tries = 0) {
    window.setTimeout(() => {
      if (disposed) return;
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
          player.needsTapToPlay = true;
          stopPlayPoll();
          return;
        }
        // readyState>=2 有数据但仍 paused → 多半被自动播放策略拦住
        if (media.paused && media.readyState >= 2) {
          player.needsTapToPlay = true;
          stopPlayPoll();
          return;
        }
        if (!media.paused) {
          player.needsTapToPlay = false;
          stopPlayPoll();
          return;
        }
      }
      if (tries >= 40) {
        // 约 20s 仍无播放，仍提示点击（语音直播尤其需要）
        player.needsTapToPlay = true;
        stopPlayPoll();
      }
    }, 500);
  }

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
        player.needsTapToPlay = true;
        return;
      }
      // 源还在加载时 play() 会被随后的 load 打断（AbortError），等有了源再播
      for (let i = 0; i < 30 && media.readyState === 0 && !media.currentSrc; i++) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      media.muted = false;
      media.volume = Math.max(media.volume, 0.5);
      await media.play();
      player.needsTapToPlay = false;
    } catch (e) {
      player.needsTapToPlay = true;
      // 自动播放被策略拦截、或 play 被换源打断都是可重试的常态，只出“点击播放”遮罩，不弹错误横幅
      const benign =
        e instanceof DOMException
          ? e.name === "AbortError" || e.name === "NotAllowedError"
          : e instanceof Error && e.message.includes("interrupted");
      if (!benign) {
        onError(e instanceof Error ? e.message : "无法自动播放，请再点一次「点击收听」");
      }
    } finally {
      playInProgress = false;
    }
  }

  /** SDK 明确告知自动播放失败，比轮询更准 */
  function notifyAutoplayFailed() {
    player.needsTapToPlay = true;
  }

  /** 重建播放器（如切到结束态）前复位手势状态 */
  function resetPlayback() {
    stopPlayPoll();
    playRequested = false;
    player.needsTapToPlay = false;
  }

  onMounted(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    disposed = true;
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("keydown", handleGlobalKeydown);
    stopPlayPoll();
  });

  return Object.assign(player, {
    resumePlayback,
    startPlayPoll,
    stopPlayPoll,
    resetPlayback,
    notifyAutoplayFailed,
    handlePlayerClick,
    syncControllerEl,
    scheduleQualityLabels,
  });
}

export type PlayerController = ReturnType<typeof usePlayerControls>;
