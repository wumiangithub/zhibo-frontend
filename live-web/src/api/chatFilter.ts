import { get } from "./http";

export interface ChatFilterData {
  pageUrl: string;
}

/** live-service：`GET /api/v1/watch/chat-filter/{id}`（T15.13 / D34；D62） */
export function fetchChatFilterPageUrl(
  id: string,
  query?: { email?: string; name?: string },
) {
  const params: Record<string, string> = {};
  const email = query?.email?.trim();
  const name = query?.name?.trim();
  if (email) params.email = email;
  if (name) params.name = name;
  return get<ChatFilterData>(`/watch/chat-filter/${id}`, {
    params: Object.keys(params).length ? params : undefined,
  });
}
