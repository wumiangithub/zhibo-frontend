/**
 * 观看页 / 中控台内存进出态。
 * 会话键 = userId（sender_id / visit_v*），一人一行；昵称只用于认己，不作为「已在线」键。
 * 本端已接受 enter 且未 leave → enteredOnline；同会话后续 Join 绝不再报 enter。
 * 新 userId（换 Tab/浏览器常见）→ 允许 enter；换 visit 时先 leave 旧身份。
 * 落库时间只用推送 `date_time`（yyyy-MM-dd HH:mm:ss），禁止用本地时钟冒充。
 * 例外：同 userId 的 Join 500ms 去重窗在同秒无法靠 date_time 分辨亚秒时，用本地收到时刻辅助判定。
 */

const TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** 同一 userId 相对上次已接受 Join 的去重窗（含短时 date_time 不同的重复推送） */
const JOIN_DEDUP_MS = 500;

interface LastAcceptedJoin {
  /** 上次已接受 Join 的推送 date_time */
  dateTime: string;
  /** 上次接受时的本地收到时刻（仅用于亚秒窗） */
  receivedAt: number;
}

export interface PresencePeer {
  userId: string;
  enterTime: string;
  leaveTime: string;
  online: boolean;
  nickname: string;
  avatar: string;
}

export interface SelfIdentity {
  guestId: string;
  /** 观看页昵称、SDK username 等，用来在锁定 sender_id 之前认出自己 */
  nicknames: string[];
}

export interface EnterReport {
  userId: string;
  enterTime: string;
  avatarUrl?: string;
  /** 他人 Join 时用推送昵称；自己进入时由调用方用本页昵称覆盖 */
  nickname?: string;
}

export interface LeaveReport {
  userId: string;
  enterTime: string;
  leaveTime: string;
}

export interface PresenceEffects {
  enter: EnterReport | null;
  /**
   * 助理角色：他人 Join 也要走辅通道 enter，否则本机无微吼回调时
   * 名单只有本地插行，刷新/切 Tab 后只剩已入库的助理。
   */
  peerEnters: EnterReport[];
  /** 候选离开；调用方按 viewer/assistant 规则决定是否入队 */
  leaves: LeaveReport[];
  /**
   * 自己又拿到新的 sender_id（微吼 visit_v* 重进常见）时，须先离开旧身份，
   * 否则名单会堆多个同昵称在线行。调用方应无视角色离开开关，一律上报。
   */
  replacedSelfLeave: LeaveReport | null;
  /** 推送没有合法的 date_time，调用方不要用本地时间 */
  skippedMissingTime: boolean;
  /** 离开对不上此前进入时间 */
  skippedMissingEnter: boolean;
}

interface BufferedEvent {
  kind: "online" | "offline";
  msg: VhallUserPresenceMessage;
}

function emptyEffects(): PresenceEffects {
  return {
    enter: null,
    peerEnters: [],
    leaves: [],
    replacedSelfLeave: null,
    skippedMissingTime: false,
    skippedMissingEnter: false,
  };
}

export function presenceTime(raw: string | undefined | null): string | null {
  const text = raw?.trim() ?? "";
  return TIME_RE.test(text) ? text : null;
}

/** 将推送 date_time 解析为 epoch ms；仅到秒，同秒差为 0 */
function presenceEpochMs(dateTime: string): number | null {
  const t = Date.parse(dateTime.replace(" ", "T"));
  return Number.isFinite(t) ? t : null;
}

function avatarOf(msg: VhallUserPresenceMessage): string | undefined {
  const avatar = msg.context?.avatar?.trim() ?? "";
  if (!avatar || avatar.length > 1024) return undefined;
  return avatar;
}

export class RoomPresence {
  selfUserId = "";
  selfEnterTime = "";

  /** 本页看到过的其他人（含比自己早进的） */
  private peers = new Map<string, PresencePeer>();
  private buffer: BufferedEvent[] = [];
  /**
   * 本会话已接受 enter、尚未 leave 的 userId（self / peer 共用）。
   * 命中则后续 Join 不再报 enter；leave / clearSelfIf 删除后才可再进。
   */
  private enteredOnline = new Set<string>();
  /**
   * 每人上一次「已接受并会/已上报 enter」的 Join（500ms 窗）。
   * leave / clearSelfIf 时删除，故真正离线后再进不受 500ms 窗影响。
   */
  private lastAcceptedJoins = new Map<string, LastAcceptedJoin>();

  /** 是否还有「比我晚进且仍在线」的人 */
  get hasLaterOnline(): boolean {
    if (!this.selfEnterTime) return false;
    for (const item of this.peers.values()) {
      if (item.online && item.enterTime > this.selfEnterTime) return true;
    }
    return false;
  }

  reset(): void {
    this.selfUserId = "";
    this.selfEnterTime = "";
    this.peers.clear();
    this.buffer = [];
    this.enteredOnline.clear();
    this.lastAcceptedJoins.clear();
  }

  /** 本端已 enter 且未 leave 的自己（关页 leave / 再进防护用） */
  getSelfOpen(): { userId: string; enterTime: string } | null {
    if (!this.selfUserId || !this.selfEnterTime) return null;
    if (!this.enteredOnline.has(this.selfUserId)) return null;
    return { userId: this.selfUserId, enterTime: this.selfEnterTime };
  }

  /** 关页已发 leave 后清会话在线，避免同页误二次逻辑（页面通常即将销毁） */
  markSelfLeftLocally(): void {
    if (!this.selfUserId) return;
    this.clearEntered(this.selfUserId);
  }

  /**
   * enter 上报失败时解开认己锁。
   * acceptSelfJoin 会先写 selfUserId / enteredOnline，若 postEnter 失败又不解开，
   * 同 sender_id 的重复 Join 会永远 enter:null。
   * 同时清会话在线与去重窗，允许失败后的合法重试。
   */
  clearSelfIf(userId: string): void {
    if (this.selfUserId === userId) {
      this.selfUserId = "";
      this.selfEnterTime = "";
      this.clearEntered(userId);
    }
  }

  /** 该 userId 是否已在本会话 enter 且未 leave */
  private isEnteredOnline(userId: string): boolean {
    return this.enteredOnline.has(userId);
  }

  private markEntered(userId: string): void {
    this.enteredOnline.add(userId);
  }

  private clearEntered(userId: string): void {
    this.enteredOnline.delete(userId);
    this.lastAcceptedJoins.delete(userId);
  }

  private skipEnter(userId: string, reason: string): void {
    console.debug("[presence] skip enter", { userId, reason });
  }

  /**
   * 同 userId 曾被当成 peer 落过 enter，后来才认成自己：升格为 self，不二次 enter。
   * 保留首次 enterTime。
   */
  private promoteToSelfIfNeeded(userId: string, fallbackEnterTime: string): void {
    if (this.selfUserId === userId) return;
    const peer = this.peers.get(userId);
    this.selfUserId = userId;
    this.selfEnterTime = peer?.enterTime || this.selfEnterTime || fallbackEnterTime;
    this.peers.delete(userId);
  }

  /**
   * 相对该人上一次已接受 Join 是否落在 500ms 去重窗内。
   * - 优先用推送 date_time 解析时刻差；若差 >500ms，绝非本窗重复。
   * - date_time 仅到秒：同秒差为 0、或字符串相同，亚秒重复推送比不出 → 用本地收到时刻做 500ms 窗。
   * - 无上次记录（含已 leave 清掉）→ 不算重复。
   */
  private isDuplicateJoin(userId: string, dateTime: string, receivedAt: number): boolean {
    const last = this.lastAcceptedJoins.get(userId);
    if (!last) return false;

    const prevMs = presenceEpochMs(last.dateTime);
    const currMs = presenceEpochMs(dateTime);
    if (prevMs != null && currMs != null) {
      const pushDelta = Math.abs(currMs - prevMs);
      if (pushDelta > JOIN_DEDUP_MS) return false;
      // pushDelta===0（同秒 / date_time 相同）或 ≤500：改用本地收到时刻
    }
    return receivedAt - last.receivedAt <= JOIN_DEDUP_MS;
  }

  private rememberAcceptedJoin(userId: string, dateTime: string, receivedAt: number): void {
    this.lastAcceptedJoins.set(userId, { dateTime, receivedAt });
  }

  onOnline(
    msg: VhallUserPresenceMessage,
    identity: SelfIdentity,
    opts: { reportAllLeaves: boolean } = { reportAllLeaves: false },
  ): PresenceEffects {
    if (msg.data?.type !== "Join") return emptyEffects();
    const effects = emptyEffects();
    if (this.isSelf(msg, identity)) {
      const accepted = this.acceptSelfJoin(msg);
      if (!accepted) {
        effects.skippedMissingTime = true;
        return effects;
      }
      effects.enter = accepted.enter;
      effects.replacedSelfLeave = accepted.replacedSelfLeave;
      const flushed = this.flush(opts.reportAllLeaves);
      effects.peerEnters = flushed.peerEnters;
      effects.leaves = flushed.leaves;
      effects.skippedMissingTime = flushed.skippedMissingTime;
      effects.skippedMissingEnter = flushed.skippedMissingEnter;
      return effects;
    }
    if (!this.selfEnterTime) {
      this.buffer.push({ kind: "online", msg });
      return effects;
    }
    const peer = this.acceptPeerJoin(msg);
    if (peer.badTime) {
      effects.skippedMissingTime = true;
      return effects;
    }
    // reportAllLeaves 即助理模式：他人进入也要落库（已在线的重复 Join 不报）
    if (opts.reportAllLeaves && peer.enter) effects.peerEnters = [peer.enter];
    return effects;
  }

  onOffline(
    msg: VhallUserPresenceMessage,
    opts: { reportAllLeaves: boolean } = { reportAllLeaves: false },
  ): PresenceEffects {
    if (msg.data?.type !== "Leave") return emptyEffects();
    if (!this.selfEnterTime) {
      if (!presenceTime(msg.date_time)) {
        return { ...emptyEffects(), skippedMissingTime: true };
      }
      this.buffer.push({ kind: "offline", msg });
      return emptyEffects();
    }
    return this.applyLeave(msg, opts.reportAllLeaves);
  }

  private isSelf(msg: VhallUserPresenceMessage, identity: SelfIdentity): boolean {
    const userId = msg.sender_id?.trim() ?? "";
    if (!userId) return false;
    if (this.selfUserId) return userId === this.selfUserId;
    if (identity.guestId && userId === identity.guestId) return true;
    const nick = msg.context?.nickname?.trim() ?? "";
    if (!nick) return false;
    return identity.nicknames.some((name) => name.trim() === nick);
  }

  private acceptSelfJoin(
    msg: VhallUserPresenceMessage,
  ): { enter: EnterReport | null; replacedSelfLeave: LeaveReport | null } | null {
    const enterTime = presenceTime(msg.date_time);
    const userId = msg.sender_id?.trim() ?? "";
    if (!enterTime || !userId) return null;
    const receivedAt = Date.now();

    // 同 userId 已在本会话 online（含曾走 peer 路径）：绝不再 enter；可升格为 self
    if (this.isEnteredOnline(userId)) {
      this.promoteToSelfIfNeeded(userId, enterTime);
      this.skipEnter(userId, "already online in session (self path)");
      return { enter: null, replacedSelfLeave: null };
    }

    // 额外 500ms 窗：短时重复推送（含 date_time 不同）不报 enter、不改首次 enterTime
    if (this.isDuplicateJoin(userId, enterTime, receivedAt)) {
      this.promoteToSelfIfNeeded(userId, enterTime);
      this.markEntered(userId); // 与 lastAccepted 对齐，避免窗过后误二次 enter
      this.skipEnter(userId, "500ms join dedup (self path)");
      return { enter: null, replacedSelfLeave: null };
    }

    let replacedSelfLeave: LeaveReport | null = null;
    if (
      this.selfUserId &&
      this.selfEnterTime &&
      this.selfUserId !== userId
    ) {
      replacedSelfLeave = {
        userId: this.selfUserId,
        enterTime: this.selfEnterTime,
        leaveTime: enterTime,
      };
      this.clearEntered(this.selfUserId);
    }

    this.selfUserId = userId;
    this.selfEnterTime = enterTime;
    this.peers.delete(userId);
    this.markEntered(userId);
    this.rememberAcceptedJoin(userId, enterTime, receivedAt);
    return {
      enter: {
        userId,
        enterTime,
        avatarUrl: avatarOf(msg),
      },
      replacedSelfLeave,
    };
  }

  /**
   * 他人 Join。enterTime 只取推送 `date_time`。
   * 同 userId 已在会话 online（self 或 peer）再收到 Join → 不报 enter，也不改首次 enterTime。
   * 另有 500ms 时间窗去重（见 isDuplicateJoin）。
   */
  private acceptPeerJoin(msg: VhallUserPresenceMessage): {
    enter: EnterReport | null;
    badTime: boolean;
  } {
    const enterTime = presenceTime(msg.date_time);
    const userId = msg.sender_id?.trim() ?? "";
    if (!enterTime || !userId) return { enter: null, badTime: true };
    if (userId === this.selfUserId || this.isEnteredOnline(userId)) {
      this.skipEnter(userId, "already online in session (peer path)");
      return { enter: null, badTime: false };
    }
    const receivedAt = Date.now();

    // 已 offline 后再 Join：enteredOnline 在 leave 时已清，不会误挡；未清时 500ms 内仍挡
    if (this.isDuplicateJoin(userId, enterTime, receivedAt)) {
      this.markEntered(userId);
      this.skipEnter(userId, "500ms join dedup (peer path)");
      return { enter: null, badTime: false };
    }

    const nickname = msg.context?.nickname?.trim() ?? "";
    this.peers.set(userId, {
      userId,
      enterTime,
      leaveTime: "",
      online: true,
      nickname,
      avatar: msg.context?.avatar?.trim() ?? "",
    });
    this.markEntered(userId);
    this.rememberAcceptedJoin(userId, enterTime, receivedAt);
    return {
      enter: {
        userId,
        enterTime,
        avatarUrl: avatarOf(msg),
        ...(nickname ? { nickname } : {}),
      },
      badTime: false,
    };
  }

  private applyLeave(msg: VhallUserPresenceMessage, reportAllLeaves: boolean): PresenceEffects {
    const effects = emptyEffects();
    const leaveTime = presenceTime(msg.date_time);
    const userId = msg.sender_id?.trim() ?? "";
    if (!leaveTime || !userId) {
      effects.skippedMissingTime = true;
      return effects;
    }

    let enterTime = "";
    if (userId === this.selfUserId) {
      enterTime = this.selfEnterTime;
    } else {
      const peer = this.peers.get(userId);
      if (peer) {
        peer.online = false;
        peer.leaveTime = leaveTime;
        enterTime = peer.enterTime;
      }
    }
    // 真正离线：清会话在线 + 去重窗，再 Join 可 enter；self 仍保留 selfEnterTime 供 hasLaterOnline
    this.clearEntered(userId);

    if (!enterTime) {
      effects.skippedMissingEnter = true;
      return effects;
    }
    if (!reportAllLeaves && this.hasLaterOnline) {
      return effects;
    }
    effects.leaves = [{ userId, enterTime, leaveTime }];
    return effects;
  }

  private flush(reportAllLeaves: boolean): {
    peerEnters: EnterReport[];
    leaves: LeaveReport[];
    skippedMissingTime: boolean;
    skippedMissingEnter: boolean;
  } {
    const queued = this.buffer.splice(0);
    const peerEnters: EnterReport[] = [];
    const leaves: LeaveReport[] = [];
    let skippedMissingTime = false;
    let skippedMissingEnter = false;
    for (const item of queued) {
      if (item.kind === "online") {
        const peer = this.acceptPeerJoin(item.msg);
        if (peer.badTime) {
          skippedMissingTime = true;
          continue;
        }
        if (reportAllLeaves && peer.enter) peerEnters.push(peer.enter);
        continue;
      }
      const leave = this.applyLeave(item.msg, reportAllLeaves);
      leaves.push(...leave.leaves);
      skippedMissingTime = skippedMissingTime || leave.skippedMissingTime;
      skippedMissingEnter = skippedMissingEnter || leave.skippedMissingEnter;
    }
    return { peerEnters, leaves, skippedMissingTime, skippedMissingEnter };
  }
}
