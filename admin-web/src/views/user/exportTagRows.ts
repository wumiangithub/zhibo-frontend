import * as XLSX from "xlsx";
import {
  ViewerTagType,
  viewerTagTypeLabel,
  type ViewerTagItem,
} from "@/api/viewerTag";

/** 导出勾选行；列与标签列表一致（不含复选框与操作） */
export function exportTagRows(rows: ViewerTagItem[]) {
  const data = rows.map((item) => ({
    标签名字: item.name,
    标签类型: viewerTagTypeLabel(item.type),
    标签定义:
      item.type === ViewerTagType.AUTO ? (item.definitionSummary ?? "") : "--",
    标签人数: item.userCount ?? 0,
    所属分组: item.groupName ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "标签列表");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  XLSX.writeFile(book, `标签列表_${stamp}.xlsx`);
}
