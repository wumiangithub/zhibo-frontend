import * as XLSX from "xlsx";
import {
  RISK_STATUS_LABEL,
  SHELF_STATUS_LABEL,
  type CourseListItem,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/course";

function ownersText(item: CourseListItem) {
  const names = (item.owners ?? []).map((owner) => owner.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function timeText(raw?: string) {
  if (!raw) return "--";
  return raw.length >= 19 ? raw.slice(0, 19) : raw;
}

/** 导出勾选行；列与列表一致（不含复选框与操作） */
export function exportCourseRows(rows: CourseListItem[]) {
  const data = rows.map((item) => ({
    课程名称: item.title,
    价格有效期: "未设置",
    上架状态: SHELF_STATUS_LABEL[(item.shelfStatus ?? "pending") as ShelfStatus],
    上架时间: timeText(item.listedTime),
    归属人: ownersText(item),
    内容数: item.contentCount ?? 0,
    权益用户数: item.entitledUserCount ?? 0,
    累计用户数: item.totalUserCount ?? 0,
    总销量: item.salesCount ?? 0,
    最新修改时间: timeText(item.updatedTime),
    风控合规审核: RISK_STATUS_LABEL[(item.riskStatus ?? "pending") as RiskStatus],
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "课程列表");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
  XLSX.writeFile(book, `课程列表_${stamp}.xlsx`);
}
