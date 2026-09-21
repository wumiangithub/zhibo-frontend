import { reactive } from "vue";
import { splitEmojiText, normalizeEmojiText } from "@/constants/emoji";

/**
 * 自建弹幕：SDK 自带渲染器在本布局不绘制，且设置触发器 .v-c-right 被压成 0 宽（图标/面板都不可达），
 * 所以弹幕的显示与设置全部由前端自己实现，值域对齐微吼参考面板。
 * 传输通道仍是聊天（微吼文档：openBarrage 后用发送聊天接口发弹幕），浮层只负责本地样式。
 */
export interface DanmakuItem {
  id: number;
  text: string;
  color: string;
  fontSize: number;
  top: number; // px，相对浮层顶部
  travel: number; // px，横向位移（负值，从右侧穿到左侧）
  duration: number; // ms
}

const AREA_RANGES: [number, number][] = [
  [0, 1],
  [0, 0.25],
  [0, 0.5],
  [0.5, 1],
];
export const AREA_OPTIONS = ["全屏", "1/4屏", "上半屏", "下半屏"];
export const FONT_OPTIONS = [
  { label: "大", value: 20 },
  { label: "中", value: 16 },
  { label: "小", value: 12 },
];
export const SPEED_OPTIONS = [
  { label: "慢", value: 20000 },
  { label: "标准", value: 10000 },
  { label: "快", value: 5000 },
];
export const BARRAGE_COLORS = ["#ffffff", "#fb2626", "#ffb201", "#16c973", "#3552ea", "#dc12d2"];
const MAX_LEN = 60;
/** 同一条文本可能被乐观上屏 + 多次回声重复送达，窗口内只滚一次 */
const DEDUP_WINDOW = 5000;

export function useBarrage(getSdk: () => VhallSdkInstance | null) {
  const barrage = reactive({
    danmakuList: [] as DanmakuItem[],
    danmakuInput: "",
    barrageOn: true,
    barrageSettings: {
      area: 0, // 0 全屏 / 1 1/4屏 / 2 上半屏 / 3 下半屏
      opacity: 100, // 0-100
      fontSize: 16, // 大 20 / 中 16 / 小 12
      color: "#ffffff",
      speed: 10000, // 慢 20000 / 标准 10000 / 快 5000 (ms)
    },
  });

  let layerEl: HTMLElement | null = null;
  let seq = 0;
  const trackFreeAt: number[] = [];
  const recentDanmaku: { text: string; t: number }[] = [];

  function attachLayerEl(el: unknown) {
    layerEl = (el as HTMLElement | null) || null;
  }

  /** 生成一条弹幕：按显示区域选轨道，估算文本宽度算出完整穿屏位移，动画结束后自动移除 */
  function spawnDanmaku(text: string) {
    const now = Date.now();
    // 去重：乐观上屏与重复回声会在几秒内送同一条文本多次（令牌/img HTML 两种形态）
    const key = normalizeEmojiText(text);
    while (recentDanmaku.length && now - recentDanmaku[0].t > DEDUP_WINDOW) recentDanmaku.shift();
    if (recentDanmaku.some((r) => r.text === key)) return;
    recentDanmaku.push({ text: key, t: now });

    if (!layerEl || !barrage.barrageOn) return;
    const layerW = layerEl.clientWidth;
    const layerH = layerEl.clientHeight;
    if (!layerW || !layerH) return;

    const fontSize = barrage.barrageSettings.fontSize;
    const [topFrac, bottomFrac] = AREA_RANGES[barrage.barrageSettings.area] || AREA_RANGES[0];
    const areaTop = layerH * topFrac;
    const areaHeight = layerH * (bottomFrac - topFrac);
    const trackH = fontSize + 10;
    const trackCount = Math.max(1, Math.floor(areaHeight / trackH));

    const textW =
      Math.ceil(
        splitEmojiText(text).reduce(
          (w, seg) => w + (seg.kind === "emoji" ? fontSize : seg.value.length * fontSize * 0.6),
          0,
        ),
      ) + 20;
    const duration = barrage.barrageSettings.speed;
    const distance = layerW + textW;

    // 选轨：优先已空闲的，否则挑最空的，避免弹幕重叠
    let track = -1;
    for (let i = 0; i < trackCount; i++) {
      if (!trackFreeAt[i] || trackFreeAt[i] <= now) {
        track = i;
        break;
      }
    }
    if (track === -1) {
      track = 0;
      let min = trackFreeAt[0] || 0;
      for (let i = 1; i < trackCount; i++) {
        if ((trackFreeAt[i] || 0) < min) {
          min = trackFreeAt[i] || 0;
          track = i;
        }
      }
    }
    // 该轨道下一条要等这条的尾部进入屏幕后再发，粗略按文本占比 + 间隔估算
    trackFreeAt[track] = now + duration * Math.min(0.6, textW / distance + 0.18);

    const item: DanmakuItem = {
      id: ++seq,
      text,
      color: barrage.barrageSettings.color,
      fontSize,
      top: areaTop + track * trackH,
      travel: -distance,
      duration,
    };
    barrage.danmakuList.push(item);
    window.setTimeout(() => {
      const idx = barrage.danmakuList.findIndex((d) => d.id === item.id);
      if (idx !== -1) barrage.danmakuList.splice(idx, 1);
    }, duration + 400);
  }

  function sendDanmaku() {
    const text = barrage.danmakuInput.trim();
    const sdk = getSdk();
    if (!text || text.length > MAX_LEN || !sdk) return;
    barrage.danmakuInput = "";
    spawnDanmaku(text);
    try {
      sdk.chat.sendChat(text);
    } catch (e) {
      console.error("发送弹幕失败", e);
    }
  }

  function toggleBarrage() {
    barrage.barrageOn = !barrage.barrageOn;
    if (!barrage.barrageOn) barrage.danmakuList = [];
  }

  return Object.assign(barrage, { attachLayerEl, spawnDanmaku, sendDanmaku, toggleBarrage });
}

export type BarrageController = ReturnType<typeof useBarrage>;
