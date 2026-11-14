import { del, get, post, put } from "./http";

export interface QuickSendGroup {
  id: string;
  name: string;
  count: number;
  isDefault: boolean;
}

export interface QuickSendMessage {
  id: string;
  groupId: string;
  content: string;
  sortOrder: number;
  createdTime: string;
  updatedTime: string;
}

export interface QuickSendMessageListData {
  total: number;
  page: number;
  pageSize: number;
  list: QuickSendMessage[];
}

export type QuickSendPlace = "above" | "below";

export function listQuickSendGroups() {
  return get<QuickSendGroup[]>("/quick-send/groups/list");
}

export function createQuickSendGroup(name: string) {
  return post<QuickSendGroup>("/quick-send/groups/create", { name });
}

export function renameQuickSendGroup(id: string, name: string) {
  return put<QuickSendGroup>(`/quick-send/groups/rename/${id}`, { name });
}

export function deleteQuickSendGroup(id: string) {
  return del<{ id: string }>(`/quick-send/groups/delete/${id}`);
}

export function listQuickSendMessages(params: {
  groupId: string;
  page?: number;
  pageSize?: number;
}) {
  return get<QuickSendMessageListData>("/quick-send/messages/list", { params });
}

export function createQuickSendMessage(body: {
  groupId: string;
  content: string;
  anchorId?: string;
  place?: QuickSendPlace;
}) {
  return post<QuickSendMessage>("/quick-send/messages/create", body);
}

export function updateQuickSendMessage(id: string, content: string) {
  return put<QuickSendMessage>(`/quick-send/messages/update/${id}`, { content });
}

export function copyQuickSendMessage(id: string) {
  return post<QuickSendMessage>(`/quick-send/messages/copy/${id}`);
}

export function reorderQuickSendMessages(groupId: string, ids: string[]) {
  return post<void>("/quick-send/messages/reorder", { groupId, ids });
}

export function deleteQuickSendMessage(id: string) {
  return del<{ id: string }>(`/quick-send/messages/delete/${id}`);
}

export function batchDeleteQuickSendMessages(ids: string[]) {
  return post<{ deleted: number }>("/quick-send/messages/batch-delete", { ids });
}

/** 拉取某分组全部未软删消息 id（按当前排序），供拖拽重排。 */
export async function listAllQuickSendMessageIds(groupId: string): Promise<string[]> {
  const pageSize = 100;
  let page = 1;
  const ids: string[] = [];
  let total = Infinity;
  while (ids.length < total) {
    const data = await listQuickSendMessages({ groupId, page, pageSize });
    total = data.total ?? 0;
    for (const row of data.list ?? []) {
      ids.push(row.id);
    }
    if (!data.list?.length || data.list.length < pageSize) break;
    page += 1;
    if (page > 50) break;
  }
  return ids;
}
