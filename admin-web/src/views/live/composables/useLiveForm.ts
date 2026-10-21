import { reactive, ref } from "vue";
import type { AuthUser } from "@/api/auth";
import type {
  AccessValidityType,
  ActivityCourseware,
  ActivityProduct,
  EmployeeItem,
  LiveProvider,
  PlaybackValidityType,
  SellType,
} from "@/api/activity";

/**
 * 新建页专用：归属人默认当前登录用户。
 * 编辑/设置页勿调用——已有 owners 以详情为准，不能被当前用户覆盖。
 * 若该用户暂不在 /employees 列表，仍写入 ownerIds，并由 knownOwners 带姓名回显。
 */
export function resolveDefaultOwner(user: AuthUser | null | undefined): {
  ownerIds: string[];
  knownOwners: EmployeeItem[];
} {
  if (user?.id == null) return { ownerIds: [], knownOwners: [] };
  const id = String(user.id);
  const userName = (user.userName || user.userAccount || id).trim() || id;
  const avatar = user.avatar?.trim() || undefined;
  return { ownerIds: [id], knownOwners: [{ id, userName, avatar }] };
}

export type LiveMode = "video" | "recorded" | "voice";
export type ViewerStyle = "traditional" | "immersive";

export interface LiveFormState {
  provider: LiveProvider;
  mode: LiveMode;
  viewerStyle: ViewerStyle;
  /** 创建默认 true；UI 可不展示 */
  ultraLowLatency: boolean;
  name: string;
  intro: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** type=4 + 选「直播回放」：微吼 record_id */
  recordId: string;
  /** type=4 + 选「素材视频」：本站素材 UUID → 后端 create-by-url */
  materialId: string;
  /** 选中资源展示名 */
  recordLabel: string;
  /** 选择来源：素材视频 / 微吼直播回放 */
  recordSource: "" | "video" | "live";
  detailCover: string;
  detailHtml: string;
  /** 绑定的已通过直播报备 UUID；空表示未绑定 */
  reportId: string;
  /** 所选报备主播快照，供只读回显 */
  reportHost: EmployeeItem | null;
  /** 主播员工 id；UI 单选，提交时长度为 0 或 1 的数组 */
  hostIds: string[];
  /** 归属人员工 id */
  ownerIds: string[];
  /** 关联商品快照 */
  products: ActivityProduct[];
  /** 课件素材 id（有序） */
  coursewareMaterialIds: string[];
  /** 课件展示快照（详情回显 / 新建选中后本地展示） */
  coursewares: ActivityCourseware[];
  /** 是否自动上架 */
  autoList: boolean;
  /** 售卖（设置页售卖 Tab；新建不提交） */
  sellAlone: boolean;
  sellType: SellType;
  price: string;
  linePrice: string;
  password: string;
  accessValidityType: AccessValidityType;
  accessValidityDays: number;
  /** 回放（设置页回放 Tab） */
  playbackEnabled: boolean;
  playbackValidityType: PlaybackValidityType;
  playbackValidityDays: number;
  playbackSpeedAllow: boolean;
  playbackFastForwardAllow: boolean;
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
    name: "",
    intro: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    recordId: "",
    materialId: "",
    recordLabel: "",
    recordSource: "",
    detailCover: "",
    detailHtml: "",
    reportId: "",
    reportHost: null,
    hostIds: [],
    ownerIds: [],
    products: [],
    coursewareMaterialIds: [],
    coursewares: [],
    autoList: true,
    sellAlone: true,
    sellType: "free",
    price: "",
    linePrice: "",
    password: "",
    accessValidityType: "long",
    accessValidityDays: 7,
    playbackEnabled: true,
    playbackValidityType: "forever",
    playbackValidityDays: 7,
    playbackSpeedAllow: true,
    playbackFastForwardAllow: true,
    agreed: false,
  });

  const submitting = ref(false);

  /** 新建页校验 */
  function validateCreate(): string | null {
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
    const startAt = new Date(`${form.startDate} ${form.startTime}:00`).getTime();
    if (Number.isNaN(startAt)) return "开始时间无效";
    // 对齐微吼：定时开始须晚于当前至少 2 分钟，避免打到云侧才 512096
    const minStartAt = Date.now() + 2 * 60 * 1000;
    if (startAt < minStartAt) {
      return "开始时间须晚于当前时间至少 2 分钟";
    }
    if (form.endDate && form.endTime) {
      const endAt = new Date(`${form.endDate} ${form.endTime}:00`).getTime();
      if (endAt <= startAt) return "结束时间必须大于开始时间";
    } else if (form.endDate && !form.endTime) {
      return "请选择结束时间";
    } else if (!form.endDate && form.endTime) {
      return "请选择结束日期";
    }
    if (form.mode === "recorded" && form.provider === "vhall") {
      const hasVideo = form.recordSource === "video" && form.materialId.trim();
      const hasLive = form.recordSource === "live" && form.recordId.trim();
      if (!hasVideo && !hasLive) {
        return "录播模式请选择视频或直播回放资源";
      }
    }
    if (!form.hostIds.length) return "请选择主播";
    if (form.ownerIds.length > 20) return "归属人最多选择 20 人";
    if (form.products.length > 20) return "关联商品最多 20 个";
    if (form.coursewareMaterialIds.length > 100) return "课件资料最多 100 个";
    if (!form.agreed) return "请先阅读并同意《直播运营规范》";
    return null;
  }

  /** @deprecated 用 validateCreate */
  function validate(): string | null {
    return validateCreate();
  }

  return { form, submitting, validate, validateCreate };
}
