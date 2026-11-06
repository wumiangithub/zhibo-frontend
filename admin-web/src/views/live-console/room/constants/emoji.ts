export interface EmojiItem {
  /** 表情文本令牌，会原样出现在聊天内容中，如 `[微笑]` */
  name: string
  /** 微吼表情编号 */
  value: string
  /** 表情图片地址 */
  src: string
}

export const EMOJI_LIST: EmojiItem[] = [
  { name: '[微笑]', value: '1', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_1@2x.png' },
  { name: '[撇嘴]', value: '2', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_2@2x.png' },
  { name: '[色]', value: '3', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_3@2x.png' },
  { name: '[发呆]', value: '4', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_4@2x.png' },
  { name: '[得意]', value: '5', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_5@2x.png' },
  { name: '[流泪]', value: '6', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_6@2x.png' },
  { name: '[害羞]', value: '7', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_7@2x.png' },
  { name: '[闭嘴]', value: '8', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_8@2x.png' },
  { name: '[睡]', value: '9', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_9@2x.png' },
  { name: '[哭]', value: '10', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_10@2x.png' },
  { name: '[尴尬]', value: '11', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_11@2x.png' },
  { name: '[发怒]', value: '12', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_12@2x.png' },
  { name: '[调皮]', value: '13', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_13@2x.png' },
  { name: '[呲牙]', value: '14', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_14@2x.png' },
  { name: '[惊讶]', value: '15', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_15@2x.png' },
  { name: '[难过]', value: '16', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_16@2x.png' },
  { name: '[酷]', value: '17', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_17@2x.png' },
  { name: '[汗]', value: '18', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_18@2x.png' },
  { name: '[抓狂]', value: '19', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_19@2x.png' },
  { name: '[吐]', value: '20', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_20@2x.png' },
  { name: '[偷笑]', value: '21', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_21@2x.png' },
  { name: '[愉快]', value: '22', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_22@2x.png' },
  { name: '[白眼]', value: '23', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_23@2x.png' },
  { name: '[傲慢]', value: '24', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_24@2x.png' },
  { name: '[饥饿]', value: '25', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_25@2x.png' },
  { name: '[困]', value: '26', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_26@2x.png' },
  { name: '[惊恐]', value: '27', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_27@2x.png' },
  { name: '[流汗]', value: '28', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_28@2x.png' },
  { name: '[憨笑]', value: '29', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_29@2x.png' },
  { name: '[悠闲]', value: '30', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_30@2x.png' },
  { name: '[奋斗]', value: '31', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_31@2x.png' },
  { name: '[咒骂]', value: '32', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_32@2x.png' },
  { name: '[疑问]', value: '33', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_33@2x.png' },
  { name: '[嘘]', value: '34', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_34@2x.png' },
  { name: '[晕]', value: '35', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_35@2x.png' },
  { name: '[疯了]', value: '36', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_36@2x.png' },
  { name: '[衰]', value: '37', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_37@2x.png' },
  { name: '[骷髅]', value: '38', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_38@2x.png' },
  { name: '[敲打]', value: '39', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_39@2x.png' },
  { name: '[再见]', value: '40', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_40@2x.png' },
  { name: '[擦汗]', value: '41', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_41@2x.png' },
  { name: '[抠鼻]', value: '42', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_42@2x.png' },
  { name: '[鼓掌]', value: '43', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_43@2x.png' },
  { name: '[糗大了]', value: '44', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_44@2x.png' },
  { name: '[坏笑]', value: '45', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_45@2x.png' },
  { name: '[左哼哼]', value: '46', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_46@2x.png' },
  { name: '[右哼哼]', value: '47', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_47@2x.png' },
  { name: '[哈欠]', value: '48', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_48@2x.png' },
  { name: '[鄙视]', value: '49', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_49@2x.png' },
  { name: '[委屈]', value: '50', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_50@2x.png' },
  { name: '[快哭了]', value: '51', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_51@2x.png' },
  { name: '[阴险]', value: '52', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_52@2x.png' },
  { name: '[亲亲]', value: '53', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_53@2x.png' },
  { name: '[吓]', value: '54', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_54@2x.png' },
  { name: '[可怜]', value: '55', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_55@2x.png' },
  { name: '[菜刀]', value: '56', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_56@2x.png' },
  { name: '[西瓜]', value: '57', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_57@2x.png' },
  { name: '[啤酒]', value: '58', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_58@2x.png' },
  { name: '[篮球]', value: '59', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_59@2x.png' },
  { name: '[乒乓]', value: '60', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_60@2x.png' },
  { name: '[咖啡]', value: '61', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_61@2x.png' },
  { name: '[饭]', value: '62', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_62@2x.png' },
  { name: '[猪头]', value: '63', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_63@2x.png' },
  { name: '[玫瑰]', value: '64', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_64@2x.png' },
  { name: '[凋谢]', value: '65', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_65@2x.png' },
  { name: '[嘴唇]', value: '66', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_66@2x.png' },
  { name: '[爱心]', value: '67', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_67@2x.png' },
  { name: '[心碎]', value: '68', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_68@2x.png' },
  { name: '[蛋糕]', value: '69', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_69@2x.png' },
  { name: '[闪电]', value: '70', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_70@2x.png' },
  { name: '[炸弹]', value: '71', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_71@2x.png' },
  { name: '[刀]', value: '72', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_72@2x.png' },
  { name: '[足球]', value: '73', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_73@2x.png' },
  { name: '[瓢虫]', value: '74', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_74@2x.png' },
  { name: '[便便]', value: '75', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_75@2x.png' },
  { name: '[月亮]', value: '76', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_76@2x.png' },
  { name: '[太阳]', value: '77', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_77@2x.png' },
  { name: '[礼物]', value: '78', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_78@2x.png' },
  { name: '[拥抱]', value: '79', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_79@2x.png' },
  { name: '[强]', value: '80', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_80@2x.png' },
  { name: '[弱]', value: '81', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_81@2x.png' },
  { name: '[握手]', value: '82', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_82@2x.png' },
  { name: '[胜利]', value: '83', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_83@2x.png' },
  { name: '[抱拳]', value: '84', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_84@2x.png' },
  { name: '[勾引]', value: '85', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_85@2x.png' },
  { name: '[拳头]', value: '86', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_86@2x.png' },
  { name: '[差劲]', value: '87', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_87@2x.png' },
  { name: '[爱你]', value: '88', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_88@2x.png' },
  { name: '[NO]', value: '89', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_89@2x.png' },
  { name: '[OK]', value: '90', src: 'https://cnstatic01.e.vhall.com/static/img/arclist/Expression_90@2x.png' },
]

/** 按 `[名称]` 令牌索引，渲染聊天内容时把文本令牌换成图片用 */
export const EMOJI_MAP_BY_NAME: Record<string, EmojiItem> = Object.fromEntries(
  EMOJI_LIST.map((item) => [item.name, item]),
)

export type EmojiSegment =
  | { kind: 'text'; value: string }
  | { kind: 'emoji'; name: string; src: string }

/** 微吼线上格式：<img ... src="//cnstatic01.e.vhall.com/.../Expression_N@2x.png"/> */
const SRC_RE = /src\s*=\s*["']([^"']+)["']/i
const ARCLIST_RE = /\/\/cnstatic01\.e\.vhall\.com\/static\/img\/arclist\/Expression_\d+@2x\.png$/i

/** src 文件名 → 表情，兼容协议相对与 https 两种写法 */
const EMOJI_MAP_BY_SRC: Record<string, EmojiItem> = {};
for (const item of EMOJI_LIST) {
  const file = item.src.replace(/^https?:/, '');
  EMOJI_MAP_BY_SRC[file] = item;
}

function matchSegment(token: string): EmojiItem | null {
  if (token.startsWith('[')) return EMOJI_MAP_BY_NAME[token] || null;
  const src = SRC_RE.exec(token)?.[1] || '';
  const normalized = src.replace(/^https?:/, '');
  if (!ARCLIST_RE.test(normalized)) return null;
  return EMOJI_MAP_BY_SRC[normalized] || null;
}

const SPLIT_RE = /\[[^\[\]]+\]|<img\b[^>]*>/g

/**
 * 把聊天文本切成 纯文本/表情 段。
 * 同时识别 [名称] 令牌与微吼线上的 <img> HTML；img 的 src 未命中表情图白名单时
 * 留在文本段原样显示（转义由模板插值保证），不做任何裸 HTML 渲染。
 */
export function splitEmojiText(text: string): EmojiSegment[] {
  const segments: EmojiSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(SPLIT_RE)) {
    const index = match.index ?? 0;
    const item = matchSegment(match[0]);
    if (!item) continue;
    if (index > last) segments.push({ kind: 'text', value: text.slice(last, index) });
    segments.push({ kind: 'emoji', name: item.name, src: item.src });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

/** 归一成 [名称] 令牌串：乐观上屏的令牌文本与服务端回声的 img HTML 才能比较去重 */
export function normalizeEmojiText(text: string): string {
  return splitEmojiText(text)
    .map((seg) => (seg.kind === 'emoji' ? seg.name : seg.value))
    .join('');
}
