/**
 * 按需注入 ECharts UMD（public/echarts.min.js，钉死 5.5.1）。
 * 对齐 TOS：script 注入；已有 window.echarts / 同 src / 在途 Promise 不重复插入。
 */
declare global {
  interface Window {
    echarts?: EChartsGlobal;
  }
}

export interface EChartsGlobal {
  init: (el: HTMLElement, theme?: string | object | null, opts?: object) => EChartsInstance;
}

export interface EChartsInstance {
  setOption: (option: object, opts?: object | boolean) => void;
  resize: () => void;
  dispose: () => void;
  clear: () => void;
}

const ECHARTS_SRC = "/echarts.min.js";

let loading: Promise<EChartsGlobal> | null = null;

export function loadEcharts(): Promise<EChartsGlobal> {
  if (typeof window !== "undefined" && window.echarts) {
    return Promise.resolve(window.echarts);
  }
  if (loading) {
    return loading;
  }
  loading = new Promise<EChartsGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ECHARTS_SRC}"]`,
    );
    const finish = () => {
      if (window.echarts) {
        resolve(window.echarts);
        return;
      }
      loading = null;
      reject(new Error("ECharts 加载后未挂到 window.echarts"));
    };
    const fail = () => {
      loading = null;
      reject(new Error("Failed to load ECharts"));
    };
    if (existing) {
      if (existing.dataset.loaded === "1" || window.echarts) {
        finish();
        return;
      }
      if (existing.dataset.loading === "1") {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", fail, { once: true });
        return;
      }
      // 无标记：多为历史节点，直接认完成或再等
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      if (window.echarts) {
        finish();
      }
      return;
    }
    const script = document.createElement("script");
    script.src = ECHARTS_SRC;
    script.dataset.loading = "1";
    script.onload = () => {
      delete script.dataset.loading;
      script.dataset.loaded = "1";
      finish();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
