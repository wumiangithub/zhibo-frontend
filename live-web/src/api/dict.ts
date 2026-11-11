import { get } from "./http";

export interface DictDataItem {
  label: string;
  value: number;
}

export interface DictData {
  dictDm: string;
  dictName: string;
  list: DictDataItem[];
}

/** label → value；同 label 后者覆盖。 */
export function dictLabelValueMap(data: DictData | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of data?.list ?? []) {
    const label = String(row.label ?? "").trim();
    const value = Number(row.value);
    if (!label || !Number.isInteger(value)) continue;
    out[label] = value;
  }
  return out;
}

/**
 * GET /api/v1/dicts/data/{dictDm}
 * 公开；支付页拉 pay_channel / pay_way。
 */
export function getDictData(dictDm: string): Promise<DictData> {
  const dm = dictDm.trim();
  if (!dm) return Promise.reject(new Error("字典代码无效"));
  return get<DictData>(`/dicts/data/${encodeURIComponent(dm)}`);
}
