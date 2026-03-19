import type { Bookmark } from "../api/client.ts";

export const bookmarks: Bookmark[] = [
  {
    id: "bm-1",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Request",
    title: "Request - Web APIs | MDN",
    tags: ["web", "standards"],
    createdBy: "user-1",
    createdAt: "2026-03-17T00:00:00Z",
  },
  {
    id: "bm-2",
    url: "https://zod.dev",
    title: "Zod - TypeScript-first schema validation",
    tags: ["typescript", "validation"],
    createdBy: "user-1",
    createdAt: "2026-03-17T00:01:00Z",
  },
  {
    id: "bm-3",
    url: "https://vite.dev",
    title: "Vite - Next Generation Frontend Tooling",
    tags: ["tooling"],
    createdBy: "user-2",
    createdAt: "2026-03-17T00:02:00Z",
  },
];

let nextBookmarkId = 4;
export function getNextBookmarkId() {
  return `bm-${nextBookmarkId++}`;
}
