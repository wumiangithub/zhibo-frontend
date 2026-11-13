import { get } from "./http";

/** 工作台概况「经营数据」，读本站管理端接口，不走订单中心。 */
export interface BusinessMetrics {
  todayVisitorCount: number;
  todayNewUserCount: number;
  /** 元，十进制字符串，如 "26800.00" */
  todayPayAmount: string;
  todayOrderCount: number;
  totalPayUserCount: number;
  totalUserCount: number;
  /** 元，十进制字符串，如 "111126800.00" */
  totalPayAmount: string;
  /** 服务端统计时刻，Asia/Shanghai，yyyy-MM-dd HH:mm:ss */
  statsTime: string;
}

export function getBusinessMetrics() {
  return get<BusinessMetrics>("/dashboard/business-metrics");
}
