import * as XLSX from "xlsx";
import {
  formatLearnDurationSec,
  registerChannelLabel,
  type ViewerListItem,
} from "@/api/viewer";

/** 导出勾选行；列与用户列表一致（不含复选框与操作） */
export function exportViewerRows(rows: ViewerListItem[]) {
  const data = rows.map((item) => ({
    用户: item.nickname,
    用户ID: item.id,
    来源渠道: registerChannelLabel(item.registerChannel),
    绑定手机号: item.phoneMasked ?? "",
    注册时间: item.createdTime ?? "",
    累计消费次数: item.consumeCount ?? 0,
    累计消费金额: item.consumeAmount ?? "0.00",
    最近消费时间: "",
    最近访问时间: item.lastVisitTime ?? "",
    累计学习时长: formatLearnDurationSec(item.totalLearnDurationSec ?? 0),
    今日学习时长: formatLearnDurationSec(item.todayLearnDurationSec ?? 0),
    完成课程数: item.completedCourseCount ?? 0,
    最近购买商品: item.recentPurchaseProduct ?? "",
    首次支付时间: item.firstPayTime ?? "",
    标签: (item.tagLabels ?? []).join("、"),
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "用户列表");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  XLSX.writeFile(book, `用户列表_${stamp}.xlsx`);
}
