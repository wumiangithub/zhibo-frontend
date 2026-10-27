import { del, get, post, put } from "./http";

/** 1 手动 / 2 自动 */
export const ViewerTagType = {
  MANUAL: 1,
  AUTO: 2,
} as const;

export type ViewerTagTypeValue = (typeof ViewerTagType)[keyof typeof ViewerTagType];

export interface ViewerTagGroupItem {
  id: number;
  name: string;
  isDefault: boolean;
}

export interface ViewerTagGroupPageItem {
  id: number;
  name: string;
  isDefault: boolean;
  tagCount: number;
}

export interface ViewerTagGroupPageResult {
  page: number;
  pageSize: number;
  total: number;
  list: ViewerTagGroupPageItem[];
}

export interface ViewerTagItem {
  id: number;
  name: string;
  type: ViewerTagTypeValue | number;
  definitionSummary?: string;
  userCount: number;
  groupId: number;
  groupName: string;
  createdTime?: string;
}

export interface ViewerTagListResult {
  page: number;
  pageSize: number;
  total: number;
  list: ViewerTagItem[];
}

export function listViewerTagGroups() {
  return get<ViewerTagGroupItem[]>("/viewer-tags/groups/list");
}

export function pageViewerTagGroups(params: {
  page?: number;
  pageSize?: number;
  name?: string;
} = {}) {
  return get<ViewerTagGroupPageResult>("/viewer-tags/groups/page", { params });
}

export function createViewerTagGroup(body: { name: string }) {
  return post<ViewerTagGroupPageItem>("/viewer-tags/groups/create", body);
}

export function updateViewerTagGroup(id: number, body: { name: string }) {
  return put<ViewerTagGroupPageItem>(`/viewer-tags/groups/update/${id}`, body);
}

export function deleteViewerTagGroup(id: number) {
  return del<{ id: number }>(`/viewer-tags/groups/delete/${id}`);
}

export function listViewerTags(params: {
  page?: number;
  pageSize?: number;
  type?: number;
  name?: string;
  groupId?: number;
} = {}) {
  return get<ViewerTagListResult>("/viewer-tags/list", { params });
}

export function getViewerTag(id: number) {
  return get<ViewerTagItem>(`/viewer-tags/detail/${id}`);
}

export function createViewerTag(body: { name: string; type: number; groupId?: number }) {
  return post<ViewerTagItem>("/viewer-tags/create", body);
}

export function updateViewerTag(id: number, body: { name: string; groupId?: number }) {
  return put<ViewerTagItem>(`/viewer-tags/update/${id}`, body);
}

export function deleteViewerTag(id: number) {
  return del<{ id: number }>(`/viewer-tags/delete/${id}`);
}

export function viewerTagTypeLabel(type: number): string {
  if (type === ViewerTagType.AUTO) return "自动标签";
  return "手动标签";
}
