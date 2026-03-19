import { queryOptions } from "@tanstack/react-query";
import { api, routes } from "./client.ts";

export function meOptions(token: string) {
  return queryOptions({
    queryKey: [routes.me.pattern, token],
    queryFn: async () => {
      const res = await api.me(token);
      if (!res.ok) throw new Error("Session expired");
      return res.data.user;
    },
    retry: false,
  });
}

export function bookmarksOptions(page: number, limit: number, tag?: string) {
  return queryOptions({
    queryKey: [routes.bookmarks.pattern, page, tag],
    queryFn: async () => {
      const res = await api.listBookmarks(page, limit, tag);
      if (!res.ok)
        throw new Error(
          typeof res.error.error === "string" ? res.error.error : "Failed to load bookmarks",
        );
      return res.data;
    },
  });
}

export function tagsOptions() {
  return queryOptions({
    queryKey: [routes.tags.pattern],
    queryFn: async () => {
      const res = await api.getTags();
      if (!res.ok) throw new Error("Failed to load tags");
      return res.data.tags;
    },
  });
}

export function adminStatsOptions(token: string) {
  return queryOptions({
    queryKey: [routes.adminStats.pattern],
    queryFn: async () => {
      const res = await api.getStats(token);
      if (!res.ok)
        throw new Error(
          typeof res.error.error === "string" ? res.error.error : "Failed to load stats",
        );
      return res.data.stats;
    },
  });
}
