/**
 * 管理端左侧栏图标（一级菜单）。
 * 同源功能复用同一 name（如直播数据=chart、直播中控台=monitor）。
 */
import overview from "./overview.svg?raw";
import monitor from "./monitor.svg?raw";
import chart from "./chart.svg?raw";
import stack from "./stack.svg?raw";
import target from "./target.svg?raw";
import phone from "./phone.svg?raw";
import people from "./people.svg?raw";
import clipboard from "./clipboard.svg?raw";
import globe from "./globe.svg?raw";
import user from "./user.svg?raw";
import trend from "./trend.svg?raw";
import order from "./order.svg?raw";
import grid from "./grid.svg?raw";
import plus from "./plus.svg?raw";
import docPlus from "./doc-plus.svg?raw";
import video from "./video.svg?raw";
import download from "./download.svg?raw";
import settings from "./settings.svg?raw";
import tag from "./tag.svg?raw";

export const sideNavIcons: Record<string, string> = {
  overview,
  monitor,
  chart,
  stack,
  target,
  phone,
  people,
  clipboard,
  globe,
  user,
  trend,
  order,
  grid,
  plus,
  "doc-plus": docPlus,
  video,
  download,
  settings,
  tag,
};

export type SideNavIconName = keyof typeof sideNavIcons;
