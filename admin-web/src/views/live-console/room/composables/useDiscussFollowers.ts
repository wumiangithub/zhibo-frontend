import { computed, ref, watch, type Ref } from "vue";
import {
  listAudiences,
  type AudienceListItem,
} from "@/api/audience";

export interface DiscussFollower {
  id: number;
  name: string;
}

/** 邀请人优先于导入人 */
function resolveFollower(row: AudienceListItem): { id: number; name: string } | null {
  if (row.employeeInviterId != null && row.employeeInviterId > 0) {
    return {
      id: row.employeeInviterId,
      name: (row.inviterDisplayName || "").trim() || `员工${row.employeeInviterId}`,
    };
  }
  if (row.importerId != null && row.importerId > 0) {
    return {
      id: row.importerId,
      name: (row.importerName || "").trim() || `员工${row.importerId}`,
    };
  }
  return null;
}

/**
 * 拉本场观众名单，建 viewerId → 跟进人（邀请优先）映射，并汇总跟进人下拉。
 */
export function useDiscussFollowers(activityId: Ref<string> | (() => string)) {
  const loading = ref(false);
  /** viewerId 字符串 → 跟进人员工 id */
  const followerByViewerId = ref<Map<string, number>>(new Map());
  const followers = ref<DiscussFollower[]>([]);

  const activityIdRef = computed(() =>
    typeof activityId === "function" ? activityId() : activityId.value,
  );

  async function load() {
    const id = activityIdRef.value.trim();
    if (!id) {
      followerByViewerId.value = new Map();
      followers.value = [];
      return;
    }
    loading.value = true;
    try {
      const viewerMap = new Map<string, number>();
      const followerMap = new Map<number, string>();
      let page = 1;
      const pageSize = 100;
      let total = Infinity;
      while ((page - 1) * pageSize < total) {
        const res = await listAudiences(id, { page, pageSize });
        total = res.total ?? 0;
        const list = res.list ?? [];
        for (const row of list) {
          const f = resolveFollower(row);
          if (!f) continue;
          viewerMap.set(String(row.viewerId), f.id);
          const prev = followerMap.get(f.id);
          if (!prev || (prev.startsWith("员工") && !f.name.startsWith("员工"))) {
            followerMap.set(f.id, f.name);
          }
        }
        if (list.length === 0) break;
        page += 1;
        // 防护：异常 total 时避免死循环
        if (page > 200) break;
      }
      followerByViewerId.value = viewerMap;
      followers.value = [...followerMap.entries()]
        .map(([fid, name]) => ({ id: fid, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "zh"));
    } catch (e) {
      console.warn("讨论区加载观众跟进人失败", e);
      followerByViewerId.value = new Map();
      followers.value = [];
    } finally {
      loading.value = false;
    }
  }

  watch(activityIdRef, () => {
    void load();
  }, { immediate: true });

  function followerIdOfViewer(viewerUserId: string | undefined): number | null {
    if (!viewerUserId) return null;
    return followerByViewerId.value.get(viewerUserId) ?? null;
  }

  return {
    loading,
    followers,
    followerByViewerId,
    followerIdOfViewer,
    reload: load,
  };
}
