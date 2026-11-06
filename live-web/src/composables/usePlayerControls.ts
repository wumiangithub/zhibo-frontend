import { isReactive, onBeforeUnmount, onMounted, reactive, watch, type WatchStopHandle } from "vue";

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

/** 微吼 H5 常把 video 放进 open shadow（`.vhallPlayerh5-shadow`），light DOM query 找不到 */
function findMediaInShadowTree(root: Element): HTMLMediaElement | null {
  const shadow = (root as HTMLElement).shadowRoot;
  if (shadow) {
    const inShadow =
      shadow.querySelector("video") ||
      shadow.querySelector("audio") ||
      shadow.querySelector("#player-vhall-video");
    if (inShadow instanceof HTMLMediaElement) return inShadow;
    for (const child of shadow.querySelectorAll("*")) {
      const nested = findMediaInShadowTree(child);
      if (nested) return nested;
    }
  }
  for (const child of root.children) {
    const nested = findMediaInShadowTree(child);
    if (nested) return nested;
  }
  return null;
}

function findPlayerMedia(): HTMLMediaElement | null {
  const light =
    document.querySelector<HTMLMediaElement>("#player video") ||
    document.querySelector<HTMLMediaElement>("#player audio") ||
    document.querySelector<HTMLMediaElement>("#player-vhall-video");
  if (light) return light;
  const host = document.querySelector("#player");
  return host ? findMediaInShadowTree(host) : null;
}

/** #player 里已有微吼壳 / canvas / media：画面或壳已到，勿再标「长时间未就绪」 */
function hasPlayerShellOrMedia(): boolean {
  if (findPlayerMedia()) return true;
  return !!(
    document.querySelector("#player .vhallPlayer-container") ||
    document.querySelector("#player .vhallPlayerh5-shadow") ||
    document.querySelector("#player canvas")
  );
}

/** 联调日志用：分别探测 #player 内 video / audio / #player-vhall-video（含 shadow） */
function inspectPlayerMediaPresence() {
  const deep = findPlayerMedia();
  return {
    video: !!document.querySelector("#player video"),
    audio: !!document.querySelector("#player audio"),
    vhallVideo: !!document.querySelector("#player-vhall-video"),
    deepMedia: !!deep,
    shell: hasPlayerShellOrMedia(),
  };
}

/** 音频清晰度（菜单不展示；已在音频档时仍可保持 currentQualityCode） */
function isAudioQualityCode(code: string): boolean {
  const c = code.trim().toLowerCase();
  return c === "a" || c === "as";
}

/** same=原画；过滤 a/as；其余数字档按从高到低叫 高清/标清/流畅 */
function codesToQualityOptions(list: string[]): QualityOption[] {
  const visible = list.filter((code) => !isAudioQualityCode(code));
  const numeric = visible
    .map((c) => c.replace(/\D/g, ""))
    .filter((n) => n !== "")
    .sort((a, b) => Number(b) - Number(a));
  const rankNames = ["高清", "标清", "流畅"];
  return visible.map((code) => {
    const digits = code.replace(/\D/g, "");
    let label: string;
    if (code === "same") label = "原画";
    else if (digits) label = rankNames[numeric.indexOf(digits)] || `${digits}p`;
    else label = code;
    return { code, label };
  });
}

/**
 * 播放器交互（自建底栏，不依赖微吼 `.vh-player-controller`）：
 * - 就绪主路径：`playerReady`（及次要 `vhallplay_LOADED`）
 * - 播控/播态对齐官方 demo：优先 `playerServer.play/pause` + `playerServer.state.isPlaying`；
 *   其次文档 `player.play/pause`；再才 HTMLMediaElement
 * - DOM：仅短 burst 找 `<video>` 并绑 play/pause/ended；**无**常驻 500ms 扫 DOM
 * - 清晰度优先 demo `playerServer.getQualitys/setQuality`（自建底栏已拆原生条）；
 *   无则回退文档 `canPlayDefinitions/setPlayerDefinition`（须 try/catch）
 * - 音量/静音只走 HTMLMediaElement
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
  /** 短 burst：找 media 并绑事件后即停（非常驻播态轮询） */
  let mediaBindTimer: ReturnType<typeof setInterval> | null = null;
  let playInProgress = false;
  let playRequested = false;
  let userPaused = false;
  let disposed = false;
  let boundMedia: HTMLMediaElement | null = null;
  let stageEl: HTMLElement | null = null;
  let volumeBeforeMute = 50;
  /** 拖拽滑条期间禁止 sync 回写，避免 UI 被瞬时旧值拽回中间 */
  let volumeDragging = false;
  /** demo 式：已挂上 playerServer.state.isPlaying 时，media 事件不再抢播态 UI */
  let preferSdkPlaying = false;
  let stopSdkPlayingWatch: WatchStopHandle | null = null;
  /** playerServer.setQuality 需要整对象，按 def 缓存 getQualitys 结果 */
  let qualityRawByCode = new Map<string, VhallQualityItem>();

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
    if (preferSdkPlaying) return;
    if (!playRequested) {
      applyPausedUi(true);
      return;
    }
    applyPausedUi(false);
    userPaused = false;
    options.onUserPlay?.();
  }

  function onMediaPause() {
    if (preferSdkPlaying) return;
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
    if (!player.waitingForMedia && !preferSdkPlaying) applyPausedUi(media.paused);
  }

  function unbindSdkPlayingWatch() {
    stopSdkPlayingWatch?.();
    stopSdkPlayingWatch = null;
    preferSdkPlaying = false;
  }

  /**
   * 对齐 demo：playerReady 后把 playerServer.state 包成 reactive，再 watch isPlaying。
   * 没有 playerServer 则保持 media 事件播态。
   */
  function bindSdkPlayingWatch(): boolean {
    const ps = getSdk()?.playerServer;
    if (!ps?.state) return false;
    try {
      if (!isReactive(ps.state)) {
        ps.state = reactive(ps.state);
      }
    } catch {
      return false;
    }
    unbindSdkPlayingWatch();
    preferSdkPlaying = true;
    stopSdkPlayingWatch = watch(
      () => getSdk()?.playerServer?.state?.isPlaying,
      (playing) => {
        if (disposed || playing == null) return;
        if (playing) {
          // SDK 已在播：清掉「加载中 / 长时间未就绪」假失败（画面常已出，仅 DOM 探测晚）
          if (player.waitingForMedia || player.mediaFailed) {
            player.waitingForMedia = false;
            player.mediaFailed = false;
            player.failReason = "";
            stopPlayPoll();
          }
          if (!playRequested) {
            applyPausedUi(true);
            return;
          }
          applyPausedUi(false);
          userPaused = false;
          options.onUserPlay?.();
          return;
        }
        if (player.waitingForMedia) return;
        applyPausedUi(true);
        if (playRequested) {
          userPaused = true;
          options.onUserPause?.();
        }
      },
      { immediate: true },
    );
    return true;
  }

  /** demo：playerServer.play；文档：player.play */
  function callSdkPlay(): boolean {
    const sdk = getSdk();
    if (typeof sdk?.playerServer?.play === "function") {
      sdk.playerServer.play();
      return true;
    }
    if (typeof sdk?.player?.play === "function") {
      sdk.player.play();
      return true;
    }
    return false;
  }

  /** demo 未展示 pause；优先 playerServer.pause，再文档 player.pause */
  function callSdkPause(): boolean {
    const sdk = getSdk();
    if (typeof sdk?.playerServer?.pause === "function") {
      sdk.playerServer.pause();
      return true;
    }
    if (typeof sdk?.player?.pause === "function") {
      sdk.player.pause();
      return true;
    }
    return false;
  }

  function applyUnmuteToMedia(media: HTMLMediaElement) {
    media.muted = false;
    if (player.volume > 0) media.volume = player.volume / 100;
    else media.volume = Math.max(media.volume, 0.5);
    player.muted = false;
    player.volume = Math.round(media.volume * 100);
    if (player.volume > 0) volumeBeforeMute = player.volume;
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

  function applyQualityCodes(list: string[], preferred?: string) {
    if (list.length === 0) return;
    player.qualityOptions = codesToQualityOptions(list);
    if (!player.currentQualityCode || !list.includes(player.currentQualityCode)) {
      player.currentQualityCode =
        preferred && list.includes(preferred)
          ? preferred
          : list.includes("same")
            ? "same"
            : list[0];
    }
  }

  function loadQualitiesFromPlayerServer(): boolean {
    const ps = getSdk()?.playerServer;
    if (typeof ps?.getQualitys !== "function") return false;
    const rawList = ps.getQualitys() || [];
    if (!Array.isArray(rawList) || rawList.length === 0) return false;
    const next = new Map<string, VhallQualityItem>();
    const codes: string[] = [];
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const def = String(item.def || "").trim();
      if (!def) continue;
      next.set(def, item);
      codes.push(def);
    }
    if (codes.length === 0) return false;
    qualityRawByCode = next;
    const cur = ps.getCurrentQuality?.();
    const preferred =
      cur && typeof cur === "object" ? String(cur.def || "").trim() : "";
    applyQualityCodes(codes, preferred || undefined);
    return true;
  }

  function loadQualities() {
    // 自建底栏对齐 demo：优先 playerServer（不依赖已拆的 .vh-player-controller）
    if (loadQualitiesFromPlayerServer()) return;
    const playerMod = getSdk()?.player;
    if (!playerMod?.canPlayDefinitions) return;
    playerMod.canPlayDefinitions((list: string[]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      qualityRawByCode = new Map();
      applyQualityCodes(list);
    });
  }

  /**
   * 播放器就绪前清晰度 API 会抛错/不回调，轮询重试。
   * moduleReady 可先调；playerReady 后再调一次（中控台常更晚才有 player 模块）。
   */
  function scheduleQualityLabels(tries = 0, delayMs = 1500) {
    window.setTimeout(() => {
      if (disposed) return;
      if (player.qualityOptions.length > 0) return;
      try {
        loadQualities();
      } catch {
        /* 播放器未就绪 */
      }
      if (player.qualityOptions.length === 0 && tries < 12) {
        scheduleQualityLabels(tries + 1, delayMs);
      }
    }, delayMs);
  }

  function setQuality(code: string) {
    const sdk = getSdk();
    const ps = sdk?.playerServer;
    // demo 竖屏路径：整对象交给 playerServer，不碰原生控制条 DOM
    if (typeof ps?.setQuality === "function") {
      if (!qualityRawByCode.has(code)) {
        try {
          loadQualitiesFromPlayerServer();
        } catch {
          /* 忽略，下面用 stub */
        }
      }
      const raw = qualityRawByCode.get(code) ?? ({ def: code } as VhallQualityItem);
      ps.setQuality(raw, (err) => {
        console.warn("设置清晰度失败", err);
      });
      player.currentQualityCode = code;
      return;
    }
    // 文档 API 会写原生清晰度文案；控制条已 removeChild 时易 NPE
    const playerMod = sdk?.player;
    if (!playerMod?.setPlayerDefinition) return;
    try {
      playerMod.setPlayerDefinition(code);
      player.currentQualityCode = code;
    } catch (e) {
      console.warn("setPlayerDefinition 失败（原生控制条可能已拆）", e);
    }
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

  function stopMediaBindBurst() {
    if (mediaBindTimer) {
      clearInterval(mediaBindTimer);
      mediaBindTimer = null;
    }
  }

  /**
   * DOM 短 burst：仅在 playerReady / 起播 / 兜底就绪后找 media 并绑事件；
   * 找到即停。播态靠 playerServer.isPlaying 或 media 事件，不常驻扫 DOM。
   */
  function startMediaBindBurst(maxTries = 16) {
    if (boundMedia && document.contains(boundMedia)) {
      syncVolumeFromMedia();
      return;
    }
    stopMediaBindBurst();
    let tries = 0;
    mediaBindTimer = setInterval(() => {
      if (disposed) {
        stopMediaBindBurst();
        return;
      }
      tries += 1;
      const media = findPlayerMedia();
      if (media) {
        bindMediaEvents(media);
        syncVolumeFromMedia();
        stopMediaBindBurst();
        return;
      }
      if (tries >= maxTries) stopMediaBindBurst();
    }, 500);
  }

  function showTapOverlay() {
    player.waitingForMedia = false;
    player.mediaFailed = false;
    player.failReason = "";
    player.needsTapToPlay = true;
    player.isPaused = true;
    startMediaBindBurst();
  }

  function markMediaFailed(reason = "播放器加载失败") {
    stopPlayPoll();
    stopMediaBindBurst();
    player.waitingForMedia = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    player.mediaFailed = true;
    player.failReason = reason;
  }

  function tryAdvanceMediaReady(media: HTMLMediaElement): boolean {
    bindMediaEvents(media);
    syncVolumeFromMedia();
    if (!playRequested) {
      showTapOverlay();
      stopPlayPoll();
      return true;
    }
    if (userPaused || (!preferSdkPlaying && media.paused)) {
      player.waitingForMedia = false;
      player.mediaFailed = false;
      applyPausedUi(true);
      stopPlayPoll();
      return true;
    }
    if (preferSdkPlaying) {
      const playing = !!getSdk()?.playerServer?.state?.isPlaying;
      player.waitingForMedia = false;
      player.mediaFailed = false;
      applyPausedUi(!playing);
      stopPlayPoll();
      return true;
    }
    player.waitingForMedia = false;
    player.mediaFailed = false;
    applyPausedUi(false);
    stopPlayPoll();
    return true;
  }

  /**
   * 官方 playerReady / 壳已到但 light DOM 尚无 media：仍清遮罩。
   * media 仅用于音量/ended，用 burst 继续找；勿因此标「长时间未就绪」。
   */
  function advanceReadyWithoutMedia() {
    stopPlayPoll();
    player.mediaFailed = false;
    player.failReason = "";
    if (!playRequested) {
      showTapOverlay();
      return;
    }
    player.waitingForMedia = false;
    const playing = preferSdkPlaying
      ? !!getSdk()?.playerServer?.state?.isPlaying
      : false;
    applyPausedUi(!playing);
    startMediaBindBurst();
  }

  /**
   * DOM 兜底轮询：仅在官方事件未推进就绪、或事件后尚无 media 节点时使用。
   * 硬上限；找到 media 即停。壳/SDK 已到则勿假失败。
   */
  function startPlayPoll(maxTries = 20) {
    stopPlayPoll();
    stopMediaBindBurst();
    player.waitingForMedia = true;
    player.mediaFailed = false;
    player.needsTapToPlay = false;
    player.isPaused = false;
    let tries = 0;
    playPollTimer = setInterval(() => {
      tries += 1;
      const media = findPlayerMedia();
      if (media && tryAdvanceMediaReady(media)) return;
      // SDK 已在播：即使还没抠到 media，也别盖错误层
      if (getSdk()?.playerServer?.state?.isPlaying) {
        advanceReadyWithoutMedia();
        return;
      }
      if (tries >= maxTries) {
        if (findPlayerMedia()) {
          showTapOverlay();
        } else if (getSdk()?.playerServer || hasPlayerShellOrMedia()) {
          console.warn(
            "[player] 轮询超时但 SDK/壳已就绪，按就绪收尾（不标长时间未就绪）",
            inspectPlayerMediaPresence(),
          );
          advanceReadyWithoutMedia();
        } else {
          markMediaFailed("播放器长时间未就绪");
        }
        stopPlayPoll();
      }
    }, 500);
  }

  /** 官方/事件推进：绑 isPlaying；有 media 则结束等待；无 media 也清遮罩，burst 再找节点 */
  function advanceFromSdkEvent(source: "playerReady" | "vhallplay_LOADED") {
    const at = new Date().toISOString();
    const presence = inspectPlayerMediaPresence();
    console.log(`[player] ${source} @ ${at}`, presence);
    const watched = bindSdkPlayingWatch();
    console.log(`[player] ${source} @ ${at} playerServer.isPlaying watch=${watched}`);
    const media = findPlayerMedia();
    if (!media) {
      console.warn(
        `[player] ${source} @ ${at} 已回调但尚未找到 media（可能在 shadow），按 SDK 就绪收尾`,
        presence,
      );
      advanceReadyWithoutMedia();
      return;
    }
    if (tryAdvanceMediaReady(media)) {
      console.log(`[player] ${source} @ ${at} 已找到媒体并推进就绪`, presence);
    }
  }

  function onPlayerReady() {
    advanceFromSdkEvent("playerReady");
    // 清晰度列表常在 player 模块真正就绪后才有；补一轮快重试（与 moduleReady 调度并存）
    if (player.qualityOptions.length === 0) {
      scheduleQualityLabels(0, 300);
    }
  }

  function onVhallPlayLoaded() {
    advanceFromSdkEvent("vhallplay_LOADED");
  }

  async function resumePlayback() {
    if (playInProgress) return;
    playInProgress = true;
    playRequested = true;
    userPaused = false;
    try {
      const media = findPlayerMedia();
      if (media) {
        bindMediaEvents(media);
        applyUnmuteToMedia(media);
      }

      // 对齐 demo：用户手势内优先 SDK play（playerServer → player）
      if (callSdkPlay()) {
        player.waitingForMedia = false;
        player.mediaFailed = false;
        applyPausedUi(false);
        if (!media) startMediaBindBurst();
        else syncVolumeFromMedia();
        return;
      }

      if (!media) {
        player.waitingForMedia = true;
        player.needsTapToPlay = false;
        player.mediaFailed = false;
        if (!playPollTimer) startPlayPoll();
        return;
      }

      await media.play();
      player.waitingForMedia = false;
      player.mediaFailed = false;
      applyPausedUi(false);
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
    userPaused = true;
    playRequested = true;
    if (callSdkPause()) {
      applyPausedUi(true);
      return;
    }
    const media = findPlayerMedia();
    if (!media) return;
    bindMediaEvents(media);
    media.pause();
    applyPausedUi(true);
  }

  function togglePlayback() {
    if (!playRequested || player.needsTapToPlay) {
      void resumePlayback();
      return;
    }
    if (player.isPaused) void resumePlayback();
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
    stopMediaBindBurst();
    unbindSdkPlayingWatch();
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
    qualityRawByCode = new Map();
  }

  onMounted(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    disposed = true;
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("keydown", handleGlobalKeydown);
    unbindSdkPlayingWatch();
    unbindMediaEvents();
    stopPlayPoll();
    stopMediaBindBurst();
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
    onPlayerReady,
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
