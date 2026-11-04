/** 未配置时的本地 live-web。各环境用 VITE_LIVE_WEB_ORIGIN 写完整根地址（含协议和端口）。 */
const DEFAULT_LIVE_WEB_ORIGIN = "http://localhost:5174";

/** 观众端 H5 根地址，无尾斜杠。观看链接、课程链接、中控台都从这里拼。 */
export function liveWebOrigin(): string {
  const raw = import.meta.env.VITE_LIVE_WEB_ORIGIN?.trim() || DEFAULT_LIVE_WEB_ORIGIN;
  return raw.replace(/\/$/, "");
}
