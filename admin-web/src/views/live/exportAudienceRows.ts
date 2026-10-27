import * as XLSX from "xlsx";
import { formatDurationSec, type AudienceListItem } from "@/api/audience";

/** 导出勾选行；列与用户管理列表一致（不含复选框与操作） */
export function exportAudienceRows(rows: AudienceListItem[]) {
  const data = rows.map((item) => ({
    用户: item.nickname,
    权益状态: item.entitlementStatus === 1 ? "有效" : "无权益",
    所属邀请人: item.inviterDisplayName || "",
    标签: (item.tagLabels ?? []).join("、"),
    直播间停留时长: formatDurationSec(item.stayDurationSec),
    累计观看时长: formatDurationSec(item.totalWatchDurationSec),
    直播观看时长: formatDurationSec(item.liveWatchDurationSec),
    回放观看时长: formatDurationSec(item.replayWatchDurationSec),
    评论次数: item.commentCount,
    "直播间成交金额(元)": item.dealAmount || "0.00",
    导入人: item.importerName || "",
    导入时间: item.importTime || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "用户管理");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
  XLSX.writeFile(book, `用户管理_${stamp}.xlsx`);
}
