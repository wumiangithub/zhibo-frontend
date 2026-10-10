import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { listAttendees, type AttendeeItem, type AttendeeTab } from "@/api/attendees";

const PAGE_SIZE = 20;

function isEndedState(state: number | undefined): boolean {
  return state === 3 || state === 4 || state === 5;
}

/** 结束态契约：全员 offline，offline ≡ all；请求用 all 避免后端尚未翻 state 时把仍标 online 的人滤掉 */
function requestTab(uiTab: AttendeeTab, forceEnded: boolean): AttendeeTab {
  if (forceEnded && uiTab === "offline") return "all";
  return uiTab;
}

function mergeByUserId(primary: AttendeeItem[], fallback: AttendeeItem[]): AttendeeItem[] {
  const seen = new Set(primary.map((r) => r.userId));
  const extra = fallback.filter((r) => r.userId && !seen.has(r.userId));
  return primary.concat(extra);
}

/** 中控台左侧名单：换 Tab、改搜索词从第 1 页重拉（D37）；加载更多只在点击时请求。 */
export function useAttendeeList(
  activityId: Ref<string>,
  /** 直播已结束/点播/回放：D30 全员离线，不再吃 Join 本地补丁 */
  activityEnded?: Ref<boolean>,
) {
  const tab = ref<AttendeeTab>("all");
  const keyword = ref("");
  const list = ref<AttendeeItem[]>([]);
  const total = ref(0);
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
    return item.nickname?.trim() || "观众";
  }

  function avatarSrc(item: AttendeeItem): string {
    if (!item.avatarUrl || brokenAvatars.value[item.userId]) return "";
    return item.avatarUrl;
  }

  function markAvatarBroken(userId: string) {
    brokenAvatars.value = { ...brokenAvatars.value, [userId]: true };
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
    userId: string,
    online: boolean,
    meta?: { leaveTime?: string; enterTime?: string; nickname?: string; avatarUrl?: string },
  ) {
    const uid = userId.trim();
    if (!uid) return;
    // 结束态契约：全员 online=false，忽略迟到 Join，避免「在线」残留
    if (ended.value && online) return;
    const row = list.value.find((item) => item.userId === uid);
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
    // 当前 Tab 是离线时不插入在线行
    if (tab.value === "offline") return;
    list.value = [
      {
        userId: uid,
        nickname: meta?.nickname?.trim() || undefined,
        avatarUrl: meta?.avatarUrl?.trim() || undefined,
        enterTime: meta?.enterTime || "",
        online: true,
      },
      ...list.value,
    ];
    total.value += 1;
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
        keyword: keyword.value,
      });
      if (seq !== requestSeq) return;
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
        list.value = keepFallback.map((row) => ({ ...row, online: false }));
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
    // 结束态 + 离线/全部：接口空或明显少于本地已知人数时，合并本地快照（后端晚翻 state / 空名单）
    if (forceEnded && !append && tab.value !== "online" && localFallback.length) {
      if (!nextList.length) {
        nextList = localFallback.map((row) => ({ ...row, online: false }));
        nextTotalValue = Math.max(nextTotalValue, nextList.length);
      } else if (nextList.length < localFallback.length) {
        nextList = mergeByUserId(
          nextList,
          localFallback.map((row) => ({ ...row, online: false })),
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
        keyword: keyword.value,
      });
      if (seq !== requestSeq) return;
      applyFetchedRows(res.list ?? [], Number(res.total) || 0, res.page ?? next, res.activityState, true);
    } catch (e) {
      if (seq !== requestSeq) return;
      error.value = e instanceof Error ? e.message : "加载更多失败";
    } finally {
      if (seq === requestSeq) loadingMore.value = false;
    }
  }

  function setTab(next: AttendeeTab) {
    if (tab.value === next) return;
    if (searchTimer) clearTimeout(searchTimer);
    tab.value = next;
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
    keyword.value = "";
    tab.value = "all";
    brokenAvatars.value = {};
    endedLocalSnapshot = [];
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
    tab,
    keyword,
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
    setTab,
    scheduleSearch,
    searchNow,
  };
}
