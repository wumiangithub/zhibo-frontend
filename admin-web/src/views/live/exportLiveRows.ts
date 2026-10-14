import * as XLSX from "xlsx";
import {
  LIVE_STATE_LABEL,
  LIVE_TYPE_LABEL,
  RISK_STATUS_LABEL,
  SHELF_STATUS_LABEL,
  sellTagText,
  type ActivityListItem,
  type RiskStatus,
  type ShelfStatus,
} from "@/api/activity";

function ownersText(item: ActivityListItem) {
  const names = (item.owners ?? []).map((o) => o.userName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function productsText(item: ActivityListItem) {
  const names = (item.products ?? []).map((p) => p.productName).filter(Boolean);
  return names.length ? names.join("、") : "--";
}

function shelfText(item: ActivityListItem) {
  const s = (item.shelfStatus ?? "pending") as ShelfStatus;
  return SHELF_STATUS_LABEL[s];
}

function riskText(item: ActivityListItem) {
  const s = (item.riskStatus ?? "pending") as RiskStatus;
  return RISK_STATUS_LABEL[s];
}

/** 导出勾选行；列与列表表格一致（不含复选框与操作） */
export function exportLiveRows(rows: ActivityListItem[]) {
  const data = rows.map((item) => ({
    直播名称: item.title,
    售卖标签: sellTagText(item),
    直播类型: LIVE_TYPE_LABEL[item.type] ?? String(item.type),
    上架状态: shelfText(item),
    直播开始时间: item.startTime || "--",
    归属人: ownersText(item),
    直播状态: LIVE_STATE_LABEL[item.state] ?? String(item.state),
    关联商品: productsText(item),
    风控合规审核: riskText(item),
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "直播列表");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
  XLSX.writeFile(book, `直播列表_${stamp}.xlsx`);
}
