import { reactive } from "vue";
import type { ActivityCourseware } from "@/api/activity";

export interface CourseBasicFormModel {
  name: string;
  intro: string;
  detailHtml: string;
  coverMaterialId: string;
  coverUrl: string;
  autoList: boolean;
  ownerIds: number[];
  coursewareMaterialIds: string[];
  coursewares: ActivityCourseware[];
}

export const COURSE_DETAIL_PLACEHOLDER = [
  "1.支持从第三方编辑器粘贴内容",
  "2.图片宽高自适应显示(推荐宽度分辨率750px)",
  "3.图片支持jpg、png、gif格式，每张图片大小不超过5M",
].join("\n");

export const COURSE_AUTO_LIST_INFO =
  "若选是，合规风控部门审核课程信息及课程资料通过后，课程/子课程/小节会自动上架";

export function createEmptyCourseForm(
  defaults?: Partial<Pick<CourseBasicFormModel, "autoList" | "ownerIds">>,
): CourseBasicFormModel {
  return reactive({
    name: "",
    intro: "",
    detailHtml: "",
    coverMaterialId: "",
    coverUrl: "",
    autoList: defaults?.autoList ?? true,
    ownerIds: [...(defaults?.ownerIds ?? [])],
    coursewareMaterialIds: [],
    coursewares: [],
  });
}

export function visibleTextLength(html: string) {
  return html.replace(/<[^>]+>/gi, "").replace(/&nbsp;/g, " ").replace(/&[a-zA-Z#0-9]+;/g, "").length;
}

export function validateCourseBasicForm(form: CourseBasicFormModel): string {
  const name = form.name.trim();
  if (!name) return "请输入课程名称";
  if (name.length > 45) return "课程名称不能超过45个字";
  if (!form.coverMaterialId) return "请选择课程封面";
  if (form.intro.trim().length > 256) return "课程简介不能超过256个字";
  const detail = form.detailHtml.trim();
  if (detail.length > 200000) return "课程详情内容过长";
  if (visibleTextLength(detail) > 10000) return "课程详情不能超过10000个字";
  if (!form.ownerIds.length) return "请选择归属人";
  if (form.coursewareMaterialIds.length > 100) return "课件资料最多 100 个";
  return "";
}
