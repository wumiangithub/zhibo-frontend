/** 资讯首页 / 详情假数据，与小程序 utils/mockNews.js 对齐。接口就绪后替换。 */

export interface NewsCard {
  id: string;
  title: string;
  source: string;
  time: string;
  body: string;
}

export interface LiveFlash {
  id: string;
  time: string;
  content: string;
}

const BODY =
  "理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。理想汽车间接全资子公司麦格信科技获增资16.25亿元，投后估值约166.3亿元。";

function withBody(item: Omit<NewsCard, "body">): NewsCard {
  return { ...item, body: BODY };
}

const hot: NewsCard[] = [
  {
    id: "h1",
    title: "2500万元自购！百亿私募凯丰出手，年内私募自购近16亿元",
    source: "21世纪经济报道",
    time: "2026-10-16 16:35:01",
  },
  {
    id: "h2",
    title: "理想汽车：9月交付55432辆，同比增长超50%，第三季度交付创新高",
    source: "财联社",
    time: "2026-10-16 15:20:00",
  },
  {
    id: "h3",
    title: "华为盘古大模型再升级：面向金融、制造等行业发布新版本解决方案",
    source: "证券时报网",
    time: "2026-10-16 14:05:00",
  },
  {
    id: "h4",
    title: "多家银行下调存款利率，三年期定存利率进入“1字头”",
    source: "经济观察网",
    time: "2026-10-16 11:30:00",
  },
].map(withBody);

const market: NewsCard[] = [
  {
    id: "m1",
    title: "【每日收评】沪指跌0.42%，两市成交额不足万亿，沪深京三市下跌个股超3600只",
    source: "财经要闻",
    time: "2026-10-16 15:12:00",
  },
  {
    id: "m2",
    title: "海尔智家(06690)宣布回购计划，拟动用不超过10亿元回购股份",
    source: "财经要闻",
    time: "2026-10-16 14:48:00",
  },
  {
    id: "m3",
    title: "北向资金今日净卖出约35亿元，电子与白酒板块遭减持",
    source: "证券时报网",
    time: "2026-10-16 15:05:00",
  },
  {
    id: "m4",
    title: "创业板指跌超1%，AI应用方向分化，部分算力股盘中回暖",
    source: "财联社",
    time: "2026-10-16 14:22:00",
  },
].map(withBody);

const industry: NewsCard[] = [
  {
    id: "i1",
    title: "工信部：加快推进人形机器人创新发展，开展个人隐私保护标识试点",
    source: "证券时报网",
    time: "2026-10-16 16:10:00",
  },
  {
    id: "i2",
    title: "中以可靠完成新一轮融资，加码工业网络安全与关键基础设施保护",
    source: "财联社",
    time: "2026-10-16 13:55:00",
  },
  {
    id: "i3",
    title: "汽车智能化：多家车企公布高阶智驾落地节奏，城区 NOA 加速开城",
    source: "经济观察网",
    time: "2026-10-16 12:40:00",
  },
  {
    id: "i4",
    title: "光伏辅材龙头扩产：胶膜、银浆环节订单回暖，行业排产环比改善",
    source: "证券时报网",
    time: "2026-10-16 10:18:00",
  },
].map(withBody);

export const NEWS_TABS = [
  { key: "live", label: "7X24" },
  { key: "hot", label: "热点" },
  { key: "market", label: "大盘" },
  { key: "industry", label: "行业" },
] as const;

export type NewsTabKey = (typeof NEWS_TABS)[number]["key"];

export const MOCK_NEWS = {
  liveDate: "2026年10月16日",
  live: [
    {
      id: "l1",
      time: "13:46",
      content:
        "【上交所副总经理刘逖：坚定不移推进资本市场对外开放】财联社10月16日电，上交所副总经理刘逖今日表示，将坚定不移推进资本市场对外开放，持续优化沪港通等机制安排，吸引更多中长期资金入市。",
    },
    {
      id: "l2",
      time: "13:45",
      content:
        "【腾讯控股回购】腾讯控股发布公告，于场内回购约100万股，耗资约4.2亿港元，每股价格介乎约410至430港元。",
    },
    {
      id: "l3",
      time: "13:40",
      content:
        "【央行公开市场】央行今日开展1265亿元7天期逆回购操作，中标利率1.50%，与此前持平。当日有1200亿元逆回购到期。",
    },
    {
      id: "l4",
      time: "13:32",
      content:
        "【商务部】商务部新闻发言人表示，将继续扩大高水平对外开放，推动外贸稳规模优结构，支持跨境电商等新业态发展。",
    },
  ] as LiveFlash[],
  hot,
  market,
  industry,
};

const DETAIL_INDEX: Record<string, NewsCard> = {};
for (const item of [...hot, ...market, ...industry]) {
  DETAIL_INDEX[item.id] = item;
}

export function getNewsDetail(id: string): NewsCard | null {
  if (!id) return null;
  return DETAIL_INDEX[id] ?? null;
}

export function cardsForTab(key: NewsTabKey): NewsCard[] {
  if (key === "live") return [];
  return MOCK_NEWS[key];
}
