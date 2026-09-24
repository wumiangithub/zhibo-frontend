import { reactive, ref } from "vue";

export type LiveMode = "video" | "recorded" | "voice";
export type ViewerStyle = "traditional" | "immersive";

export interface PlaybackPeriod {
  /** 开始时间，空表示「直播结束时」 */
  start: string;
  end: string;
}

export interface LiveFormState {
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
  owner: string;
  courseId: string;
  sellAlone: boolean;
  sellType: "free" | "paid" | "encrypted" | "specified";
  validity: string;
  productGroup: string;
  shelfType: "now" | "scheduled" | "none";
  shelfTime: string;
  hidden: boolean;
  stopped: boolean;
  agreed: boolean;
}

export function useLiveForm() {
  const form = reactive<LiveFormState>({
    mode: "video",
    viewerStyle: "traditional",
    ultraLowLatency: true,
    virtualAvatar: false,
    name: "",
    intro: "",
    startDate: "",
    startTime: "10:00",
    endDate: "",
    endTime: "",
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
    owner: "",
    courseId: "",
    sellAlone: true,
    sellType: "free",
    validity: "长期有效，暂不支持修改",
    productGroup: "",
    shelfType: "now",
    shelfTime: "",
    hidden: false,
    stopped: false,
    agreed: false,
  });

  const submitting = ref(false);

  function validate(): string | null {
    if (!form.name.trim()) return "请填写直播名称";
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
    if (form.playbackEnabled && form.playbackValidity === "period") {
      for (let i = 0; i < form.playbackPeriods.length; i++) {
        const p = form.playbackPeriods[i];
        const start =
          p.start ||
          (i === 0 && form.endDate && form.endTime
            ? `${form.endDate} ${form.endTime.length === 5 ? `${form.endTime}:00` : form.endTime}`
            : "");
        if (!start) return `请选择第 ${i + 1} 个回放时段的开始时间`;
        if (!p.end) return `请选择第 ${i + 1} 个回放时段的结束时间`;
        if (new Date(p.end).getTime() <= new Date(start).getTime()) {
          return `第 ${i + 1} 个回放时段：结束时间必须大于开始时间`;
        }
      }
    }
    if (!form.agreed) return "请先阅读并同意《直播运营规范》";
    return null;
  }

  return { form, submitting, validate };
}
