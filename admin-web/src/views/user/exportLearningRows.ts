import * as XLSX from "xlsx";
import {
  formatLearnDurationSec,
  type LearningCourseItem,
  type LearningSummaryItem,
} from "@/api/viewer";

/** 导出学习统计 · 汇总勾选行 */
export function exportLearningSummaryRows(rows: LearningSummaryItem[]) {
  const data = rows.map((item) => ({
    用户: item.nickname,
    用户名: item.username,
    标签: (item.tagLabels ?? []).join("、"),
    累计学习时长: formatLearnDurationSec(item.totalLearnDurationSec ?? 0),
    累计学习天数: item.totalLearnDays ?? 0,
    观看课程数: item.viewedCourseCount ?? 0,
    完成课程数: item.completedCourseCount ?? 0,
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "汇总数据");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  XLSX.writeFile(book, `用户学习统计_汇总_${stamp}.xlsx`);
}

/** 导出学习统计 · 课程数据勾选行（小节维度） */
export function exportLearningCourseRows(rows: LearningCourseItem[]) {
  const data = rows.map((item) => ({
    用户: item.nickname,
    用户名: item.username,
    小节名称: item.lessonName ?? "",
    标签: (item.tagLabels ?? []).join("、"),
    累计学习时长: formatLearnDurationSec(item.totalLearnDurationSec ?? 0),
    学习进度: `${item.progressPercent ?? 0}%`,
    首次学习时间: item.firstLearnTime ?? "",
    完成时间: item.completedTime ?? "",
    课程类型: item.lessonType ?? "",
    课程资源时长: formatLearnDurationSec(item.lessonDurationSec ?? 0),
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "课程数据");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  XLSX.writeFile(book, `用户学习统计_课程_${stamp}.xlsx`);
}
