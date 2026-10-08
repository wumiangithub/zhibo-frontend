import { get } from "./http";

export interface ChatFilterData {
  pageUrl: string;
}

/** live-service：`GET /api/watch/{id}/chat-filter`（T15.13 / D34） */
export function fetchChatFilterPageUrl(
  id: string,
  query?: { email?: string; name?: string },
) {
  const params: Record<string, string> = {};
  const email = query?.email?.trim();
  const name = query?.name?.trim();
  if (email) params.email = email;
  if (name) params.name = name;
  return get<ChatFilterData>(`/watch/${id}/chat-filter`, {
    params: Object.keys(params).length ? params : undefined,
  });
}
