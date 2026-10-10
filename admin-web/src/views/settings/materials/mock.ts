/** 素材中心 Mock（后续接 TOS / 素材 API） */

export type MaterialType = "image" | "video" | "document";

export type AuditStatus = "passed" | "rejected" | "pending";

export type MaterialAvailStatus = "available" | "unavailable";

export interface MaterialGroup {
  id: string;
  name: string;
  count: number;
}

export interface MaterialItem {
  id: string;
  type: MaterialType;
  name: string;
  /** 缩略图 / 封面 URL，空则占位 */
  thumbUrl: string;
  /** 图片尺寸文案，如 1261*705；视频可为时长 */
  meta: string;
  status: MaterialAvailStatus;
  uploadedAt: string;
  uploader: string;
  department: string;
  aiAudit: AuditStatus;
  riskAudit: AuditStatus;
  groupId: string;
}

export const TYPE_TABS: { key: MaterialType; label: string }[] = [
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "document", label: "文档" },
];

export const AUDIT_OPTIONS: { value: "" | AuditStatus; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "passed", label: "已通过" },
  { value: "rejected", label: "已驳回" },
  { value: "pending", label: "待审核" },
];

export const MOCK_GROUPS: Record<MaterialType, MaterialGroup[]> = {
  image: [
    { id: "all", name: "全部图片", count: 556 },
    { id: "default", name: "默认分组", count: 400 },
    { id: "editor", name: "富文本编辑器", count: 22 },
    { id: "academy", name: "钱坤大学堂", count: 86 },
    { id: "g2", name: "分组名称2", count: 12 },
    { id: "g3", name: "分组名称3", count: 8 },
    { id: "g4", name: "分组名称4", count: 15 },
    { id: "g5", name: "分组名称5", count: 6 },
    { id: "g6", name: "分组名称6", count: 7 },
  ],
  video: [
    { id: "all", name: "全部视频", count: 48 },
    { id: "default", name: "默认分组", count: 30 },
    { id: "promo", name: "宣传素材", count: 12 },
    { id: "course", name: "课程录制", count: 6 },
  ],
  document: [
    { id: "all", name: "全部文档", count: 26 },
    { id: "default", name: "默认分组", count: 18 },
    { id: "contract", name: "合同资料", count: 8 },
  ],
};

const IMAGE_NAMES = [
  "鸿鹄量化支撑空间+公域投放封面",
  "春季公开课主视觉",
  "产品介绍长图",
  "直播预告海报",
  "钱坤大学堂-章节封面",
  "富文本插图-流程图",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function mockTime(day: number, hour: number, min: number) {
  return `2026-09-${pad(day)} ${pad(hour)}:${pad(min)}:41`;
}

/** 生成图片列表 Mock */
export function buildMockImages(): MaterialItem[] {
  const list: MaterialItem[] = [];
  const groupCycle = ["default", "editor", "academy", "g2", "g3", "g4", "g5", "g6"];
  for (let i = 0; i < 40; i++) {
    const name = IMAGE_NAMES[i % IMAGE_NAMES.length];
    const w = 800 + (i % 7) * 80;
    const h = 450 + (i % 5) * 40;
    list.push({
      id: `img-${i + 1}`,
      type: "image",
      name: `${name}${i > 5 ? `-${i + 1}` : ""}`,
      thumbUrl: `https://picsum.photos/seed/mat${i + 1}/160/90`,
      meta: `${w}*${h}`,
      status: i % 9 === 0 ? "unavailable" : "available",
      uploadedAt: mockTime(10 + (i % 16), 10 + (i % 8), (i * 3) % 60),
      uploader: i % 3 === 0 ? "曾鹏" : i % 3 === 1 ? "李敏" : "王芳",
      department: i % 2 === 0 ? "事业六部" : "产品中心",
      aiAudit: i % 7 === 0 ? "rejected" : i % 5 === 0 ? "pending" : "passed",
      riskAudit: i % 11 === 0 ? "pending" : i % 8 === 0 ? "rejected" : "passed",
      groupId: groupCycle[i % groupCycle.length],
    });
  }
  return list;
}

export function buildMockVideos(): MaterialItem[] {
  const titles = ["产品介绍成片", "春季公开课录制", "答疑精剪版", "品牌宣传片", "功能演示短片"];
  return titles.map((title, i) => ({
    id: `vid-${i + 1}`,
    type: "video" as const,
    name: title,
    thumbUrl: `https://picsum.photos/seed/vid${i + 1}/160/90`,
    meta: ["12:30", "48:05", "25:40", "03:18", "08:02"][i],
    status: (i === 2 ? "unavailable" : "available") as MaterialAvailStatus,
    uploadedAt: mockTime(20 + i, 9 + i, 10),
    uploader: "曾鹏",
    department: "事业六部",
    aiAudit: (i === 2 ? "pending" : "passed") as AuditStatus,
    riskAudit: "passed" as AuditStatus,
    groupId: i < 3 ? "default" : "promo",
  }));
}

export function buildMockDocuments(): MaterialItem[] {
  const titles = ["合作协议模板.pdf", "直播话术大纲.docx", "报价单-2026Q3.xlsx", "培训课件.pptx"];
  return titles.map((title, i) => ({
    id: `doc-${i + 1}`,
    type: "document" as const,
    name: title,
    thumbUrl: "",
    meta: ["1.2 MB", "86 KB", "240 KB", "4.5 MB"][i],
    status: "available" as MaterialAvailStatus,
    uploadedAt: mockTime(18 + i, 14, 20),
    uploader: "李敏",
    department: "产品中心",
    aiAudit: "passed" as AuditStatus,
    riskAudit: (i === 1 ? "pending" : "passed") as AuditStatus,
    groupId: i < 2 ? "default" : "contract",
  }));
}

export const UPLOAD_ACCEPT: Record<MaterialType, string> = {
  image: ".png,.jpg,.bmp,.gif,.jpeg",
  video: ".mp4,.avi,.wmv,.mov,.flv,.rmvb,.3gp,.m4v,.mkv,.webm",
  document: ".pptx,.ppt,.docx,.doc,.xls,.xlsx,.pdf,.csv,.xlsm,.txt,.zip,.vtt",
};

/** 拖拽区主文案：前半句 + 蓝色可点文案（抄截图） */
export const UPLOAD_DRAG_TEXT: Record<MaterialType, { prefix: string; link: string }> = {
  image: { prefix: "将图片拖拽至此处，或点击", link: "选择图片" },
  video: { prefix: "将文件拖拽至此处，或点击", link: "选择文件" },
  document: { prefix: "将文件拖拽至此处，或点击", link: "选择文件" },
};

export const UPLOAD_HINTS: Record<MaterialType, string[]> = {
  image: [
    "支持上传25.00MB以内的png、jpg、bmp、gif、jpeg格式图片",
    "图像长度、宽度<3万像素和长宽像素相乘<2.5亿像素",
    "一次最多上传100个文件",
  ],
  video: [
    "支持上传5.00GB以内的mp4、avi、wmv、mov、flv、rmvb、3gp、m4v、mkv、webm格式视频",
    "一次最多上传100个文件",
    "当前最大支持1080高清转码",
  ],
  document: [
    "支持上传1.00GB以内的pptx、ppt、docx、doc、xls、xlsx、pdf、csv、xlsm、txt、zip格式文档,10.00MB以内的vtt格式文档",
    "一次最多上传100个文件",
  ],
};

export const UPLOAD_TITLE: Record<MaterialType, string> = {
  image: "上传图片",
  video: "上传视频",
  document: "上传文档",
};

export const UPLOAD_BTN: Record<MaterialType, string> = {
  image: "上传图片",
  video: "上传视频",
  document: "上传文档",
};

export const NAME_FILTER_LABEL: Record<MaterialType, string> = {
  image: "图片名称",
  video: "视频名称",
  document: "文档名称",
};

export const COL_ASSET_LABEL: Record<MaterialType, string> = {
  image: "图片",
  video: "视频",
  document: "文档",
};

export const COL_STATUS_LABEL: Record<MaterialType, string> = {
  image: "图片状态",
  video: "视频状态",
  document: "文档状态",
};
