import { http, HttpResponse } from "msw";
import { bookmarks, getNextBookmarkId } from "../data.ts";

export const bookmarkHandlers = [
  http.get("/api/bookmarks", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const tag = url.searchParams.get("tag");

    const filtered = tag ? bookmarks.filter((b) => b.tags.includes(tag)) : bookmarks;
    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);

    return HttpResponse.json({ bookmarks: slice, total: filtered.length, page, limit });
  }),

  http.get("/api/bookmarks/:id", ({ params }) => {
    const bookmark = bookmarks.find((b) => b.id === params["id"]);
    if (!bookmark) {
      return HttpResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }
    return HttpResponse.json(bookmark);
  }),

  http.post("/api/bookmarks", async ({ request }) => {
    const body = (await request.json()) as { url?: string; title?: string; tags?: string[] };

    if (!body.url || !body.title) {
      return HttpResponse.json(
        { error: [{ part: "body", path: [], message: "url and title are required" }] },
        { status: 400 },
      );
    }

    try {
      new URL(body.url);
    } catch {
      return HttpResponse.json(
        {
          error: [{ part: "body", path: ["url"], message: "Invalid url", code: "invalid_string" }],
        },
        { status: 400 },
      );
    }

    const bookmark = {
      id: getNextBookmarkId(),
      url: body.url,
      title: body.title,
      tags: body.tags ?? [],
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
    };

    bookmarks.push(bookmark);
    return HttpResponse.json(bookmark, { status: 201 });
  }),

  http.delete("/api/bookmarks/:id", ({ params }) => {
    const idx = bookmarks.findIndex((b) => b.id === params["id"]);
    if (idx === -1) {
      return HttpResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }

    bookmarks.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/tags", () => {
    const tagCounts: Record<string, number> = {};
    for (const b of bookmarks) {
      for (const t of b.tags) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }
    return HttpResponse.json({ tags: tagCounts });
  }),
];
