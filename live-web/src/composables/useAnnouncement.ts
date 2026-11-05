import { reactive } from "vue";

/** 官方 demo Notice：实时 `res.data.room_announcement_text`；历史条目多为 `content` */
function pickAnnouncementText(raw: unknown): string {
  const root = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  // $on 回调常是整包 res；也兼容直接传 data / data.data
  const layer =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, any>)
      : root;
  const nested =
    layer.data && typeof layer.data === "object" && !Array.isArray(layer.data)
      ? (layer.data as Record<string, any>)
      : null;
  return (
    layer.room_announcement_text ||
    nested?.room_announcement_text ||
    layer.content ||
    layer.announcement ||
    nested?.content ||
    nested?.announcement ||
    ""
  );
}

/** 房间公告：实时推送 + 进房拉历史，取最新一条 */
export function useAnnouncement(getSdk: () => VhallSdkInstance | null) {
  const notice = reactive({ text: "" });

  function handleAnnouncement(data: unknown) {
    const text = pickAnnouncementText(data);
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
        const text = pickAnnouncementText(list[0]);
        if (text) {
          notice.text = text;
        }
      }
    } catch (e) {
      // 与聊天历史同路：偶发 CORS；已有实时公告时不刷 warn
      if (!notice.text) {
        console.warn("加载公告历史失败", e);
      }
    }
  }

  function clear() {
    notice.text = "";
  }

  return Object.assign(notice, { handleAnnouncement, loadHistory, clear });
}

export type AnnouncementController = ReturnType<typeof useAnnouncement>;
