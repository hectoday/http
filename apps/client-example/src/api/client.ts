import { route, configureRoute, routePattern } from "typesafe-route";

configureRoute({ base: window.location.origin, trailingSlash: "strip" });

// ---------------------------------------------------------------------------
// Route patterns
// ---------------------------------------------------------------------------

export const routes = {
  login: routePattern("/api/auth/login"),
  signup: routePattern("/api/auth/signup"),
  me: routePattern("/api/auth/me"),
  health: routePattern("/api/health"),
  bookmarks: routePattern("/api/bookmarks"),
  bookmark: routePattern("/api/bookmarks/:id"),
  tags: routePattern("/api/tags"),
  adminStats: routePattern("/api/admin/stats"),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

interface AuthResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

interface BookmarksResponse {
  bookmarks: Bookmark[];
  total: number;
  page: number;
  limit: number;
}

interface TagsResponse {
  tags: Record<string, number>;
}

interface StatsResponse {
  stats: {
    uptime: number;
    memory: number;
  };
}

interface ApiError {
  error: string | unknown[];
  hint?: string;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

type Result<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

async function request<T>(
  url: string,
  options?: { method?: string; body?: unknown; token?: string },
): Promise<Result<T>> {
  const headers: Record<string, string> = {};
  if (options?.token) headers["authorization"] = `Bearer ${options.token}`;
  if (options?.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return { ok: true, data: null as T, status: 204 };

  const data = await res.json();
  if (!res.ok) return { ok: false, error: data as ApiError, status: res.status };
  return { ok: true, data: data as T, status: res.status };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>(route("/api/auth/login"), { method: "POST", body: { email, password } }),

  signup: (name: string, email: string, password: string) =>
    request<AuthResponse>(route("/api/auth/signup"), {
      method: "POST",
      body: { name, email, password },
    }),

  me: (token: string) => request<MeResponse>(route("/api/auth/me"), { token }),

  health: () => request<{ status: string }>(route("/api/health")),

  listBookmarks: (page = 1, limit = 20, tag?: string) => {
    const search: Record<string, string> = { page: String(page), limit: String(limit) };
    if (tag) search["tag"] = tag;
    return request<BookmarksResponse>(route("/api/bookmarks", { search }));
  },

  getBookmark: (id: string) => request<Bookmark>(route("/api/bookmarks/:id", { path: { id } })),

  createBookmark: (url: string, title: string, tags: string[], token: string) =>
    request<Bookmark>(route("/api/bookmarks"), {
      method: "POST",
      body: { url, title, tags },
      token,
    }),

  deleteBookmark: (id: string, token: string) =>
    request<null>(route("/api/bookmarks/:id", { path: { id } }), { method: "DELETE", token }),

  getTags: () => request<TagsResponse>(route("/api/tags")),

  getStats: (token: string) => request<StatsResponse>(route("/api/admin/stats"), { token }),
};
