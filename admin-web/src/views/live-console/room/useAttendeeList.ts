import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import {
  listAttendees,
  type AttendeeBehavior,
  type AttendeeFollowerFilter,
  type AttendeeItem,
  type AttendeeKind,
  type AttendeeKeywordType,
  type AttendeeTab,
} from "./api/console";

const PAGE_SIZE = 20;

function isEndedState(state: number | undefined): boolean {
  return state === 3 || state === 4 || state === 5;
}

/** 结束态契约：全员 offline，offline ≡ all；请求用 all 避免后端尚未翻 state 时把仍标 online 的人滤掉 */
function requestTab(uiTab: AttendeeTab, forceEnded: boolean): AttendeeTab {
  if (forceEnded && uiTab === "offline") return "all";
  return uiTab;
}

function mergeByUsername(primary: AttendeeItem[], fallback: AttendeeItem[]): AttendeeItem[] {
  const seen = new Set(primary.map((r) => r.username));
  const extra = fallback.filter((r) => r.username && !seen.has(r.username));
  return primary.concat(extra);
}

function isAssistantUsername(username: string): boolean {
  return /^[ez]\d+$/.test(username.trim());
}

function matchesKind(username: string, kind: AttendeeKind): boolean {
  return isAssistantUsername(username) === (kind === "assistant");
}

/** 中控台左侧名单：换 Tab、改搜索词从第 1 页重拉（D37）；加载更多只在点击时请求。 */
export function useAttendeeList(
  activityId: Ref<string>,
  /** 直播已结束/点播/回放：D30 全员离线，不再吃 Join 本地补丁 */
  activityEnded?: Ref<boolean>,
) {
  const kind = ref<AttendeeKind>("student");
  const tab = ref<AttendeeTab>("all");
  const keywordType = ref<AttendeeKeywordType>("nickname");
  const keyword = ref("");
  /** all / none / 员工 id */
  const followerFilter = ref<AttendeeFollowerFilter>("all");
  const behavior = ref<AttendeeBehavior>("all");
  const list = ref<AttendeeItem[]>([]);

  const keywordPlaceholder = computed(() => {
    if (keywordType.value === "username") return "请输入用户ID";
    if (keywordType.value === "phone") return "请输入手机号";
    return "请输入用户昵称";
  });
  const total = ref(0);
  const studentTotal = ref(0);
  const assistantTotal = ref(0);
  const allTotal = ref(0);
  const onlineTotal = ref(0);
  const offlineTotal = ref(0);
  const page = ref(1);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref("");
  const brokenAvatars = ref<Record<string, boolean>>({});

  const hasMore = computed(() => list.value.length < total.value);
  const ended = computed(() => !!activityEnded?.value);

  let requestSeq = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** 结束瞬间本地快照：接口空/不全时兜底，避免先清空再等空响应把人弄没 */
  let endedLocalSnapshot: AttendeeItem[] = [];

  function displayName(item: AttendeeItem): string {
    return item.nickname?.trim() || (kind.value === "assistant" ? "助教" : "观众");
  }

  function avatarSrc(item: AttendeeItem): string {
    if (!item.avatarUrl || brokenAvatars.value[item.username]) return "";
    return item.avatarUrl;
  }

  function markAvatarBroken(username: string) {
    brokenAvatars.value = { ...brokenAvatars.value, [username]: true };
  }

  function snapshotForEndedFallback() {
    endedLocalSnapshot = list.value.map((row) => ({ ...row, online: false }));
  }

  /** 结束态本地兜底：在线 Tab 先切到离线（全员应在离线）；其它 Tab 标 offline 并保留行 */
  function applyEndedLocally() {
    snapshotForEndedFallback();
    for (const row of list.value) {
      row.online = false;
    }
    if (tab.value === "online") {
      // 结束态「在线」必空；立刻切「离线」让用户看到全员（随后重拉）
      tab.value = "offline";
    }
  }

  /**
   * 本地推送改在线态；Join 时若名单尚无此人则插入（不轮询时靠 SDK 推送补全）。
   * 持久化：助理辅通道会对他人 Join 调 enter；生产靠微吼回调。
   */
  function patchOnline(
    username: string,
    online: boolean,
    meta?: { leaveTime?: string; enterTime?: string; nickname?: string; avatarUrl?: string },
  ) {
    const key = username.trim();
    if (!key) return;
    // 结束态契约：全员 online=false，忽略迟到 Join，避免「在线」残留
    if (ended.value && online) return;
    const row = list.value.find((item) => item.username === key);
    if (row) {
      row.online = online;
      if (!online && meta?.leaveTime) row.leaveTime = meta.leaveTime;
      if (online) {
        if (meta?.enterTime) row.enterTime = meta.enterTime;
        if (meta?.nickname?.trim()) row.nickname = meta.nickname.trim();
        if (meta?.avatarUrl?.trim()) row.avatarUrl = meta.avatarUrl.trim();
        delete row.leaveTime;
      }
      return;
    }
    if (!online) return;
    // 当前 Tab 是离线时不插入在线行；非当前 kind 不插入
    if (tab.value === "offline") return;
    if (!matchesKind(key, kind.value)) return;
    list.value = [
      {
        username: key,
        nickname: meta?.nickname?.trim() || undefined,
        avatarUrl: meta?.avatarUrl?.trim() || undefined,
        enterTime: meta?.enterTime || "",
        online: true,
        roleLabel: isAssistantUsername(key)
          ? key.startsWith("z")
            ? "中控"
            : "助教"
          : undefined,
        commentCount: isAssistantUsername(key) ? undefined : 0,
      },
      ...list.value,
    ];
    total.value += 1;
    if (isAssistantUsername(key)) assistantTotal.value += 1;
    else studentTotal.value += 1;
  }

  async function loadFirst() {
    const seq = ++requestSeq;
    loading.value = true;
    loadingMore.value = false;
    error.value = "";
    // 结束态保留当前行/快照作兜底，避免清空后接口空/不全导致「离线」空白
    const keepFallback =
      ended.value && tab.value !== "online"
        ? list.value.length
          ? list.value.slice()
          : endedLocalSnapshot.slice()
        : [];
    if (!(ended.value && tab.value !== "online" && keepFallback.length)) {
      list.value = [];
      total.value = 0;
    }
    page.value = 1;
    try {
      const apiTab = requestTab(tab.value, ended.value);
      const res = await listAttendees(activityId.value, {
        tab: apiTab,
        page: 1,
        pageSize: PAGE_SIZE,
        keywordType: keywordType.value,
        keyword: keyword.value,
        kind: kind.value,
        followerFilter: followerFilter.value,
        behavior: behavior.value,
      });
      if (seq !== requestSeq) return;
      studentTotal.value = Number(res.studentTotal) || 0;
      assistantTotal.value = Number(res.assistantTotal) || 0;
      allTotal.value = Number(res.allTotal) || 0;
      onlineTotal.value = Number(res.onlineTotal) || 0;
      offlineTotal.value = Number(res.offlineTotal) || 0;
      applyFetchedRows(
        res.list ?? [],
        Number(res.total) || 0,
        res.page ?? 1,
        res.activityState,
        false,
        keepFallback,
      );
    } catch (e) {
      if (seq !== requestSeq) return;
      error.value = e instanceof Error ? e.message : "名单加载失败";
      // 接口失败：结束态用本地快照撑住离线/全部
      if (ended.value && tab.value !== "online" && keepFallback.length) {
        const filtered = keepFallback
          .filter((row) => matchesKind(row.username, kind.value))
          .map((row) => ({ ...row, online: false }));
        list.value = filtered;
        total.value = list.value.length;
      }
    } finally {
      if (seq === requestSeq) loading.value = false;
    }
  }

  /** 结束态：在线 Tab 强制空；其它 Tab 强制 online=false（不补 leaveTime） */
  function applyFetchedRows(
    rows: AttendeeItem[],
    nextTotal: number,
    nextPage: number,
    activityState: number | undefined,
    append: boolean,
    localFallback: AttendeeItem[] = [],
  ) {
    const forceEnded = isEndedState(activityState) || ended.value;
    if (forceEnded && tab.value === "online") {
      list.value = [];
      total.value = 0;
      page.value = 1;
      return;
    }
    if (forceEnded) {
      for (const row of rows) row.online = false;
    }
    let nextList = append ? list.value.concat(rows) : rows;
    let nextTotalValue = nextTotal;
    const kindFallback = localFallback.filter((row) => matchesKind(row.username, kind.value));
    // 结束态 + 离线/全部：接口空或明显少于本地已知人数时，合并本地快照（后端晚翻 state / 空名单）
    if (forceEnded && !append && tab.value !== "online" && kindFallback.length) {
      if (!nextList.length) {
        nextList = kindFallback.map((row) => ({ ...row, online: false }));
        nextTotalValue = Math.max(nextTotalValue, nextList.length);
      } else if (nextList.length < kindFallback.length) {
        nextList = mergeByUsername(
          nextList,
          kindFallback.map((row) => ({ ...row, online: false })),
        );
        nextTotalValue = Math.max(nextTotalValue, nextList.length);
      }
    }
    list.value = nextList;
    total.value = nextTotalValue;
    page.value = nextPage;
    if (forceEnded && tab.value !== "online" && nextList.length) {
      endedLocalSnapshot = nextList.map((row) => ({ ...row, online: false }));
    }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return;
    const seq = requestSeq;
    const next = page.value + 1;
    loadingMore.value = true;
    try {
      const apiTab = requestTab(tab.value, ended.value);
      const res = await listAttendees(activityId.value, {
        tab: apiTab,
        page: next,
        pageSize: PAGE_SIZE,
        keywordType: keywordType.value,
        keyword: keyword.value,
        kind: kind.value,
        followerFilter: followerFilter.value,
        behavior: behavior.value,
      });
      if (seq !== requestSeq) return;
      studentTotal.value = Number(res.studentTotal) || studentTotal.value;
      assistantTotal.value = Number(res.assistantTotal) || assistantTotal.value;
      allTotal.value = Number(res.allTotal) || allTotal.value;
      onlineTotal.value = Number(res.onlineTotal) || onlineTotal.value;
      offlineTotal.value = Number(res.offlineTotal) || offlineTotal.value;
      applyFetchedRows(res.list ?? [], Number(res.total) || 0, res.page ?? next, res.activityState, true);
    } catch (e) {
      if (seq !== requestSeq) return;
      error.value = e instanceof Error ? e.message : "加载更多失败";
    } finally {
      if (seq === requestSeq) loadingMore.value = false;
    }
  }

  function setKind(next: AttendeeKind) {
    if (kind.value === next) return;
    if (searchTimer) clearTimeout(searchTimer);
    kind.value = next;
    // 助教无手机号筛；切过去时清掉不适用条件
    if (next === "assistant") {
      if (keywordType.value === "phone") keywordType.value = "nickname";
      followerFilter.value = "all";
      behavior.value = "all";
    }
    void loadFirst();
  }

  function setTab(next: AttendeeTab) {
    if (tab.value === next) return;
    if (searchTimer) clearTimeout(searchTimer);
    tab.value = next;
    void loadFirst();
  }

  function setFollowerFilter(next: AttendeeFollowerFilter) {
    if (followerFilter.value === next) return;
    if (searchTimer) clearTimeout(searchTimer);
    followerFilter.value = next;
    void loadFirst();
  }

  function setBehavior(next: AttendeeBehavior) {
    if (behavior.value === next) return;
    if (searchTimer) clearTimeout(searchTimer);
    behavior.value = next;
    void loadFirst();
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void loadFirst();
    }, 400);
  }

  function searchNow() {
    if (searchTimer) clearTimeout(searchTimer);
    void loadFirst();
  }

  watch(activityId, () => {
    if (searchTimer) clearTimeout(searchTimer);
    kind.value = "student";
    keywordType.value = "nickname";
    keyword.value = "";
    followerFilter.value = "all";
    behavior.value = "all";
    tab.value = "all";
    brokenAvatars.value = {};
    endedLocalSnapshot = [];
    studentTotal.value = 0;
    assistantTotal.value = 0;
    allTotal.value = 0;
    onlineTotal.value = 0;
    offlineTotal.value = 0;
    void loadFirst();
  });

  // 直播中 → 结束：立刻清在线态；若在「在线」则切「离线」并重拉全员
  watch(ended, (now, prev) => {
    if (!now || now === prev) return;
    applyEndedLocally();
    void loadFirst();
  });

  onMounted(() => {
    void loadFirst();
  });

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  return {
    kind,
    studentTotal,
    assistantTotal,
    allTotal,
    onlineTotal,
    offlineTotal,
    tab,
    keywordType,
    keyword,
    keywordPlaceholder,
    followerFilter,
    behavior,
    list,
    loading,
    loadingMore,
    error,
    hasMore,
    displayName,
    avatarSrc,
    markAvatarBroken,
    patchOnline,
    loadFirst,
    loadMore,
    setKind,
    setTab,
    setFollowerFilter,
    setBehavior,
    scheduleSearch,
    searchNow,
  };
}
