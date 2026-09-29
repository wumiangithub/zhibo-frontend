import type { WatchSdkData } from "@/api/watch";
import type { WatchAdapter, WatchAdapterHandlers } from "../WatchAdapter";

const NOT_READY = "该直播服务商尚未接入";

export class TencentWatchAdapter implements WatchAdapter {
  getSdk(): VhallSdkInstance | null {
    return null;
  }

  async init(_data: WatchSdkData, _handlers: WatchAdapterHandlers): Promise<void> {
    throw new Error(NOT_READY);
  }

  destroy(): void {
    /* no-op */
  }
}
