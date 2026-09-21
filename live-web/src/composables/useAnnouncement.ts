import { reactive } from "vue";

/** 房间公告：实时推送 + 进房拉历史，取最新一条 */
export function useAnnouncement(getSdk: () => VhallSdkInstance | null) {
  const notice = reactive({ text: "" });

  function handleAnnouncement(data: unknown) {
    const payload = data as { content?: string; announcement?: string };
    const text = payload.content || payload.announcement || "";
    if (text) {
      notice.text = text;
    }
  }

  async function loadHistory() {
    const sdk = getSdk();
    if (!sdk) return;
    try {
      const res = await sdk.vhall_get_history_notice(1);
      // SDK 把列表放在 data.data
      const raw = res as Record<string, any>;
      const list: Record<string, any>[] = Array.isArray(raw) ? raw : raw.data?.data || raw.data || [];
      if (list.length > 0) {
        const latest = list[0] as { content?: string; announcement?: string };
        const text = latest.content || latest.announcement || "";
        if (text) {
          notice.text = text;
        }
      }
    } catch (e) {
      console.warn("加载公告历史失败", e);
    }
  }

  function clear() {
    notice.text = "";
  }

  return Object.assign(notice, { handleAnnouncement, loadHistory, clear });
}

export type AnnouncementController = ReturnType<typeof useAnnouncement>;
