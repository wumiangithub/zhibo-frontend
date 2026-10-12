import { defineStore } from "pinia";
import { fetchTosSts, type TosStsConfig } from "@/api/materials";

/** 剩余有效期不足此时长则视为不可用，避免批量上传中途 STS 过期 */
const TOS_MIN_REMAINING_MS = 10 * 60 * 1000;

function isTosConfigValid(config: Partial<TosStsConfig> | null | undefined): config is TosStsConfig {
  if (!config?.accessKeyId || !config?.secretAccessKey || !config?.sessionToken) {
    return false;
  }
  if (!config.expiredTime) return false;
  const expiredAt = Date.parse(config.expiredTime);
  if (Number.isNaN(expiredAt)) return false;
  return expiredAt - Date.now() > TOS_MIN_REMAINING_MS;
}

export const useMaterialsStore = defineStore("materials", {
  state: () => ({
    tosConfig: {} as Partial<TosStsConfig>,
  }),
  actions: {
    setTosConfig(config: Partial<TosStsConfig> | null | undefined) {
      this.tosConfig = config ?? {};
    },

    /**
     * 上传前调用：凭证缺失或剩余有效期不足则重新拉取，否则复用缓存。
     */
    async ensureTosConfig(): Promise<TosStsConfig> {
      if (isTosConfigValid(this.tosConfig)) {
        return this.tosConfig;
      }
      const config = await fetchTosSts();
      this.setTosConfig(config);
      return config;
    },
  },
});
