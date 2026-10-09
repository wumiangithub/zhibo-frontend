import { onBeforeUnmount, reactive } from "vue";

/** SDK 把 room_id 塞在 interact_token(JWT) 的 payload 里，getRoominfo 不可用时兜底解码 */
function roomIdFromToken(): string {
  const token =
    (window as unknown as { vhsdklInfo?: { interact_token?: string } }).vhsdklInfo?.interact_token ||
    (window as unknown as { interact_token?: string }).interact_token ||
    "";
  const seg = token.split(".")[1];
  if (!seg) return "";
  try {
    const bin = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { room_id?: string };
    return payload.room_id || "";
  } catch {
    return "";
  }
}

/** 在线人数、点赞总数：房间 id 异步可得，需轮询等到它出现再拉点赞 */
export function useRoomStats(getSdk: () => VhallSdkInstance | null) {
  const stats = reactive({
    likeCount: 0,
    onlineCount: 0,
  });

  let roomId = "";
  let disposed = false;
  let roomIdTimer: ReturnType<typeof window.setTimeout> | undefined;
  /** live_over / state 3/4/5：强制 0，忽略迟到 onlinePopulation（含主讲减 1 后仍可能非 0） */
  let liveEnded = false;

  async function loadRoomId() {
    const sdk = getSdk();
    // interact_token 同步可得且稳定，优先用它；getRoominfo 偶发挂起会卡死轮询，故只作超时兜底
    roomId = roomIdFromToken();
    if (roomId || !sdk?.getRoominfo) return;
    try {
      const info = await Promise.race([
        sdk.getRoominfo(),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
      ]);
      if (info) roomId = info.room_id || info.roomId || info.interact?.room_id || "";
    } catch (e) {
      console.warn("获取房间信息失败", e);
    }
  }

  async function loadLikeCount() {
    const sdk = getSdk();
    if (!sdk || !roomId || !sdk.interactTools?.getRoomLike) return;
    try {
      const res = await sdk.interactTools.getRoomLike(roomId);
      // SDK 把整个响应 {code, data} resolve 出来，总数在 data.total
      stats.likeCount = res.data?.total ?? res.total ?? 0;
    } catch (e) {
      console.warn("获取点赞数失败", e);
    }
  }

  /** destroySdk / unmount：清掉 roomId 轮询定时器 */
  function cancelRoomId() {
    if (roomIdTimer != null) {
      window.clearTimeout(roomIdTimer);
      roomIdTimer = undefined;
    }
  }

  /** getRoominfo 在 sdk-init 完成前返回空对象，轮询等到房间 id 出现再拉点赞总数 */
  function scheduleRoomId(tries = 0) {
    void loadRoomId().then(() => {
      if (disposed) return;
      if (roomId) {
        void loadLikeCount();
        return;
      }
      if (tries < 9) {
        roomIdTimer = window.setTimeout(() => scheduleRoomId(tries + 1), 1000);
      }
    });
  }

  function handleLike() {
    const sdk = getSdk();
    if (!sdk || !roomId || !sdk.interactTools?.praise?.userLike) return;
    try {
      // SDK 实现读 room_id，文档写 roomid，两个都传保险
      sdk.interactTools.praise.userLike({ roomid: roomId, room_id: roomId, num: 1 });
      // 乐观更新：本地点完立刻 +1，服务端 customPraiseTotal 推回真实总数时再覆盖校正
      stats.likeCount += 1;
    } catch (e) {
      console.error("点赞失败", e);
    }
  }

  function handleOnlinePopulation(data: unknown) {
    if (liveEnded) {
      stats.onlineCount = 0;
      return;
    }
    const info = data as { uv?: number; total?: number };
    // 微吼 onlinePopulation 含主讲人；本站统计不显示老师，展示前减 1，且不少于 0
    const raw = info.uv || info.total || 0;
    stats.onlineCount = Math.max(0, raw - 1);
  }

  /** 关播 / 已结束：实时在线人数强制 0 */
  function markLiveEnded() {
    liveEnded = true;
    stats.onlineCount = 0;
  }

  /** 换场次或重新进房前复位，允许再吃 onlinePopulation */
  function resetLiveEnded() {
    liveEnded = false;
  }

  function handlePraiseTotal(data: unknown) {
    const info = data as { num?: number; total?: number; count?: number };
    // 推送的是当前总数，但批量下发有延迟，可能还没算进本地点赞；
    // 直播点赞只增不减，用 max 夹住，服务端总数只能往上抬、不能把乐观更新压回去
    const value = info.num ?? info.total ?? info.count;
    if (typeof value === "number") stats.likeCount = Math.max(stats.likeCount, value);
  }

  onBeforeUnmount(() => {
    disposed = true;
    cancelRoomId();
  });

  return Object.assign(stats, {
    handleLike,
    handleOnlinePopulation,
    handlePraiseTotal,
    scheduleRoomId,
    cancelRoomId,
    markLiveEnded,
    resetLiveEnded,
  });
}

export type RoomStatsController = ReturnType<typeof useRoomStats>;
