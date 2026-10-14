import { reactive, ref } from "vue";
import type { ActivityProduct, LiveProvider, SellType } from "@/api/activity";

export type LiveMode = "video" | "recorded" | "voice";
export type ViewerStyle = "traditional" | "immersive";

export interface PlaybackPeriod {
  /** 开始时间，空表示「直播结束时」 */
  start: string;
  end: string;
}

export interface LiveFormState {
  provider: LiveProvider;
  mode: LiveMode;
  viewerStyle: ViewerStyle;
  ultraLowLatency: boolean;
  virtualAvatar: boolean;
  name: string;
  intro: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** type=4 录播时必填（微吼 recordId） */
  recordId: string;
  /** 选中资源展示名 */
  recordLabel: string;
  /** 选择来源：素材视频 / 微吼直播回放 */
  recordSource: "" | "video" | "live";
  detailCover: string;
  warmupType: "image" | "video";
  warmupImage: string;
  promoCover: string;
  detailHtml: string;
  roles: string[];
  playbackEnabled: boolean;
  playbackValidity: "forever" | "days" | "period";
  playbackDays: number;
  /** 指定时段有效，最多 5 条 */
  playbackPeriods: PlaybackPeriod[];
  playbackSpeed: "allow" | "forbid";
  fastForward: "allow" | "forbid";
  replayProtection: boolean;
  /** 归属人员工 id（rs_mainkey_id 十进制字符串） */
  ownerIds: string[];
  /** 关联商品快照 */
  products: ActivityProduct[];
  courseId: string;
  sellAlone: boolean;
  sellType: SellType;
  validity: string;
  productGroup: string;
  shelfType: "now" | "scheduled" | "none";
  shelfTime: string;
  hidden: boolean;
  stopped: boolean;
  agreed: boolean;
}

export const MODE_TO_TYPE: Record<LiveMode, number> = {
  video: 2,
  voice: 1,
  recorded: 4,
};

export function useLiveForm() {
  const form = reactive<LiveFormState>({
    provider: "vhall",
    mode: "video",
    viewerStyle: "traditional",
    ultraLowLatency: true,
    virtualAvatar: false,
    name: "",
    intro: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    recordId: "",
    recordLabel: "",
    recordSource: "",
    detailCover: "",
    warmupType: "image",
    warmupImage: "",
    promoCover: "",
    detailHtml: "",
    roles: [],
    playbackEnabled: true,
    playbackValidity: "forever",
    playbackDays: 7,
    playbackPeriods: [{ start: "", end: "" }],
    playbackSpeed: "allow",
    fastForward: "allow",
    replayProtection: false,
    ownerIds: [],
    products: [],
    courseId: "",
    sellAlone: true,
    sellType: "free",
    validity: "长期有效",
    productGroup: "",
    shelfType: "now",
    shelfTime: "",
    hidden: false,
    stopped: false,
    agreed: false,
  });

  const submitting = ref(false);

  function validate(): string | null {
    if (!form.provider) return "请选择直播服务商";
    const title = form.name.trim();
    if (!title) return "请填写直播名称";
    if (title.length > 64) return "直播名称不能超过 64 字";
    const intro = form.intro.trim();
    if (form.provider === "vhall" && form.mode === "recorded" && !intro) {
      return "微吼录播请填写直播简介";
    }
    if (intro.length > 256) return "直播简介不能超过 256 字";
    if (!form.startDate) return "请选择开始日期";
    if (!form.startTime) return "请选择开始时间";
    if (form.endDate && form.endTime) {
      const startAt = new Date(`${form.startDate} ${form.startTime}:00`).getTime();
      const endAt = new Date(`${form.endDate} ${form.endTime}:00`).getTime();
      if (endAt <= startAt) return "结束时间必须大于开始时间";
    } else if (form.endDate && !form.endTime) {
      return "请选择结束时间";
    } else if (!form.endDate && form.endTime) {
      return "请选择结束日期";
    }
    if (form.mode === "recorded" && form.provider === "vhall" && !form.recordId.trim()) {
      return "录播模式请选择视频或直播回放资源";
    }
    if (!form.agreed) return "请先阅读并同意《直播运营规范》";
    return null;
  }

  return { form, submitting, validate };
}
