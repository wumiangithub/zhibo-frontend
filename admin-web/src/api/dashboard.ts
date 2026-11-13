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

/** 工作台「最近直播数据」一行（数字由页面格式化）。 */
export interface RecentLiveRow {
  id: string;
  title: string;
  coverUrl: string;
  /** 实际首开 yyyy-MM-dd HH:mm:ss */
  startTime: string;
  /** 实际末结；直播中未闭合可为 "" */
  endTime: string;
  /** 1 直播 / 2 预告 / 3 结束 / 4 点播 / 5 回放 */
  state: number;
  roomViewCount: number;
  roomVisitorCount: number;
  watchViewCount: number;
  watchViewerCount: number;
  avgWatchDurationSec: number;
  maxOnlinePeak: number;
  newUserCount: number;
}

export interface RecentLivesData {
  page: number;
  pageSize: number;
  total: number;
  list: RecentLiveRow[];
}

export const RECENT_LIVES_PAGE_SIZE = 10;

export function getRecentLives(page = 1, pageSize = RECENT_LIVES_PAGE_SIZE) {
  return get<RecentLivesData>("/dashboard/recent-lives", {
    params: { page, pageSize },
  });
}
