import * as XLSX from "xlsx";
import {
  orderStatusLabel,
  type SalerOrderItem,
} from "@/api/orderCenter";

function displayUser(item: SalerOrderItem) {
  return item.nickname || item.customerName || item.customerAccount || "--";
}

function displayMoney(item: SalerOrderItem) {
  const m = item.orderMoney?.trim();
  if (!m) return "--";
  return `¥ ${m}`;
}

/** 导出勾选行；列与列表表格一致（不含复选框与操作） */
export function exportOrderRows(rows: SalerOrderItem[]) {
  const data = rows.map((item) => ({
    用户: displayUser(item),
    用户ID: item.userId || "--",
    订单号: item.orderNo || "--",
    商品名称: item.productName || "--",
    有效期: item.validityLabel || "--",
    下单时间: item.createTime || "--",
    支付时间: item.payTime || "--",
    支付金额: displayMoney(item),
    支付方式: item.payWayText || "--",
    订单状态: orderStatusLabel(item.orderStatus),
    服务状态: item.serviceStatusText || item.serviceStatus || "--",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "全部订单");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
  XLSX.writeFile(book, `全部订单_${stamp}.xlsx`);
}
