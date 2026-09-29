import { AliyunWatchAdapter } from "./adapters/AliyunWatchAdapter";
import { TencentWatchAdapter } from "./adapters/TencentWatchAdapter";
import { VhallWatchAdapter } from "./adapters/VhallWatchAdapter";
import type { LiveProvider } from "./types";
import type { WatchAdapter } from "./WatchAdapter";

/** 按 provider 创建观看适配器；未知值抛错 */
export function createWatchAdapter(provider: LiveProvider | string): WatchAdapter {
  switch (provider) {
    case "vhall":
      return new VhallWatchAdapter();
    case "aliyun":
      return new AliyunWatchAdapter();
    case "tencent":
      return new TencentWatchAdapter();
    default:
      throw new Error(`未知直播服务商: ${provider}`);
  }
}
