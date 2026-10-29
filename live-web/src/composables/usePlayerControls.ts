import { onBeforeUnmount, onMounted, reactive } from "vue";

export interface PlayerControlsOptions {
  getSdk: () => VhallSdkInstance | null;
  /** 非自动播放类的真实错误交给页面显示 */
  onError: (msg: string) => void;
  /** 用户真正起播（含点「点击播放」）。回放上报 start 挂这里。 */
  onUserPlay?: () => void;
  /** 暂停。回放心跳挂这里。 */
  onUserPause?: () => void;
  /** 播完。回放心跳后结束本行。 */
  onMediaEnded?: () => void;
}

export interface QualityOption {
  code: string;
  label: string;
}

function findPlayerMedia(): HTMLMediaElement | null {
  return (
    document.querySelector<HTMLMediaElement>("#player video") ||
    document.querySelector<HTMLMediaElement>("#player audio") ||
    document.querySelector<HTMLMediaElement>("#player-vhall-video")
  );
}

/** 联调日志用：分别探测 #player 内 video / audio / #player-vhall-video */
function inspectPlayerMediaPresence() {
  return {
    video: !!document.querySelector("#player video"),
    audio: !!document.querySelector("#player audio"),
    vhallVideo: !!document.querySelector("#player-vhall-video"),
  };
}

/** same=原画、a=音频，其余数字档按从高到低叫 高清/标清/流畅 */
function codesToQualityOptions(list: string[]): QualityOption[] {
  const numeric = list
    .map((c) => c.replace(/\D/g, ""))
    .filter((n) => n !== "")
    .sort((a, b) => Number(b) - Number(a));
  const rankNames = ["高清", "标清", "流畅"];
  return list.map((code) => {
    const digits = code.replace(/\D/g, "");
    let label: string;
    if (code === "same") label = "原画";
    else if (code === "a") label = "音频";
    else if (digits) label = rankNames[numeric.indexOf(digits)] || `${digits}p`;
    else label = code;
    return { code, label };
  });
}

/**
 * 播放器交互（自建底栏，不依赖微吼 `.vh-player-controller`）：
 * - 等 `<video>` 出现后再出「点击播放」；过早点击会因 await 丢掉用户手势
 * - 直播中微吼常不提供暂停，学员/助理用自建暂停/继续（直操作 media）
 * - 清晰度走文档 `player` API；音量/静音只走 HTMLMediaElement（不调 setMute/getVolume）
 * - 全屏优先舞台 requestFullscreen，失败伪全屏
 */
export function usePlayerControls(options: PlayerControlsOptions) {
  const { getSdk, onError } = options;

  const player = reactive({
    needsTapToPlay: false,
    waitingForMedia: false,
    mediaFailed: false,
    failReason: "",
    isPaused: false,
    /** SDK 的全屏被拒绝时的 CSS 兜底（作用在舞台根，含自建底栏） */
    pseudoFullscreen: false,
    isFullscreen: false,
    qualityOptions: [] as QualityOption[],
    currentQualityCode: "",
    /** 音量 0～100，与 media.volume 同步（非 SDK getVolume） */
    volume: 50,
    muted: false,
  });

  let playPollTimer: ReturnType<typeof setInterval> | null = null;
  let mediaStateTimer: ReturnType<typeof setInterval> | null = null;
  let playInProgress = false;
  let playRequested = false;
  let userPaused = false;
  let disposed = false;
  let boundMedia: HTMLMediaElement | null = null;
  let stageEl: HTMLElement | null = null;
  let volumeBeforeMute = 50;
  /** 拖拽滑条期间禁止 sync 回写，避免 UI 被瞬时旧值拽回中间 */
  let volumeDragging = false;

  function applyPausedUi(paused: boolean) {
    if (player.waitingForMedia || player.mediaFailed) {
      player.isPaused = paused;
      return;
    }
    if (!playRequested) {
      player.isPaused = true;
      player.needsTapToPlay = true;
      return;
    }
    player.isPaused = paused;
    player.needsTapToPlay = paused;
  }

  function onMediaPlay() {
    if (!playRequested) {
      applyPausedUi(true);
      return;
    }
    applyPausedUi(false);
    userPaused = false;
    options.onUserPlay?.();
  }

  function onMediaPause() {
    if (player.waitingForMedia) return;
    applyPausedUi(true);
    if (playRequested) {
      userPaused = true;
      options.onUserPause?.();
    }
  }

  function onMediaEnded() {
    options.onMediaEnded?.();
  }

  function unbindMediaEvents() {
    if (!boundMedia) return;
    boundMedia.removeEventListener("play", onMediaPlay);
    boundMedia.removeEventListener("pause", onMediaPause);
    boundMedia.removeEventListener("ended", onMediaEnded);
    boundMedia = null;
  }

  function bindMediaEvents(media: HTMLMediaElement) {
    if (boundMedia === media) return;
    unbindMediaEvents();
    boundMedia = media;
    media.addEventListener("play", onMediaPlay);
    media.addEventListener("pause", onMediaPause);
    media.addEventListener("ended", onMediaEnded);
    if (!player.waitingForMedia) applyPausedUi(media.paused);
  }

  function bindStageEl(el: HTMLElement | null) {
    stageEl = el;
  }

  function applyPseudoFullscreen(on: boolean) {
    const changed = player.pseudoFullscreen !== on;
    player.pseudoFullscreen = on;
    player.isFullscreen = on || !!document.fullscreenElement;
    if (!changed) return;
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function syncVolumeFromMedia() {
    if (volumeDragging) return;
    const media = findPlayerMedia();
    if (!media) return;
    player.muted = media.muted || media.volume === 0;
    player.volume = Math.round((media.muted ? 0 : media.volume) * 100);
  }

  function setVolume(level: number) {
    const v = Math.max(0, Math.min(100, Math.round(level)));
    player.volume = v;
    player.muted = v === 0;
    if (v > 0) volumeBeforeMute = v;
    const media = findPlayerMedia();
    if (!media) return;
    media.volume = v / 100;
    media.muted = v === 0;
  }

  function beginVolumeDrag() {
    volumeDragging = true;
  }

  /** 把当前 UI 音量写回 media（拖拽松手后对齐一次） */
  function applyMediaVolumeFromState() {
    const media = findPlayerMedia();
    if (!media) return;
    const v = player.volume;
    const muted = player.muted || v === 0;
    media.muted = muted;
    media.volume = muted ? 0 : Math.max(0, Math.min(1, v / 100));
  }

  function endVolumeDrag() {
    if (!volumeDragging) return;
    volumeDragging = false;
    applyMediaVolumeFromState();
  }

  function toggleMute() {
    if (player.muted || player.volume === 0) {
      setVolume(volumeBeforeMute > 0 ? volumeBeforeMute : 50);
    } else {
      volumeBeforeMute = player.volume > 0 ? player.volume : 50;
      setVolume(0);
    }
  }

  function loadQualities() {
    const playerMod = getSdk()?.player;
    if (!playerMod?.canPlayDefinitions) return;
    playerMod.canPlayDefinitions((list: string[]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      player.qualityOptions = codesToQualityOptions(list);
      if (!player.currentQualityCode || !list.includes(player.currentQualityCode)) {
        player.currentQualityCode = list.includes("same") ? "same" : list[0];
      }
    });
  }

  /** 播放器就绪前 canPlayDefinitions 会抛错/不回调，轮询重试 */
  function scheduleQualityLabels(tries = 0) {
    window.setTimeout(() => {
      if (disposed) return;
      try {
        loadQualities();
      } catch {
        /* 播放器未就绪 */
      }
      if (player.qualityOptions.length === 0 && tries < 9) {
        scheduleQualityLabels(tries + 1);
      }
    }, 1500);
  }

  function setQuality(code: string) {
    const playerMod = getSdk()?.player;
    if (!playerMod?.setPlayerDefinition) return;
    playerMod.setPlayerDefinition(code);
    player.currentQualityCode = code;
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement) {
      if (player.pseudoFullscreen) player.pseudoFullscreen = false;
      player.isFullscreen = true;
      return;
    }
    player.isFullscreen = player.pseudoFullscreen;
  }

  function enterFullscreen() {
    const el = stageEl;
    if (el && typeof el.requestFullscreen === "function") {
      void el.requestFullscreen().catch(() => applyPseudoFullscreen(true));
      return;
    }
    applyPseudoFullscreen(true);
  }

  function exitFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    player.pseudoFullscreen = false;
    player.isFullscreen = false;
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
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

  function stopMediaStatePoll() {
    if (mediaStateTimer) {
      clearInterval(mediaStateTimer);
      mediaStateTimer = null;
    }
  }

  function startMediaStatePoll() {
    if (mediaStateTimer) return;
    mediaStateTimer = setInterval(() => {
      if (disposed || player.waitingForMedia || player.mediaFailed) return;
      const media = findPlayerMedia();
      if (!media) return;
      bindMediaEvents(media);
      applyPausedUi(media.paused);
      syncVolumeFromMedia();
    }, 500);
  }

  function showTapOverlay() {
    player.waitingForMedia = false;
    player.mediaFailed = false;
    player.failReason = "";
    player.needsTapToPlay = true;
    player.isPaused = true;
    startMediaStatePoll();
  }

  function markMediaFailed(reason = "播放器加载失败") {
    stopPlayPoll();
    player.waitingForMedia = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    player.mediaFailed = true;
    player.failReason = reason;
    stopMediaStatePoll();
  }

  function tryAdvanceMediaReady(media: HTMLMediaElement): boolean {
    bindMediaEvents(media);
    syncVolumeFromMedia();
    if (!playRequested) {
      showTapOverlay();
      stopPlayPoll();
      return true;
    }
    if (userPaused || media.paused) {
      player.waitingForMedia = false;
      player.mediaFailed = false;
      applyPausedUi(true);
      stopPlayPoll();
      startMediaStatePoll();
      return true;
    }
    player.waitingForMedia = false;
    player.mediaFailed = false;
    applyPausedUi(false);
    stopPlayPoll();
    startMediaStatePoll();
    return true;
  }

  function startPlayPoll() {
    stopPlayPoll();
    stopMediaStatePoll();
    player.waitingForMedia = true;
    player.mediaFailed = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    let tries = 0;
    playPollTimer = setInterval(() => {
      tries += 1;
      const media = findPlayerMedia();
      if (media && tryAdvanceMediaReady(media)) return;
      if (tries >= 40) {
        if (!findPlayerMedia()) {
          markMediaFailed("播放器长时间未就绪");
        } else {
          showTapOverlay();
        }
        stopPlayPoll();
      }
    }, 500);
  }

  function onVhallPlayLoaded() {
    const at = new Date().toISOString();
    const presence = inspectPlayerMediaPresence();
    console.log(`[player] vhallplay_LOADED @ ${at}`, presence);
    const media = findPlayerMedia();
    if (!media) {
      console.warn(
        `[player] vhallplay_LOADED @ ${at} 已回调但 #player 内未找到 video/audio/#player-vhall-video，不推进就绪（继续轮询）`,
        presence,
      );
      return;
    }
    if (tryAdvanceMediaReady(media)) {
      console.log(`[player] vhallplay_LOADED @ ${at} 已找到媒体并推进就绪`, presence);
    } else {
      console.warn(
        `[player] vhallplay_LOADED @ ${at} 已找到媒体但尚未可决出播放态（readyState/paused），继续轮询`,
        { presence, paused: media.paused, readyState: media.readyState },
      );
    }
  }

  async function resumePlayback() {
    if (playInProgress) return;
    const media = findPlayerMedia();
    if (!media) {
      player.waitingForMedia = true;
      player.needsTapToPlay = false;
      player.mediaFailed = false;
      if (!playPollTimer) startPlayPoll();
      return;
    }

    bindMediaEvents(media);
    playInProgress = true;
    playRequested = true;
    userPaused = false;
    try {
      // 起播解除静音；已有用户音量则保留，否则抬到 ≥0.5 方便出声
      media.muted = false;
      if (player.volume > 0) media.volume = player.volume / 100;
      else media.volume = Math.max(media.volume, 0.5);
      player.muted = false;
      player.volume = Math.round(media.volume * 100);
      if (player.volume > 0) volumeBeforeMute = player.volume;
      await media.play();
      player.waitingForMedia = false;
      player.mediaFailed = false;
      applyPausedUi(false);
      startMediaStatePoll();
    } catch (e) {
      showTapOverlay();
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

  function pausePlayback() {
    if (player.waitingForMedia || player.mediaFailed) {
      return;
    }
    const media = findPlayerMedia();
    if (!media) return;
    bindMediaEvents(media);
    userPaused = true;
    playRequested = true;
    media.pause();
    applyPausedUi(true);
  }

  function togglePlayback() {
    if (!playRequested || player.needsTapToPlay) {
      void resumePlayback();
      return;
    }
    const media = findPlayerMedia();
    if (!media) {
      void resumePlayback();
      return;
    }
    if (media.paused || player.isPaused) void resumePlayback();
    else pausePlayback();
  }

  function notifyAutoplayFailed() {
    if (userPaused) {
      applyPausedUi(true);
      return;
    }
    if (findPlayerMedia()) showTapOverlay();
    else {
      player.waitingForMedia = true;
      player.needsTapToPlay = false;
    }
  }

  function resetPlayback() {
    stopPlayPoll();
    stopMediaStatePoll();
    unbindMediaEvents();
    playRequested = false;
    userPaused = false;
    player.needsTapToPlay = false;
    player.waitingForMedia = false;
    player.mediaFailed = false;
    player.failReason = "";
    player.isPaused = false;
    player.isFullscreen = false;
    player.pseudoFullscreen = false;
    player.qualityOptions = [];
    player.currentQualityCode = "";
  }

  onMounted(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    disposed = true;
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("keydown", handleGlobalKeydown);
    unbindMediaEvents();
    stopPlayPoll();
    stopMediaStatePoll();
    stageEl = null;
  });

  return Object.assign(player, {
    resumePlayback,
    pausePlayback,
    togglePlayback,
    startPlayPoll,
    stopPlayPoll,
    resetPlayback,
    notifyAutoplayFailed,
    onVhallPlayLoaded,
    markMediaFailed,
    bindStageEl,
    enterFullscreen,
    exitFullscreen,
    scheduleQualityLabels,
    setQuality,
    setVolume,
    toggleMute,
    beginVolumeDrag,
    endVolumeDrag,
  });
}

export type PlayerController = ReturnType<typeof usePlayerControls>;
